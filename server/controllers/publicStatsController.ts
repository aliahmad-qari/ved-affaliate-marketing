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
    const [liveCampaigns, activePartners, approvedLeads] = await Promise.all([
      Campaign.countDocuments({ status: 'LIVE' }),
      Partner.countDocuments({ accountStatus: 'ACTIVE' }),
      Lead.countDocuments({ status: { $in: ['APPROVED', 'PAID'] } }),
    ]);

    // Public stats intentionally exclude earnings, withdrawals and wallet totals.
    res.json({ success: true, data: { liveCampaigns, activePartners, approvedLeads } });
  } catch (error) {
    next(error);
  }
};
