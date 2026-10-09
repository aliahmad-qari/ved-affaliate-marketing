import { Request, Response, NextFunction } from 'express';
import { Campaign } from '../models/Campaign.ts';
import { Lead } from '../models/Lead.ts';
import { getDbStatus } from '../config/db.ts';
import { LeadStore } from '../services/leadStore.ts';
import { PartnerStore } from '../services/partnerStore.ts';
import { isValidMobile } from '../utils/partnerIdGenerator.ts';
import { AppSetting } from '../models/AppSetting.ts';

// Helper to get LIVE campaigns only (for new lead submissions)
async function getLiveCampaigns(): Promise<any[]> {
  const { isConnected } = getDbStatus();
  if (isConnected) {
    const campaigns = await Campaign.find({ status: 'LIVE' })
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
 * - LIVE campaigns: Can submit NEW leads
 * - PAUSED campaigns: Can only update existing PENDING leads
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
        trackingUrl,
        whatsappShareUrl,
        isLive: camp.status === 'LIVE',
        isPaused: camp.status === 'PAUSED',
        canSubmitNew: camp.status === 'LIVE',
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
 * Partner submits a new lead against a LIVE campaign ONLY.
 * For PAUSED campaigns, partners can only update existing leads via /api/partner/leads/:leadId
 *
 * CRITICAL:
 * - Campaign must be LIVE for new lead submission
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

    // Lookup campaign - ONLY LIVE campaigns allowed for new submissions
    const liveCampaigns = await getLiveCampaigns();
    const campaign = liveCampaigns.find(
      (c) => c._id?.toString() === campaignId || c.slug === campaignId || c.name === campaignId
    );

    if (!campaign) {
      res.status(404).json({
        success: false,
        message: 'The selected campaign is not currently LIVE or available for new lead submission. If the campaign is paused, you can only update existing leads on that campaign.',
      });
      return;
    }

    // Snapshot payout directly from official campaign record
    const payoutSnapshot = Number(campaign.payout) || 0;

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

    const { leads, total } = await LeadStore.findLeadsByPartner(partnerId, {
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

/**
 * GET /api/partner/referrals
 * Displays referral statistics and referred partner status.
 * ₹50 reward is eligible ONLY after referred partner completes their first approved task.
 */
export const getPartnerReferrals = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const partner = req.user;
    const referredPartners = await PartnerStore.findReferredPartners(partner.partnerId);

    // Check for each referred partner whether they have completed at least one APPROVED or PAID lead
    const processedReferred = await Promise.all(
      referredPartners.map(async (rp) => {
        const { leads } = await LeadStore.findLeadsByPartner(rp.partnerId);
        const hasApprovedTask = leads.some((l) => l.status === 'APPROVED' || l.status === 'PAID');

        // Mask phone: 9876543210 -> 98*****210
        const phone = rp.mobile || '';
        const maskedPhone =
          phone.length >= 10 ? `${phone.substring(0, 2)}*****${phone.substring(7)}` : '**********';

        return {
          partnerId: rp.partnerId,
          fullName: rp.fullName,
          maskedMobile: maskedPhone,
          joinDate: rp.createdAt,
          taskStatus: hasApprovedTask ? 'COMPLETED' : 'PENDING_FIRST_TASK',
          rewardAmount: 50,
          rewardEarned: hasApprovedTask,
        };
      })
    );

    const qualifiedCount = processedReferred.filter((rp) => rp.rewardEarned).length;
    const totalEarned = qualifiedCount * 50;
    const pendingEarned = (processedReferred.length - qualifiedCount) * 50;

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
        rewardPerActiveReferral: 50,
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
