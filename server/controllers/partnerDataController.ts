import { Request, Response, NextFunction } from 'express';
import { Campaign } from '../models/Campaign.ts';
import { Lead } from '../models/Lead.ts';
import { getDbStatus } from '../config/db.ts';
import { LeadStore } from '../services/leadStore.ts';
import { PartnerStore } from '../services/partnerStore.ts';
import { isValidMobile } from '../utils/partnerIdGenerator.ts';
import { AppSetting } from '../models/AppSetting.ts';
import { buildAdminLeadQuery } from '../services/adminLeadQuery.ts';
import { resolvePartnerPayout } from '../services/partnerPayout.ts';
import { resolvePartnerOwnedSubTeamLink } from '../services/subTeamAttribution.ts';
import { adminApprovedReferralLeadCriteria, isAdminApprovedReferralLead } from '../services/referralReward.ts';
import { REFERRAL_REWARD_AMOUNT_INR, REFERRAL_REWARD_REQUIRED_LEADS } from '../../shared/referralReward.ts';

// Manual reports are accepted for LIVE and PAUSED campaigns.
async function getReportCampaigns(): Promise<any[]> {
  const { isConnected } = getDbStatus();
  if (isConnected) {
    const campaigns = await Campaign.find({ status: { $in: ['LIVE', 'PAUSED'] } })
      .select('-baseTrackingUrl -__v')
      .sort({ sortOrder: 1, isFeatured: -1 })
      .exec();
    return campaigns.map((c) => c.toJSON());
  }
  throw Object.assign(new Error('Campaign availability cannot be verified. Please try again.'), { status: 503 });
}

// Helper to get ALL available campaigns (LIVE + PAUSED) - for updating existing leads
async function getAvailableCampaigns(): Promise<any[]> {
  const { isConnected } = getDbStatus();
  if (isConnected) {
    const campaigns = await Campaign.find({ status: { $in: ['LIVE', 'PAUSED'] } })
      .select('-baseTrackingUrl -__v')
      .sort({ sortOrder: 1, isFeatured: -1 })
      .exec();
    return campaigns.map((c) => c.toJSON());
  }
  throw Object.assign(new Error('Campaign availability cannot be verified. Please try again.'), { status: 503 });
}

/**
 * GET /api/partner/dashboard
 * Partner-scoped dashboard summary with real-time stats and recent lead submissions.
 */
export const getDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const partnerId = req.user.partnerId;
    const summary = await LeadStore.getDashboardSummary(partnerId);
    const { leads: recentLeads } = await LeadStore.findLeadsByPartner(partnerId, { limit: 5 });

    res.status(200).json({
      success: true,
      data: {
        summary,
        recentLeads,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/partner/campaigns
 * Retrieves LIVE and PAUSED campaigns.
 * - LIVE and PAUSED campaigns: Can submit manual reports and update eligible existing leads
 */
export const getPartnerCampaigns = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const partner = req.user;
    const campaigns = await getAvailableCampaigns();

    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const frontendOrigin = (process.env.FRONTEND_URL || '').split(',')[0].trim().replace(/\/$/, '');
    const baseUrl = frontendOrigin || `${protocol}://${host}`;

    const enhanced = campaigns.map((camp) => {
      // Future-safe partner tracking link with referral and partner ID parameters
      const trackingUrl = `${baseUrl}/campaigns/${camp.slug}?ref=${partner.referralCode}&pid=${partner.partnerId}`;
      const whatsappText = encodeURIComponent(
        `Open a verified account on ${camp.name} (${camp.companyName})!\nRequired Action: ${camp.requiredAction}\nJoin here: ${trackingUrl}`
      );
      const whatsappShareUrl = `https://wa.me/?text=${whatsappText}`;

      return {
        ...camp,
        payout: resolvePartnerPayout(camp, partner.payoutSettings),
        trackingUrl,
        whatsappShareUrl,
        isLive: camp.status === 'LIVE',
        isPaused: camp.status === 'PAUSED',
        canSubmitNew: ['LIVE', 'PAUSED'].includes(camp.status),
        canUpdateExisting: ['LIVE', 'PAUSED'].includes(camp.status),
      };
    });

    res.status(200).json({
      success: true,
      count: enhanced.length,
      data: enhanced,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/partner/leads
 * Partner submits a manual lead/report against a LIVE or PAUSED campaign.
 *
 * CRITICAL:
 * - Campaign must be LIVE or PAUSED for manual report submission
 * - Partner cannot set status (forced to PENDING)
 * - Payout snapshot is preserved from the campaign definition
 * - Duplicate submissions of the same accountId by the same partner are rejected
 */
export const submitLead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const partnerId = req.user.partnerId;
    const { campaignId, clientName, clientMobile, accountId, submittedNotes } = req.body;

    const errors: Record<string, string> = {};

    if (!campaignId || typeof campaignId !== 'string') {
      errors.campaignId = 'Campaign selection is required.';
    }

    if (!clientName || typeof clientName !== 'string' || clientName.trim().length < 2) {
      errors.clientName = 'Client full name is required (at least 2 characters).';
    }

    if (!clientMobile || !isValidMobile(clientMobile)) {
      errors.clientMobile = 'Valid 10-digit Indian client mobile number is required.';
    }

    if (!accountId || typeof accountId !== 'string' || accountId.trim().length < 2) {
      errors.accountId = 'Account / Application / Reference ID is required.';
    }

    if (Object.keys(errors).length > 0) {
      res.status(400).json({
        success: false,
        message: 'Validation failed. Please correct the highlighted fields.',
        errors,
      });
      return;
    }

    // Check the current status server-side, including forms opened before a status change.
    const liveCampaigns = await getReportCampaigns();
    const campaign = liveCampaigns.find(
      (c) => c._id?.toString() === campaignId || c.slug === campaignId || c.name === campaignId
    );

    if (!campaign) {
      res.status(404).json({
        success: false,
        message: 'Reports can only be submitted for LIVE or PAUSED campaigns. This campaign is unavailable for report submission.',
      });
      return;
    }

    // Snapshot payout directly from official campaign record
    const payoutSnapshot = resolvePartnerPayout(campaign, req.user.payoutSettings);
    const subTeamLinkId = typeof req.body.subTeamLinkId === 'string' && req.body.subTeamLinkId.trim()
      ? String((await resolvePartnerOwnedSubTeamLink(partnerId, req.body.subTeamLinkId.trim(), String(campaign._id)))._id)
      : undefined;

    const lead = await LeadStore.createLead({
      partnerId,
      campaignId: campaign.slug || campaign._id?.toString() || campaignId,
      campaignName: campaign.name,
      campaignType: campaign.campaignType,
      clientName: clientName.trim(),
      clientMobile: clientMobile.trim(),
      accountId: accountId.trim(),
      action: campaign.requiredAction,
      submittedData: {
        notes: submittedNotes ? String(submittedNotes).trim() : '',
        submittedIp: req.ip || '',
      },
      payoutSnapshot,
      ...(subTeamLinkId ? { subTeamLinkId } : {}),
    });

    res.status(201).json({
      success: true,
      message: 'Lead submitted successfully. It has been placed in PENDING status for Admin verification.',
      data: lead,
    });
  } catch (error: any) {
    if (error.status === 409 || error.code === 'DUPLICATE_LEAD') {
      res.status(409).json({
        success: false,
        message: error.message,
        code: 'DUPLICATE_LEAD',
      });
      return;
    }
    next(error);
  }
};

/**
 * GET /api/partner/leads
 * Retrieves submitted leads for the authenticated partner with filtering and search.
 */
export const getPartnerLeads = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const partnerId = req.user.partnerId;
    const { status, search, page = '1', limit = '50' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const campaignQuery = await buildAdminLeadQuery({ ...req.query, status: undefined, search: undefined }, partnerId);
    const { leads, total } = await LeadStore.findLeadsByPartner(partnerId, {
      campaignIds: campaignQuery.campaignId?.$in,
      createdAt: campaignQuery.createdAt,
      status: typeof status === 'string' ? status : undefined,
      search: typeof search === 'string' ? search : undefined,
      limit: limitNum,
      skip,
    });

    res.status(200).json({
      success: true,
      count: leads.length,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      data: leads,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/partner/leads/:leadId
 * Partner can update/report the status of an EXISTING lead (PENDING or VERIFIED only).
 * Works for BOTH LIVE and PAUSED campaigns.
 * Allowed transitions:
 * - PENDING → VERIFIED (partner confirms/verifies the lead details)
 * - VERIFIED → No further partner updates (admin only from here)
 */
export const updateLead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const partnerId = req.user.partnerId;
    const { leadId } = req.params;
    const { updatedNotes, manualStatusUpdate } = req.body;

    if (!leadId || typeof leadId !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Lead ID is required.',
      });
      return;
    }

    // Get lead (no campaign status check - works for LIVE and PAUSED)
    const lead = await Lead.findOne({
      _id: leadId,
      partnerId, // Ensure partner owns this lead
    }).exec();

    if (!lead) {
      res.status(404).json({
        success: false,
        message: 'Lead not found or you do not have permission to update it.',
      });
      return;
    }

    // Only allow updates to PENDING or VERIFIED leads
    if (!['PENDING', 'VERIFIED'].includes(lead.status)) {
      res.status(400).json({
        success: false,
        message: `Lead status is ${lead.status}. Only PENDING or VERIFIED leads can be updated by partners.`,
      });
      return;
    }

    // Update notes if provided
    if (updatedNotes && typeof updatedNotes === 'string') {
      lead.submittedData = {
        ...lead.submittedData,
        notes: updatedNotes.trim(),
        lastUpdatedAt: new Date().toISOString(),
      };
    }

    // Allow manual status report transition: PENDING → VERIFIED
    if (manualStatusUpdate === 'VERIFIED' && lead.status === 'PENDING') {
      lead.status = 'VERIFIED';
      lead.verifiedAt = new Date();
    }

    await lead.save();

    res.status(200).json({
      success: true,
      message: 'Lead updated successfully. Changes will be reviewed by Admin.',
      data: lead,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/partner/earnings
 * Real-time earnings breakdown filtered by date.
 */
export const getPartnerEarnings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const partnerId = req.user.partnerId;
    const { filter = 'all', startDate, endDate } = req.query;

    const earnings = await LeadStore.getEarningsBreakdown(
      partnerId,
      filter as any,
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );

    const summary = await LeadStore.getDashboardSummary(partnerId);

    res.status(200).json({
      success: true,
      count: earnings.length,
      summary: {
        totalEarnings: summary.totalEarnings,
        pendingEarnings: summary.pendingEarnings,
        approvedEarnings: summary.approvedEarnings,
        paidEarnings: summary.paidEarnings,
      },
      data: earnings,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/partner/wallet
 * Authoritative wallet balance and transaction ledger.
 */
export const getPartnerWallet = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const partnerId = req.user.partnerId;
    const summary = await LeadStore.getDashboardSummary(partnerId);
    const transactions = await LeadStore.getWalletTransactions(partnerId);
    const setting: any = getDbStatus().isConnected ? await AppSetting.findOne({ key: 'business' }).lean().exec() : null;

    res.status(200).json({
      success: true,
      data: {
        availableBalance: summary.availableWalletBalance,
        pendingBalance: summary.pendingEarnings,
        totalEarned: summary.totalEarnings,
        totalWithdrawn: summary.totalWithdrawn,
        totalDisbursed: Math.round((summary.totalWithdrawn + summary.paidEarnings) * 100) / 100,
        minimumWithdrawal: Number(setting?.minimumWithdrawalAmount ?? 200),
        transactions,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/partner/wallet/withdraw
 * Partner requests withdrawal (minimum ₹200).
 */
export const requestWithdrawal = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const partner = req.user;
    const { amount, paymentMethod } = req.body;

    if (partner.kycStatus !== 'VERIFIED') {
      res.status(403).json({ success: false, code: 'KYC_REQUIRED', message: 'Complete KYC in Profile and wait for admin verification before requesting a withdrawal.' });
      return;
    }

    const cleanAmount = Number(amount);
    const setting: any = getDbStatus().isConnected ? await AppSetting.findOne({ key: 'business' }).lean().exec() : null;
    const minimumWithdrawalAmount = Number(setting?.minimumWithdrawalAmount ?? 200);
    if (!Number.isFinite(cleanAmount) || cleanAmount < minimumWithdrawalAmount) {
      res.status(400).json({
        success: false,
        message: `Minimum withdrawal amount is ₹${minimumWithdrawalAmount}.`,
      });
      return;
    }

    if (!paymentMethod || !['UPI', 'BANK_TRANSFER'].includes(paymentMethod)) {
      res.status(400).json({
        success: false,
        message: "Payment method must be either 'UPI' or 'BANK_TRANSFER'.",
      });
      return;
    }

    let payoutDest = partner.upiId;
    if (paymentMethod === 'UPI' && !payoutDest) {
      res.status(400).json({ success: false, message: 'A saved payout UPI ID is required.' });
      return;
    }
    if (paymentMethod === 'BANK_TRANSFER') {
      const bankDetails = partner.bankDetails;
      if (!bankDetails?.accountNumber) {
        res.status(400).json({
          success: false,
          message: 'A saved bank account is required for bank withdrawals.',
        });
        return;
      }
      payoutDest = `${bankDetails.bankName} - A/C ${bankDetails.accountNumber} (${bankDetails.ifscCode})`;
    }

    const tx = await LeadStore.requestWithdrawal(partner.partnerId, cleanAmount, paymentMethod, payoutDest);

    res.status(201).json({
      success: true,
      message: `Withdrawal request of ₹${cleanAmount} has been recorded and submitted for Admin review.`,
      data: tx,
    });
  } catch (error: any) {
    if (error.status === 400) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
      return;
    }
    next(error);
  }
};

/** GET /api/partner/referrals: referral progress and actual ledger rewards for the authenticated referrer. */
export const getPartnerReferrals = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const partner = req.user;
    const referredPartners = await PartnerStore.findReferredPartners(partner.partnerId);
    const referredIds = referredPartners.map((rp: any) => String(rp.partnerId).toUpperCase());
    let qualifiedById = new Map<string, number>();
    if (referredIds.length && getDbStatus().isConnected) {
      const qualificationRows = await Lead.aggregate([
        { $match: { ...adminApprovedReferralLeadCriteria(), partnerId: { $in: referredIds } } },
        { $group: { _id: '$partnerId', approvedLeadCount: { $sum: 1 } } },
      ]).exec();
      qualifiedById = new Map(qualificationRows.map((row: any) => [String(row._id).toUpperCase(), Number(row.approvedLeadCount) || 0]));
    } else {
      const fallbackRows = await Promise.all(referredIds.map(async partnerId => {
        const { leads } = await LeadStore.findLeadsByPartner(partnerId, { limit: 100000 });
        return [partnerId, leads.filter(isAdminApprovedReferralLead).length] as const;
      }));
      qualifiedById = new Map(fallbackRows);
    }
    const rewardTransactions = await LeadStore.findReferralRewardsForReferredPartners(partner.partnerId, referredIds);
    const rewardById = new Map<string, any>();
    for (const tx of rewardTransactions) {
      const refId = String(tx.referenceId || '').toUpperCase();
      if (!rewardById.has(refId)) rewardById.set(refId, tx);
    }
    const processedReferred = referredPartners.map((rp: any) => {
      const partnerId = String(rp.partnerId).toUpperCase();
      const approvedLeadCount = qualifiedById.get(partnerId) || 0;
      const reward = rewardById.get(partnerId);
      const hasPriorReward = Boolean(reward);
      const rewardWasCredited = hasPriorReward && ['AVAILABLE', 'PROCESSING', 'APPROVED', 'PROCESSED', 'PAID'].includes(String(reward.status || '').toUpperCase());
      const taskStatus = hasPriorReward
        ? (rewardWasCredited ? 'REWARDED' : 'REVIEW_REQUIRED')
        : approvedLeadCount < REFERRAL_REWARD_REQUIRED_LEADS ? 'IN_PROGRESS' : 'REVIEW_REQUIRED';
      const phone = rp.mobile || '';
      const maskedMobile = phone.length >= 10 ? `${phone.substring(0, 2)}*****${phone.substring(7)}` : '**********';
      return {
        partnerId: rp.partnerId,
        fullName: rp.fullName,
        maskedMobile,
        joinDate: rp.createdAt,
        approvedLeadCount,
        requiredApprovedLeads: REFERRAL_REWARD_REQUIRED_LEADS,
        taskStatus,
        rewardAmount: reward ? Number(reward.amount) || 0 : 0,
        rewardStatus: reward?.status || (taskStatus === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'REVIEW_REQUIRED'),
        rewardEarned: rewardWasCredited,
        priorRewardExists: hasPriorReward,
      };
    });

    const qualifiedCount = processedReferred.filter((rp) => rp.approvedLeadCount >= REFERRAL_REWARD_REQUIRED_LEADS).length;
    const totalEarned = rewardTransactions.filter((tx: any) => ['AVAILABLE', 'PROCESSING', 'APPROVED', 'PROCESSED', 'PAID'].includes(String(tx.status || '').toUpperCase()))
      .reduce((sum: number, tx: any) => sum + (Number(tx.amount) || 0), 0);
    const pendingEarned = processedReferred.filter((rp) => rp.taskStatus === 'IN_PROGRESS')
      .reduce((sum, rp) => sum + REFERRAL_REWARD_AMOUNT_INR, 0);

    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const frontendOrigin = (process.env.FRONTEND_URL || '').split(',')[0].trim().replace(/\/$/, '');
    const referralBaseUrl = frontendOrigin || `${protocol}://${host}`;
    const referralLink = `${referralBaseUrl}/register?ref=${partner.referralCode}`;

    res.status(200).json({
      success: true,
      data: {
        referralCode: partner.referralCode,
        referralLink,
        rewardPerActiveReferral: REFERRAL_REWARD_AMOUNT_INR,
        totalReferred: processedReferred.length,
        qualifiedReferred: qualifiedCount,
        pendingReferred: processedReferred.length - qualifiedCount,
        earnedRewards: totalEarned,
        potentialRewards: pendingEarned,
        referredPartners: processedReferred,
      },
    });
  } catch (error) {
    next(error);
  }
};
