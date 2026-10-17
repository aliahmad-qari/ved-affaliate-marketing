import { Request, Response, NextFunction } from 'express';
import { AppSetting } from '../models/AppSetting.ts';
import { getDbStatus } from '../config/db.ts';
import { campaignCategories, DEFAULT_TICKER_MESSAGE } from '../../shared/campaignCategories.ts';

export const publicSiteSettings = async (_req: Request, res: Response, next: NextFunction) => {
  if (!getDbStatus().isConnected) { res.status(503).json({ success: false, message: 'Website settings are temporarily unavailable.' }); return; }
  try {
    const settings: any = await AppSetting.findOne({ key: 'business' }).select('tickerMessage campaignCategories').lean().exec();
    res.json({ success: true, data: { tickerMessage: settings?.tickerMessage ?? DEFAULT_TICKER_MESSAGE, campaignCategories: campaignCategories(settings?.campaignCategories) } });
  } catch (error) { next(error); }
};
