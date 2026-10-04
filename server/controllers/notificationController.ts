import { Request, Response, NextFunction } from 'express';
import { Notification } from '../models/Notification.ts';

export const listNotifications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const partnerId = String(req.user.partnerId);
    const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit || '30'), 10) || 30));
    const [data, unreadCount, total] = await Promise.all([
      Notification.find({ partnerId }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
      Notification.countDocuments({ partnerId, readAt: { $exists: false } }),
      Notification.countDocuments({ partnerId }),
    ]);
    res.json({ success: true, data, unreadCount, total, page });
  } catch (error) { next(error); }
};

export const markNotificationRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, partnerId: String(req.user.partnerId) },
      { $set: { readAt: new Date() } },
      { new: true },
    ).lean().exec();
    if (!notification) {
      res.status(404).json({ success: false, message: 'Notification not found.' });
      return;
    }
    res.json({ success: true, data: notification });
  } catch (error) { next(error); }
};

export const markAllNotificationsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await Notification.updateMany({ partnerId: String(req.user.partnerId), readAt: { $exists: false } }, { $set: { readAt: new Date() } }).exec();
    res.json({ success: true });
  } catch (error) { next(error); }
};