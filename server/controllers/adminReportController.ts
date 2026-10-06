import { Request, Response, NextFunction } from 'express';
import ExcelJS from 'exceljs';
import { Partner } from '../models/Partner.ts';
import { Campaign } from '../models/Campaign.ts';
import { Lead } from '../models/Lead.ts';
import { WalletTransaction } from '../models/WalletTransaction.ts';
import { TrackingClick } from '../models/TrackingClick.ts';

type ReportType = 'partners' | 'campaigns' | 'leads' | 'earnings' | 'payouts' | 'withdrawals';

const csvValue = (value: unknown): string => {
  const original = value instanceof Date ? value.toISOString() : String(value ?? '');
  const text = /^[=+\-@\t\r]/.test(original) ? `'${original}` : original;
  return `"${text.replace(/"/g, '""')}"`;
};

const csvResponse = (res: Response, name: string, rows: Record<string, unknown>[]) => {
  const keys = rows.length ? Object.keys(rows[0]) : [];
  const csv = [keys.map(csvValue).join(','), ...rows.map((row) => keys.map((key) => csvValue(row[key])).join(','))].join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="ved-${name}-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(`\uFEFF${csv}`);
};

export const exportAdminReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const type = req.params.type as ReportType;
    const startDate = req.query.startDate ? new Date(String(req.query.startDate)) : undefined;
    const endDate = req.query.endDate ? new Date(String(req.query.endDate)) : undefined;
    if ((startDate && Number.isNaN(startDate.getTime())) || (endDate && Number.isNaN(endDate.getTime()))) {
      res.status(400).json({ success: false, message: 'Invalid date filter.' });
      return;
    }
    const createdAt: Record<string, Date> = {};
    if (startDate) createdAt.$gte = startDate;
    if (endDate) createdAt.$lte = endDate;
    const hasDateFilter = Object.keys(createdAt).length > 0;
    const status = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : '';
    let rows: Record<string, unknown>[] = [];

    if (type === 'partners') {
      const query: Record<string, any> = hasDateFilter ? { createdAt } : {};
      if (status) query.accountStatus = status;
      rows = await Partner.find(query).select('partnerId fullName email mobile city state accountStatus kycStatus createdAt').sort({ createdAt: -1 }).lean().exec();
    } else if (type === 'campaigns') {
      const query: Record<string, any> = hasDateFilter ? { createdAt } : {};
      if (status) query.status = status;
      const campaigns: any[] = await Campaign.find(query).select('name slug companyName campaignType payout status isFeatured createdAt').sort({ createdAt: -1 }).lean().exec();
      rows = campaigns;
    } else if (type === 'leads' || type === 'payouts') {
      const query: Record<string, any> = {};
      if (hasDateFilter) query.createdAt = createdAt;
      if (status) query.status = status;
      if (typeof req.query.campaignId === 'string') query.campaignId = req.query.campaignId;
      if (typeof req.query.partnerId === 'string') query.partnerId = req.query.partnerId.toUpperCase();
      const leads: any[] = await Lead.find(query).select('leadId partnerId campaignId campaignName payoutSnapshot currency status createdAt approvedAt paidAt rejectionReason').sort({ createdAt: -1 }).lean().exec();
      rows = leads;
    } else if (type === 'earnings' || type === 'withdrawals') {
      const query: Record<string, any> = { type: type === 'earnings' ? { $in: ['LEAD_EARNING', 'REFERRAL_REWARD', 'ADJUSTMENT'] } : 'WITHDRAWAL' };
      if (hasDateFilter) query.createdAt = createdAt;
      if (status) query.status = status;
      if (typeof req.query.partnerId === 'string') query.partnerId = req.query.partnerId.toUpperCase();
      rows = await WalletTransaction.find(query).select('transactionId partnerId type amount status referenceType referenceId description paymentMethod paymentReference createdAt updatedAt').sort({ createdAt: -1 }).lean().exec();
    } else {
      res.status(404).json({ success: false, message: 'Unknown report type.' });
      return;
    }
    csvResponse(res, type, rows);
  } catch (error) { next(error); }
};

type CampaignInsight = { insights: string; recommendations: string };

const fallbackInsight = (message: string): CampaignInsight => ({
  insights: message,
  recommendations: 'No AI recommendations were generated. Review the campaign metrics and provider validation data.',
});

const generateCampaignInsights = async (metrics: Record<string, unknown>[]): Promise<Map<string, CampaignInsight>> => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return new Map(metrics.map((row) => [String(row.campaignId), fallbackInsight('AI analysis not generated: GROQ_API_KEY is not configured.')]));

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Analyze campaign performance using only the supplied aggregate metrics. Do not invent facts or infer causation. Return JSON only: {"campaigns":[{"campaignId":"...","insights":"...","recommendations":"..."}]}.' },
          { role: 'user', content: JSON.stringify(metrics) },
        ],
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`Groq returned ${response.status}`);
    const payload: any = await response.json();
    const content = payload.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content);
    const result = new Map<string, CampaignInsight>();
    for (const item of Array.isArray(parsed.campaigns) ? parsed.campaigns : []) {
      if (typeof item.campaignId === 'string') {
        result.set(item.campaignId, {
          insights: typeof item.insights === 'string' ? item.insights : 'No insight returned.',
          recommendations: typeof item.recommendations === 'string' ? item.recommendations : 'No recommendation returned.',
        });
      }
    }
    return new Map(metrics.map((row) => {
      const id = String(row.campaignId);
      return [id, result.get(id) || fallbackInsight('AI analysis was unavailable for this campaign.')];
    }));
  } catch (error) {
    console.error('[VED REPORT] Campaign AI insight generation failed:', error instanceof Error ? error.message : error);
    return new Map(metrics.map((row) => [String(row.campaignId), fallbackInsight('AI analysis could not be generated; see server logs.')]));
  }
};

const styleWorksheet = (worksheet: ExcelJS.Worksheet) => {
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF18243B' } };
  worksheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: Math.max(1, worksheet.columnCount) } };
};

export const exportAdminCampaignWorkbook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const requestedCampaignId = typeof req.query.campaignId === 'string' ? req.query.campaignId.trim() : '';
    const campaignQuery: Record<string, unknown> = requestedCampaignId ? { _id: requestedCampaignId } : {};
    if (typeof req.query.status === 'string' && req.query.status) campaignQuery.status = req.query.status.toUpperCase();
    const campaigns: any[] = await Campaign.find(campaignQuery).sort({ sortOrder: 1, name: 1 }).lean().exec();
    if (requestedCampaignId && campaigns.length === 0) {
      res.status(404).json({ success: false, message: 'Campaign not found.' });
      return;
    }

    const campaignIds = campaigns.map((campaign) => String(campaign._id));
    const campaignSlugs = campaigns.map((campaign) => campaign.slug);
    const campaignNames = campaigns.map((campaign) => campaign.name);
    const leadQuery: Record<string, any> = {
      $or: [
        { campaignId: { $in: [...campaignIds, ...campaignSlugs] } },
        { campaignName: { $in: campaignNames } },
      ],
    };
    const createdAt: Record<string, Date> = {};
    if (req.query.startDate) {
      const date = new Date(String(req.query.startDate));
      if (Number.isNaN(date.getTime())) { res.status(400).json({ success: false, message: 'Invalid start date.' }); return; }
      createdAt.$gte = date;
    }
    if (req.query.endDate) {
      const date = new Date(String(req.query.endDate));
      if (Number.isNaN(date.getTime())) { res.status(400).json({ success: false, message: 'Invalid end date.' }); return; }
      date.setHours(23, 59, 59, 999);
      createdAt.$lte = date;
    }
    if (Object.keys(createdAt).length) leadQuery.createdAt = createdAt;
    if (typeof req.query.leadStatus === 'string' && req.query.leadStatus) leadQuery.status = req.query.leadStatus.toUpperCase();
    const clickQuery: Record<string, unknown> = { campaignId: { $in: campaignIds } };
    if (Object.keys(createdAt).length) clickQuery.createdAt = createdAt;

    const [leads, clicks] = await Promise.all([
      Lead.find(leadQuery).sort({ createdAt: -1 }).lean().exec(),
      TrackingClick.find(clickQuery).sort({ createdAt: -1 }).lean().exec(),
    ]);
    const partnerIds = [...new Set(leads.map((lead: any) => lead.partnerId))];
    const leadPartners: any[] = await Partner.find({ partnerId: { $in: partnerIds } }).select('partnerId fullName email referredBy referralCode accountStatus').lean().exec();
    const referralPartnerIds = [...new Set(leadPartners.map((partner: any) => partner.referredBy).filter(Boolean))];
    const rewardPartnerIds = leadPartners.filter((partner: any) => partner.referredBy).map((partner: any) => partner.partnerId);
    const [referrers, referralRewards, firstApprovedRows] = await Promise.all([
      Partner.find({ partnerId: { $in: referralPartnerIds } }).select('partnerId fullName email').lean().exec(),
      WalletTransaction.find({ type: 'REFERRAL_REWARD', referenceId: { $in: rewardPartnerIds } }).select('referenceId amount status transactionId createdAt').lean().exec(),
      Lead.aggregate([
        { $match: { partnerId: { $in: rewardPartnerIds }, status: { $in: ['APPROVED', 'PAID'] } } },
        { $addFields: { qualificationAt: { $ifNull: ['$approvedAt', '$createdAt'] } } },
        { $sort: { qualificationAt: 1, createdAt: 1 } },
        { $group: { _id: '$partnerId', campaignId: { $first: '$campaignId' }, campaignName: { $first: '$campaignName' } } },
      ]).exec(),
    ]);
    const partnerById = new Map(leadPartners.map((partner: any) => [partner.partnerId, partner]));
    const referrerById = new Map(referrers.map((partner: any) => [partner.partnerId, partner]));
    const rewardByChildId = new Map(referralRewards.map((reward: any) => [reward.referenceId, reward]));
    const firstApprovedCampaignByChildId = new Map(firstApprovedRows.map((row: any) => [row._id, { campaignId: row.campaignId, campaignName: row.campaignName }]));

    const campaignData = campaigns.map((campaign: any) => {
      const campaignId = String(campaign._id);
      const campaignLeads = leads.filter((lead: any) => lead.campaignId === campaignId || lead.campaignId === campaign.slug || lead.campaignName === campaign.name);
      const campaignClicks = clicks.filter((click: any) => click.campaignId === campaignId);
      const referredLeads = campaignLeads.filter((lead: any) => Boolean(partnerById.get(lead.partnerId)?.referredBy));
      const referredPartnerIdsForCampaign = [...new Set(referredLeads.map((lead: any) => lead.partnerId))];
      const approved = campaignLeads.filter((lead: any) => ['APPROVED', 'PAID'].includes(lead.status));
      const trackedApproved = approved.filter((lead: any) => Boolean(lead.vendorClickId));
      const referredApprovedLeads = referredLeads.filter((lead: any) => ['APPROVED', 'PAID'].includes(lead.status));
      const rewardQualifiers = referredPartnerIdsForCampaign.filter((childId: string) => {
        const firstApproved = firstApprovedCampaignByChildId.get(childId);
        return firstApproved?.campaignId === campaignId || firstApproved?.campaignId === campaign.slug || firstApproved?.campaignName === campaign.name;
      });
      const metric = {
        campaignId,
        campaignName: campaign.name,
        slug: campaign.slug,
        status: campaign.status,
        category: campaign.campaignType,
        startDate: campaign.startDate || null,
        endDate: campaign.endDate || null,
        createdAt: campaign.createdAt || null,
        updatedAt: campaign.updatedAt || null,
        payout: Number(campaign.payout || 0),
        clickCount: campaignClicks.length,
        leadCount: campaignLeads.length,
        uniquePartnerCount: new Set(campaignLeads.map((lead: any) => lead.partnerId)).size,
        pendingLeadCount: campaignLeads.filter((lead: any) => ['PENDING', 'VERIFIED'].includes(lead.status)).length,
        approvedConversionCount: approved.length,
        rejectedLeadCount: campaignLeads.filter((lead: any) => lead.status === 'REJECTED').length,
        paidLeadCount: campaignLeads.filter((lead: any) => lead.status === 'PAID').length,
        referredPartnerCount: referredPartnerIdsForCampaign.length,
        referralLeadCount: referredLeads.length,
        referralConversionCount: referredApprovedLeads.length,
        referralRewardAmount: rewardQualifiers.reduce((sum: number, childId: string) => sum + Number((rewardByChildId.get(childId) as any)?.amount || 0), 0),
        trackedApprovedConversionCount: trackedApproved.length,
        conversionRatePercent: campaignClicks.length ? Number(((trackedApproved.length / campaignClicks.length) * 100).toFixed(2)) : 0,
        approvedPayoutTotal: approved.reduce((sum: number, lead: any) => sum + Number(lead.payoutSnapshot || 0), 0),
      };
      return { campaign, campaignId, campaignLeads, campaignClicks, referredLeads, metric };
    });

    const insights = await generateCampaignInsights(campaignData.map((item) => item.metric));
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'VED Affiliate';
    workbook.created = new Date();
    const summarySheet = workbook.addWorksheet('Campaign Summary');
    summarySheet.columns = [
      { header: 'Campaign Name', key: 'campaignName', width: 32 }, { header: 'Campaign ID', key: 'campaignId', width: 28 },
      { header: 'Company', key: 'companyName', width: 28 }, { header: 'Slug', key: 'slug', width: 24 }, { header: 'Status', key: 'status', width: 14 }, { header: 'Category', key: 'category', width: 22 },
      { header: 'Description', key: 'description', width: 60 }, { header: 'Required Action', key: 'requiredAction', width: 48 }, { header: 'Payout Terms', key: 'payoutTerms', width: 44 },
      { header: 'Rules', key: 'rules', width: 50 }, { header: 'Eligibility Terms', key: 'eligibility', width: 40 }, { header: 'Validation / Rejection Terms', key: 'validationRejection', width: 44 },
      { header: 'Payout Timeline Terms', key: 'payoutTimeline', width: 40 }, { header: 'Duplicate / Fraud Terms', key: 'duplicateFraudRules', width: 40 },
      { header: 'Start Date', key: 'startDate', width: 22 }, { header: 'End Date', key: 'endDate', width: 22 }, { header: 'Created At', key: 'createdAt', width: 22 }, { header: 'Updated At', key: 'updatedAt', width: 22 },
      { header: 'Payout (INR)', key: 'payout', width: 16 }, { header: 'Tracked Clicks (180-day retention)', key: 'clickCount', width: 25 }, { header: 'Leads', key: 'leadCount', width: 12 },
      { header: 'Unique Partners', key: 'uniquePartnerCount', width: 18 }, { header: 'Pending Leads', key: 'pendingLeadCount', width: 16 }, { header: 'Approved Conversions', key: 'approvedConversionCount', width: 24 },
      { header: 'Rejected Leads', key: 'rejectedLeadCount', width: 17 }, { header: 'Paid Leads', key: 'paidLeadCount', width: 14 }, { header: 'Referral Leads', key: 'referralLeadCount', width: 17 }, { header: 'Referral Conversions', key: 'referralConversionCount', width: 22 },
      { header: 'Tracked Approved Conversions', key: 'trackedApprovedConversionCount', width: 30 },
      { header: 'Referred Partners', key: 'referredPartnerCount', width: 18 },
      { header: 'Related Referral Rewards (INR)', key: 'referralRewardAmount', width: 30 }, { header: 'Click-to-Approval Rate (%)', key: 'conversionRatePercent', width: 26 }, { header: 'Approved Payout Total (INR)', key: 'approvedPayoutTotal', width: 28 },
    ];
    for (const item of campaignData) summarySheet.addRow({
      ...item.metric,
      companyName: item.campaign.companyName,
      description: item.campaign.description,
      requiredAction: item.campaign.requiredAction,
      payoutTerms: item.campaign.payoutTerms,
      rules: (item.campaign.rules || []).join('\n'),
      eligibility: item.campaign.terms?.eligibility || '',
      validationRejection: item.campaign.terms?.validationRejection || '',
      payoutTimeline: item.campaign.terms?.payoutTimeline || '',
      duplicateFraudRules: item.campaign.terms?.duplicateFraudRules || '',
    });
    styleWorksheet(summarySheet);
    summarySheet.eachRow((row, rowNumber) => { if (rowNumber > 1) row.alignment = { vertical: 'top', wrapText: true }; });

    const leadSheet = workbook.addWorksheet('Leads & Conversions');
    leadSheet.columns = [
      { header: 'Lead ID', key: 'leadId', width: 20 }, { header: 'Campaign Name', key: 'campaignName', width: 30 }, { header: 'Campaign ID', key: 'campaignId', width: 28 },
      { header: 'Partner ID', key: 'partnerId', width: 20 }, { header: 'Customer Name', key: 'clientName', width: 26 }, { header: 'Customer Mobile', key: 'clientMobile', width: 20 },
      { header: 'Vendor Conversion Key', key: 'vendorConversionKey', width: 36 }, { header: 'Account / Reference', key: 'accountId', width: 28 }, { header: 'Action', key: 'action', width: 40 },
      { header: 'Status', key: 'status', width: 14 }, { header: 'Payout Snapshot', key: 'payoutSnapshot', width: 18 }, { header: 'Currency', key: 'currency', width: 12 },
      { header: 'Created At', key: 'createdAt', width: 24 }, { header: 'Approved At', key: 'approvedAt', width: 24 }, { header: 'Paid At', key: 'paidAt', width: 24 }, { header: 'Rejection Reason', key: 'rejectionReason', width: 40 },
    ];
    for (const item of campaignData) for (const lead of item.campaignLeads) leadSheet.addRow({ ...lead, campaignId: item.campaignId });
    styleWorksheet(leadSheet);

    const clicksSheet = workbook.addWorksheet('Tracking Clicks');
    clicksSheet.columns = [
      { header: 'Click ID', key: 'clickId', width: 40 }, { header: 'Campaign ID', key: 'campaignId', width: 28 }, { header: 'Campaign', key: 'campaignName', width: 32 },
      { header: 'Partner ID', key: 'partnerId', width: 20 }, { header: 'Payout Snapshot', key: 'payoutSnapshot', width: 18 }, { header: 'Clicked At', key: 'createdAt', width: 24 }, { header: 'Attribution Expires', key: 'expiresAt', width: 24 },
    ];
    const campaignNameById = new Map(campaignData.map((item) => [item.campaignId, item.campaign.name]));
    for (const click of clicks) clicksSheet.addRow({ ...click, campaignName: campaignNameById.get(click.campaignId) || '' });
    styleWorksheet(clicksSheet);

    const referralsSheet = workbook.addWorksheet('Referral Activity');
    referralsSheet.columns = [
      { header: 'Campaign', key: 'campaignName', width: 30 }, { header: 'Campaign ID', key: 'campaignId', width: 28 }, { header: 'Lead IDs', key: 'leadIds', width: 38 }, { header: 'Referral Leads', key: 'leadCount', width: 14 }, { header: 'Approved Conversions', key: 'conversionCount', width: 22 },
      { header: 'Referred Partner ID', key: 'partnerId', width: 22 }, { header: 'Referred Partner', key: 'partnerName', width: 28 }, { header: 'Referral Code', key: 'referralCode', width: 18 },
      { header: 'Referrer Partner ID', key: 'referrerId', width: 22 }, { header: 'Referrer', key: 'referrerName', width: 28 }, { header: 'Conversion Statuses', key: 'statuses', width: 30 },
      { header: 'Reward Amount', key: 'rewardAmount', width: 18 }, { header: 'Reward Status', key: 'rewardStatus', width: 16 },
    ];
    for (const item of campaignData) {
      const leadsByReferredPartner = new Map<string, any[]>();
      for (const lead of item.referredLeads) leadsByReferredPartner.set(lead.partnerId, [...(leadsByReferredPartner.get(lead.partnerId) || []), lead]);
      for (const [referredId, referredPartnerLeads] of leadsByReferredPartner) {
        const partner: any = partnerById.get(referredId);
        const referrer: any = partner ? referrerById.get(partner.referredBy) : null;
        const firstApproved = firstApprovedCampaignByChildId.get(referredId);
        const rewardBelongsToCampaign = firstApproved?.campaignId === item.campaignId || firstApproved?.campaignId === item.campaign.slug || firstApproved?.campaignName === item.campaign.name;
        const reward: any = rewardBelongsToCampaign ? rewardByChildId.get(referredId) : null;
        referralsSheet.addRow({ campaignName: item.campaign.name, campaignId: item.campaignId, leadIds: referredPartnerLeads.map((lead) => lead.leadId).join(', '), leadCount: referredPartnerLeads.length, conversionCount: referredPartnerLeads.filter((lead) => ['APPROVED', 'PAID'].includes(lead.status)).length, partnerId: referredId, partnerName: partner?.fullName || '', referralCode: partner?.referralCode || '', referrerId: partner?.referredBy || '', referrerName: referrer?.fullName || 'Referrer unavailable', statuses: referredPartnerLeads.map((lead) => lead.status).join(', '), rewardAmount: reward?.amount ?? 0, rewardStatus: reward?.status || (rewardBelongsToCampaign ? 'ELIGIBLE_REWARD_NOT_FOUND' : 'NOT_QUALIFIED_FOR_THIS_CAMPAIGN') });
      }
    }
    styleWorksheet(referralsSheet);

    const insightsSheet = workbook.addWorksheet('AI Insights');
    insightsSheet.columns = [
      { header: 'Campaign Name', key: 'campaignName', width: 32 }, { header: 'Campaign ID', key: 'campaignId', width: 28 },
      { header: 'AI Insights', key: 'insights', width: 90 }, { header: 'AI Recommendations', key: 'recommendations', width: 90 },
    ];
    for (const item of campaignData) {
      const insight = insights.get(item.campaignId) || fallbackInsight('AI analysis unavailable.');
      insightsSheet.addRow({ campaignName: item.campaign.name, campaignId: item.campaignId, ...insight });
    }
    styleWorksheet(insightsSheet);
    insightsSheet.eachRow((row, rowNumber) => { if (rowNumber > 1) row.height = 60; });
    for (const worksheet of [leadSheet, clicksSheet, referralsSheet, insightsSheet]) worksheet.eachRow((row, rowNumber) => { if (rowNumber > 1) row.alignment = { vertical: 'top', wrapText: true }; });

    const workbookBuffer = await workbook.xlsx.writeBuffer();
    const reportName = requestedCampaignId ? campaignData[0]?.campaignId || 'campaign' : 'all-campaigns';
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="ved-${reportName}-campaign-report-${new Date().toISOString().slice(0, 10)}.xlsx"`);
    res.send(Buffer.from(workbookBuffer));
  } catch (error) { next(error); }
};