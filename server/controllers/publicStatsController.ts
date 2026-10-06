import { Request, Response, NextFunction } from 'express';
import { getDbStatus } from '../config/db.ts';
import { Campaign } from '../models/Campaign.ts';
import { Partner } from '../models/Partner.ts';
import { Lead } from '../models/Lead.ts';
import { WalletTransaction } from '../models/WalletTransaction.ts';

export const getPublicStats = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (!getDbStatus().isConnected) {
    res.status(503).json({ success: false, message: 'Statistics are temporarily unavailable.' });
    return;
  }

  try {
    const [liveCampaigns, activePartners, approvedLeads, paidLeads, paidWithdrawals] = await Promise.all([
      Campaign.countDocuments({ status: 'LIVE' }),
      Partner.countDocuments({ accountStatus: 'ACTIVE' }),
      Lead.countDocuments({ status: { $in: ['APPROVED', 'PAID'] } }),
      Lead.aggregate([
        { $match: { status: 'PAID' } },
        { $group: { _id: null, amount: { $sum: '$payoutSnapshot' } } },
      ]),
      WalletTransaction.aggregate([
        { $match: { type: 'WITHDRAWAL', status: { $in: ['PAID', 'PROCESSED'] } } },
        { $group: { _id: null, amount: { $sum: '$amount' } } },
      ]),
    ]);

    // Match the admin dashboard's paid payout total, including direct lead payments.
    const totalPayouts = Number(paidLeads[0]?.amount || 0) + Number(paidWithdrawals[0]?.amount || 0);
    res.json({ success: true, data: { liveCampaigns, activePartners, approvedLeads, totalPayouts } });
  } catch (error) {
    next(error);
  }
};
