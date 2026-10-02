import { Request, Response, NextFunction } from 'express';
import { Campaign } from '../models/Campaign.ts';
import { initialCampaignSeeds } from '../seeds/campaignSeeds.ts';
import { getDbStatus } from '../config/db.ts';
import { LeadStore } from '../services/leadStore.ts';
import { PartnerStore } from '../services/partnerStore.ts';
import { isValidMobile } from '../utils/partnerIdGenerator.ts';

// Helper to get LIVE campaigns
async function getLiveCampaigns(): Promise<any[]> {
  const { isConnected } = getDbStatus();
  if (isConnected) {
    const campaigns = await Campaign.find({ status: 'LIVE' })
      .select('-baseTrackingUrl -__v')
      .sort({ sortOrder: 1, isFeatured: -1 })
      .exec();
    if (campaigns.length > 0) return campaigns.map((c) => c.toJSON());
  }
  return initialCampaignSeeds.filter((c) => c.status === 'LIVE');
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
 * Retrieves LIVE campaigns configured with partner-specific tracking URLs.
 */
export const getPartnerCampaigns = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const partner = req.user;
    const campaigns = await getLiveCampaigns();

    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const baseUrl = `${protocol}://${host}`;

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
 * Partner submits a new lead against a LIVE campaign.
 * CRITICAL:
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

    // Lookup campaign
    const liveCampaigns = await getLiveCampaigns();
    const campaign = liveCampaigns.find(
      (c) => c._id?.toString() === campaignId || c.slug === campaignId || c.name === campaignId
    );

    if (!campaign) {
      res.status(404).json({
        success: false,
        message: 'The selected campaign is not currently LIVE or available for lead submission.',
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

    res.status(200).json({
      success: true,
      data: {
        availableBalance: summary.availableWalletBalance,
        pendingBalance: summary.pendingEarnings,
        totalEarned: summary.totalEarnings,
        totalWithdrawn: summary.totalWithdrawn,
        minimumWithdrawal: 200,
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
    const { amount, paymentMethod, destination } = req.body;

    const cleanAmount = Number(amount);
    if (isNaN(cleanAmount) || cleanAmount < 200) {
      res.status(400).json({
        success: false,
        message: 'Minimum withdrawal amount is ₹200.',
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

    // Default destination from partner profile if omitted
    let payoutDest = destination;
    if (!payoutDest) {
      if (paymentMethod === 'UPI') {
        payoutDest = partner.upiId;
      } else {
        payoutDest = `${partner.bankDetails?.bankName} - ${partner.bankDetails?.accountNumber} (${partner.bankDetails?.ifscCode})`;
      }
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
    const referralLink = `${protocol}://${host}/register?ref=${partner.referralCode}`;

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
