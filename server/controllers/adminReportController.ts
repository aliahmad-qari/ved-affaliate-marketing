import { Request, Response, NextFunction } from 'express';
import ExcelJS from 'exceljs';
import { Partner } from '../models/Partner.ts';
import { Campaign } from '../models/Campaign.ts';
import { Lead } from '../models/Lead.ts';
import { WalletTransaction } from '../models/WalletTransaction.ts';
import { buildAdminLeadQuery } from '../services/adminLeadQuery.ts';
import { createAdminLeadWorkbook } from '../services/adminLeadWorkbook.ts';

type ReportType = 'partners' | 'campaigns' | 'leads' | 'earnings' | 'payouts' | 'withdrawals';

const csvValue = (value: unknown): string => {
  const original = value instanceof Date ? value.toISOString() : String(value ?? '');
  const numeric = typeof value === 'number' && Number.isFinite(value);
  const text = !numeric && /^[=+\-@\t\r]/.test(original) ? `'${original}` : original;
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
      rows = await WalletTransaction.find(query).select(`transactionId partnerId type amount status referenceType referenceId description paymentMethod paymentReference createdAt updatedAt${type === 'earnings' ? ' direction relatedLeadId balanceBefore balanceAfter internalNote' : ''}`).sort({ createdAt: -1 }).lean().exec();
      if (type === 'earnings') rows = rows.map((row: any) => ({ ...row, direction: row.direction || 'CREDIT', signedAmount: row.direction === 'DEBIT' ? -Number(row.amount) : Number(row.amount), relatedLeadId: row.relatedLeadId || '', balanceBefore: row.balanceBefore ?? '', balanceAfter: row.balanceAfter ?? '', adjustmentReason: row.type === 'ADJUSTMENT' ? row.internalNote || '' : '' }));
    } else {
      res.status(404).json({ success: false, message: 'Unknown report type.' });
      return;
    }
    csvResponse(res, type, rows);
  } catch (error) { next(error); }
};

export const exportAdminCampaignWorkbook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const query = await buildAdminLeadQuery(req.query as Record<string, unknown>);
    const leads: any[] = await Lead.find(query)
      .select('leadId campaignName partnerId clientName clientMobile status payoutSnapshot createdAt approvedAt rejectionReason')
      .sort({ createdAt: -1, _id: 1 })
      .lean()
      .exec();
    const workbook = createAdminLeadWorkbook(leads);
    const workbookBuffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="ved-leads-' + new Date().toISOString().slice(0, 10) + '.xlsx"');
    res.send(Buffer.from(workbookBuffer));
  } catch (error) { next(error); }
};
