import mongoose from 'mongoose';
import { Request, Response, NextFunction } from 'express';
import { Campaign } from '../models/Campaign.ts';
import { getDbStatus } from '../config/db.ts';

export const getCampaignLogo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (!mongoose.isObjectIdOrHexString(req.params.id) || !/^[0-9a-f-]{36}$/i.test(req.params.version)) {
    res.status(404).end();
    return;
  }
  if (!getDbStatus().isConnected) {
    res.status(503).end();
    return;
  }
  try {
    const campaign: any = await Campaign.findOne({ _id: req.params.id, 'logoImage.version': req.params.version }).select('+logoImage').exec();
    const image = campaign?.logoImage;
    if (!image?.data || !['image/png', 'image/jpeg', 'image/webp'].includes(image.contentType)) {
      res.status(404).end();
      return;
    }
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.set('Content-Disposition', 'inline');
    res.type(image.contentType).send(image.data);
  } catch (error) { next(error); }
};
