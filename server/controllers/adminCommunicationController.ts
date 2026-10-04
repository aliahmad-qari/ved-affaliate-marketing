import { Request, Response, NextFunction } from 'express';
import { Announcement } from '../models/Announcement.ts';
import { Notification } from '../models/Notification.ts';
import { Partner } from '../models/Partner.ts';
import { writeAudit, notifyPartners } from '../services/adminServices.ts';

const notificationTypes = ['NEW_CAMPAIGN', 'CAMPAIGN_RATE_CHANGE', 'LEAD_UPDATE', 'PAYMENT_UPDATE', 'WITHDRAWAL_UPDATE', 'ANNOUNCEMENT', 'ACCOUNT_UPDATE'];

export const sendAdminNotification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { type, title, message, partnerId, partnerIds, allActive } = req.body;
    if (!notificationTypes.includes(type) || typeof title !== 'string' || !title.trim() || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ success: false, message: 'Valid type, title, and message are required.' });
      return;
    }
    let ids: string[] = [];
    if (allActive === true) {
      ids = (await Partner.find({ accountStatus: 'ACTIVE' }).select('partnerId').lean().exec()).map((partner) => partner.partnerId);
    } else if (Array.isArray(partnerIds)) {
      ids = partnerIds.filter((id: unknown) => typeof id === 'string').slice(0, 1000);
    } else if (typeof partnerId === 'string') {
      ids = [partnerId];
    }
    const existing = await Partner.find({ partnerId: { $in: ids } }).select('partnerId').lean().exec();
    const validIds = existing.map((partner) => partner.partnerId);
    await notifyPartners(validIds, type, title.trim().slice(0, 140), message.trim().slice(0, 2000));
    await writeAudit(req, 'NOTIFICATION_SENT', 'Notification', 'broadcast', undefined, { type, recipientCount: validIds.length });
    res.status(201).json({ success: true, recipientCount: validIds.length });
  } catch (error) { next(error); }
};

export const listAdminAnnouncements = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await Announcement.find().sort({ createdAt: -1 }).limit(200).lean().exec();
    res.json({ success: true, data });
  } catch (error) { next(error); }
};

export const saveAdminAnnouncement = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { title, message } = req.body;
    if (typeof title !== 'string' || title.trim().length < 2 || typeof message !== 'string' || message.trim().length < 2) {
      res.status(400).json({ success: false, message: 'Title and message are required.' });
      return;
    }
    const announcement: any = req.params.id
      ? await Announcement.findById(req.params.id).exec()
      : new Announcement({ createdBy: String(req.user._id) });
    if (!announcement) {
      res.status(404).json({ success: false, message: 'Announcement not found.' });
      return;
    }
    const wasPublished = announcement.status === 'PUBLISHED';
    const startsAt = req.body.startsAt ? new Date(req.body.startsAt) : announcement.startsAt;
    if (req.body.startsAt && Number.isNaN(startsAt.getTime())) {
      res.status(400).json({ success: false, message: 'Invalid announcement start date.' });
      return;
    }
    const nextStatus = req.body.status ?? announcement.status;
    if (nextStatus === 'PUBLISHED' && startsAt && startsAt > new Date()) {
      res.status(400).json({ success: false, message: 'Future-scheduled announcements are not supported; publish when ready.' });
      return;
    }
    announcement.title = title.trim().slice(0, 140);
    announcement.message = message.trim().slice(0, 4000);
    if (req.body.startsAt) announcement.startsAt = startsAt;
    if (req.body.endsAt) announcement.endsAt = new Date(req.body.endsAt);
    if (req.body.status !== undefined) {
      if (!['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(req.body.status)) {
        res.status(400).json({ success: false, message: 'Invalid announcement status.' });
        return;
      }
      announcement.status = req.body.status;
    }
    await announcement.save();
    await writeAudit(req, 'ANNOUNCEMENT_SAVED', 'Announcement', String(announcement._id), undefined, { status: announcement.status, title: announcement.title });
    const inWindow = (!announcement.startsAt || announcement.startsAt <= new Date()) && (!announcement.endsAt || announcement.endsAt >= new Date());
    if (announcement.status === 'PUBLISHED' && inWindow && !wasPublished) {
      const partners = await Partner.find({ accountStatus: 'ACTIVE' }).select('partnerId').lean().exec();
      await notifyPartners(partners.map((partner) => partner.partnerId), 'ANNOUNCEMENT', announcement.title, announcement.message, 'ANNOUNCEMENT', String(announcement._id));
    }
    res.status(200).json({ success: true, data: announcement.toJSON() });
  } catch (error) { next(error); }
};

export const listAdminNotifications = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await Notification.find().sort({ createdAt: -1 }).limit(300).lean().exec();
    res.json({ success: true, data });
  } catch (error) { next(error); }
};