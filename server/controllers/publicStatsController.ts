import { Request, Response, NextFunction } from 'express';
import { getDbStatus } from '../config/db.ts';
import { Campaign } from '../models/Campaign.ts';
import { Partner } from '../models/Partner.ts';
import { Lead } from '../models/Lead.ts';

export const getPublicStats = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (!getDbStatus().isConnected) {
    res.status(503).json({ success: false, message: 'Statistics are temporarily unavailable.' });
    return;
  }

  try {
    const [liveCampaigns, activePartners, approvedLeads, approvedPayoutRows] = await Promise.all([
      Campaign.countDocuments({ status: 'LIVE' }),
      Partner.countDocuments({ accountStatus: 'ACTIVE' }),
      Lead.countDocuments({ status: { $in: ['APPROVED', 'PAID'] } }),
      Lead.aggregate([
        { $match: { status: { $in: ['APPROVED', 'PAID'] }, approvalReversal: { $exists: false }, rejectionReasonCode: { $ne: 'DUPLICATE_LEAD' } } },
        { $group: { _id: null, amount: { $sum: { $cond: [
          { $eq: ['$payoutTypeSnapshot', 'PERCENTAGE'] },
          { $cond: [{ $eq: ['$payoutCommission.state', 'AVAILABLE'] }, { $ifNull: ['$payoutSnapshot', 0] }, 0] },
          { $ifNull: ['$payoutSnapshot', 0] },
        ] } } } },
      ]).exec(),
    ]);

    const approvedPayout = Math.round((Number(approvedPayoutRows[0]?.amount) || 0) * 100) / 100;
    res.json({ success: true, data: { liveCampaigns, activePartners, approvedLeads, approvedPayout } });
  } catch (error) {
    next(error);
  }
};
