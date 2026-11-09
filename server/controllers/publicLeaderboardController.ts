import { Request, Response, NextFunction } from 'express';
import { getPublicMonthlyLeaderboard } from '../services/monthlyLeaderboard.ts';
import { monthKeyInTimeZone } from '../../shared/monthlyLeaderboard.ts';

export async function getPublicSuccessfulLeads(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const monthKey = monthKeyInTimeZone();
    const data = await getPublicMonthlyLeaderboard(monthKey);
    res.set({ 'Cache-Control': 'public, max-age=60', 'Referrer-Policy': 'no-referrer' });
    res.json({ success: true, data });
  } catch (error) { next(error); }
}
