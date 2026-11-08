import { Request, Response, NextFunction } from 'express';
import { getMonthlyLeaderboard } from '../services/monthlyLeaderboard.ts';
import { monthKeyInTimeZone, LEADERBOARD_TIME_ZONE } from '../../shared/monthlyLeaderboard.ts';
import { maskPublicPartnerId, maskPublicPartnerName } from '../utils/publicPartnerMasking.ts';

export async function getPublicSuccessfulLeads(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const month = typeof req.query.month === 'string' ? req.query.month : monthKeyInTimeZone();
    const board = await getMonthlyLeaderboard(month);
    res.set({ 'Cache-Control': 'public, max-age=60', 'Referrer-Policy': 'no-referrer' });
    res.json({
      success: true,
      data: {
        month: board.monthKey,
        timeZone: LEADERBOARD_TIME_ZONE,
        partners: board.rankings.map(row => ({
          partnerName: maskPublicPartnerName(row.fullName),
          partnerId: maskPublicPartnerId(row.partnerId),
          successfulLeads: row.approvedConversions,
        })),
      },
    });
  } catch (error) { next(error); }
}
