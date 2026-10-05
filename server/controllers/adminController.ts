import { Request, Response, NextFunction } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import { fileTypeFromBuffer } from 'file-type';
import { Campaign } from '../models/Campaign.ts';
import { Partner } from '../models/Partner.ts';
import { SupportTicket } from '../models/SupportTicket.ts';
import { AppSetting } from '../models/AppSetting.ts';
import { Notification } from '../models/Notification.ts';
import { AuditLog } from '../models/AuditLog.ts';
import { Lead } from '../models/Lead.ts';
import { notifyPartners, writeAudit } from '../services/adminServices.ts';

const campaignFields = ['name', 'slug', 'companyName', 'campaignType', 'description', 'requiredAction', 'payout', 'currency', 'payoutTerms', 'rules', 'terms', 'status', 'logoUrl', 'baseTrackingUrl', 'startDate', 'endDate', 'isFeatured', 'sortOrder'];
const termFields = ['eligibility', 'validationRejection', 'payoutTimeline', 'duplicateFraudRules'] as const;
const cleanCampaignInput = (body: Record<string, any>) => {
  const input: Record<string, any> = Object.fromEntries(
    campaignFields.filter((field) => body[field] !== undefined).map((field) => [field, body[field]]),
  );
  if (input.terms !== undefined) {
    const source = input.terms && typeof input.terms === 'object' ? input.terms : {};
    input.terms = Object.fromEntries(
      termFields.map((field) => [field, typeof source[field] === 'string' ? source[field].trim().slice(0, 2000) : '']),
    );
  }
  // The form sends '' for unset dates, which Mongoose cannot cast.
  if (input.startDate === '') delete input.startDate;
  if (input.endDate === '') input.endDate = null;
  return input;
};

const validPayoutAmount = (payout: number): boolean =>
  Number.isFinite(payout) && payout >= 0 && Math.abs(payout * 100 - Math.round(payout * 100)) < 1e-6;

const pageOptions = (req: Request) => {
  const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit || '50'), 10) || 50));
  return { page, limit, skip: (page - 1) * limit };
};

const validHttpUrl = (value: string): boolean => {
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
};

// Seeded campaigns store site-relative logo paths such as /logos/angelone.svg.
const validLogoUrl = (value: string): boolean => /^\/(?!\/)[\w./-]*$/.test(value) || validHttpUrl(value);

const serializeAdminCampaign = (campaign: any) => {
  const serialized = campaign.toObject({ transform: false });
  delete serialized.__v;
  return serialized;
};

export const getAdminCampaigns = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const campaigns = await Campaign.find().select('+baseTrackingUrl').sort({ sortOrder: 1, createdAt: -1 }).exec();
    res.json({ success: true, data: campaigns.map(serializeAdminCampaign) });
  } catch (error) { next(error); }
};

export const createAdminCampaign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const input = cleanCampaignInput(req.body);
    if (input.payout !== undefined && input.payout !== null) {
      const payout = Number(input.payout);
      if (!validPayoutAmount(payout)) {
        res.status(400).json({ success: false, message: 'Payout must be a non-negative amount with at most two decimals.' });
        return;
      }
      input.payout = Math.round(payout * 100) / 100;
    }
    if (input.logoUrl && !validLogoUrl(input.logoUrl)) {
      res.status(400).json({ success: false, message: 'Campaign logo URL must be HTTP, HTTPS, or a site path starting with /.' });
      return;
    }
    if (input.baseTrackingUrl && !validHttpUrl(input.baseTrackingUrl)) {
      res.status(400).json({ success: false, message: 'Base tracking URL must be HTTP or HTTPS.' });
      return;
    }
    const campaign = await Campaign.create(input);
    await writeAudit(req, 'CAMPAIGN_CREATED', 'Campaign', String(campaign._id), undefined, { name: campaign.name, payout: campaign.payout });
    if (campaign.status === 'LIVE') {
      const partners = await Partner.find({ accountStatus: 'ACTIVE' }).select('partnerId').lean().exec();
      await notifyPartners(partners.map((partner) => partner.partnerId), 'NEW_CAMPAIGN', 'New campaign available', `${campaign.name} is now available.` , 'CAMPAIGN', String(campaign._id));
    }
    res.status(201).json({ success: true, data: serializeAdminCampaign(campaign) });
  } catch (error) { next(error); }
};

export const updateAdminCampaign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const updates = cleanCampaignInput(req.body);
    if (updates.payout !== undefined && updates.payout !== null) {
      const payout = Number(updates.payout);
      if (!validPayoutAmount(payout)) {
        res.status(400).json({ success: false, message: 'Payout must be a non-negative amount with at most two decimals.' });
        return;
      }
      updates.payout = Math.round(payout * 100) / 100;
    }
    if (updates.logoUrl && !validLogoUrl(updates.logoUrl)) {
      res.status(400).json({ success: false, message: 'Campaign logo URL must be HTTP, HTTPS, or a site path starting with /.' });
      return;
    }
    if (updates.baseTrackingUrl && !validHttpUrl(updates.baseTrackingUrl)) {
      res.status(400).json({ success: false, message: 'Base tracking URL must be HTTP or HTTPS.' });
      return;
    }
    const before: any = await Campaign.findById(req.params.id).select('+baseTrackingUrl').exec();
    if (!before) {
      res.status(404).json({ success: false, message: 'Campaign not found.' });
      return;
    }
    const oldPayout = before.payout;
    const campaign: any = await Campaign.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true }).select('+baseTrackingUrl').exec();
    await writeAudit(req, 'CAMPAIGN_UPDATED', 'Campaign', String(campaign._id), { name: before.name, payout: oldPayout, status: before.status }, { name: campaign.name, payout: campaign.payout, status: campaign.status });
    if (updates.payout !== undefined && updates.payout !== oldPayout) {
      const partners = await Partner.find({ accountStatus: 'ACTIVE' }).select('partnerId').lean().exec();
      await notifyPartners(partners.map((partner) => partner.partnerId), 'CAMPAIGN_RATE_CHANGE', 'Campaign payout updated', `${campaign.name} payout terms have changed.`, 'CAMPAIGN', String(campaign._id));
    }
    if (updates.status === 'LIVE' && before.status !== 'LIVE') {
      const partners = await Partner.find({ accountStatus: 'ACTIVE' }).select('partnerId').lean().exec();
      await notifyPartners(partners.map((partner) => partner.partnerId), 'NEW_CAMPAIGN', 'Campaign is now live', `${campaign.name} is now available.`, 'CAMPAIGN', String(campaign._id));
    }
    res.json({ success: true, data: serializeAdminCampaign(campaign) });
  } catch (error) { next(error); }
};

export const archiveAdminCampaign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const campaign: any = await Campaign.findById(req.params.id).select('+baseTrackingUrl').exec();
    if (!campaign) {
      res.status(404).json({ success: false, message: 'Campaign not found.' });
      return;
    }
    const previousStatus = campaign.status;
    campaign.status = 'ENDED';
    await campaign.save();
    await writeAudit(req, 'CAMPAIGN_ARCHIVED', 'Campaign', String(campaign._id), { status: previousStatus }, { status: 'ENDED' });
    res.json({ success: true, data: serializeAdminCampaign(campaign) });
  } catch (error) { next(error); }
};

export const uploadCampaignLogo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const campaign: any = await Campaign.findById(req.params.id).exec();
    if (!campaign) {
      res.status(404).json({ success: false, message: 'Campaign not found.' });
      return;
    }
    if (!req.file || req.file.size > 3 * 1024 * 1024) {
      res.status(400).json({ success: false, message: 'Provide an image file no larger than 3 MB.' });
      return;
    }
    const fileType = await fileTypeFromBuffer(req.file.buffer);
    if (!fileType || !['image/png', 'image/jpeg', 'image/webp'].includes(fileType.mime)) {
      res.status(400).json({ success: false, message: 'Only verified PNG, JPEG, and WebP images are accepted.' });
      return;
    }
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      res.status(503).json({ success: false, message: 'Campaign image storage is not configured.' });
      return;
    }
    cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET });
    const uploaded: any = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ folder: 'ved-affiliate/campaigns', resource_type: 'image', allowed_formats: ['png', 'jpg', 'jpeg', 'webp'] }, (error, result) => error ? reject(error) : resolve(result));
      stream.end(req.file!.buffer);
    });
    const oldUrl = campaign.logoUrl;
    campaign.logoUrl = uploaded.secure_url;
    await campaign.save();
    await writeAudit(req, 'CAMPAIGN_LOGO_UPDATED', 'Campaign', String(campaign._id), { logoUrl: oldUrl }, { logoUrl: campaign.logoUrl });
    res.json({ success: true, data: serializeAdminCampaign(campaign) });
  } catch (error) { next(error); }
};

export const listAdminPartners = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page, limit, skip } = pageOptions(req);
    const query: Record<string, any> = {};
    if (typeof req.query.status === 'string') query.accountStatus = req.query.status.toUpperCase();
    if (typeof req.query.kycStatus === 'string') query.kycStatus = req.query.kycStatus.toUpperCase();
    if (typeof req.query.search === 'string' && req.query.search.trim()) {
      const value = req.query.search.trim().slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [{ fullName: new RegExp(value, 'i') }, { email: new RegExp(value, 'i') }, { partnerId: new RegExp(value, 'i') }, { mobile: new RegExp(value, 'i') }];
    }
    const [docs, total] = await Promise.all([Partner.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(), Partner.countDocuments(query)]);
    const performanceRows = await Lead.aggregate([
      { $match: { partnerId: { $in: docs.map((doc) => doc.partnerId) } } },
      { $group: { _id: '$partnerId', totalLeads: { $sum: 1 }, approvedLeads: { $sum: { $cond: [{ $in: ['$status', ['APPROVED', 'PAID']] }, 1, 0] } }, pendingLeads: { $sum: { $cond: [{ $in: ['$status', ['PENDING', 'VERIFIED']] }, 1, 0] } }, earnings: { $sum: { $cond: [{ $in: ['$status', ['APPROVED', 'PAID']] }, '$payoutSnapshot', 0] } } } },
    ]).exec();
    const performance = new Map(performanceRows.map((row: any) => [row._id, row]));
    res.json({ success: true, data: docs.map((doc) => ({ ...doc.toJSON(), performance: performance.get(doc.partnerId) || { totalLeads: 0, approvedLeads: 0, pendingLeads: 0, earnings: 0 } })), total, page, totalPages: Math.ceil(total / limit) || 1 });
  } catch (error) { next(error); }
};

export const getAdminPartnerKyc = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const partner: any = await Partner.findById(req.params.id).select('+pan +bankDetails.accountNumber').exec();
    if (!partner) {
      res.status(404).json({ success: false, message: 'Partner not found.' });
      return;
    }
    await writeAudit(req, 'PARTNER_KYC_VIEWED', 'Partner', String(partner._id));
    res.json({ success: true, data: { partnerId: partner.partnerId, fullName: partner.fullName, pan: partner.pan, bankDetails: partner.bankDetails, kycStatus: partner.kycStatus } });
  } catch (error) { next(error); }
};

export const updateAdminPartner = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const allowedStatuses = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING'];
    const allowedKyc = ['PENDING', 'VERIFIED', 'REJECTED'];
    const update: Record<string, any> = {};
    if (req.body.accountStatus !== undefined && allowedStatuses.includes(req.body.accountStatus)) update.accountStatus = req.body.accountStatus;
    else if (req.body.accountStatus !== undefined) {
      res.status(400).json({ success: false, message: 'Invalid account status.' });
      return;
    }
    if (req.body.kycStatus !== undefined && allowedKyc.includes(req.body.kycStatus)) {
      update.kycStatus = req.body.kycStatus;
      update.kycRejectionReason = req.body.kycStatus === 'REJECTED' ? String(req.body.kycRejectionReason || '').trim().slice(0, 1000) : '';
      if (req.body.kycStatus === 'REJECTED' && !update.kycRejectionReason) {
        res.status(400).json({ success: false, message: 'A rejection reason is required.' });
        return;
      }
    } else if (req.body.kycStatus !== undefined) {
      res.status(400).json({ success: false, message: 'Invalid KYC status.' });
      return;
    }
    if (!Object.keys(update).length) {
      res.status(400).json({ success: false, message: 'No valid partner status changes were provided.' });
      return;
    }
    const before: any = await Partner.findById(req.params.id).exec();
    if (!before) {
      res.status(404).json({ success: false, message: 'Partner not found.' });
      return;
    }
    const partner: any = await Partner.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true }).exec();
    if (before.accountStatus !== partner.accountStatus && partner.accountStatus === 'SUSPENDED') {
      await Partner.updateOne({ _id: partner._id }, { $set: { sessionsInvalidatedAt: new Date() } }).exec();
    }
    await writeAudit(req, 'PARTNER_STATUS_UPDATED', 'Partner', String(partner._id), { accountStatus: before.accountStatus, kycStatus: before.kycStatus }, { accountStatus: partner.accountStatus, kycStatus: partner.kycStatus });
    await notifyPartners([partner.partnerId], 'ACCOUNT_UPDATE', 'Partner account updated', `Your account/KYC status is now ${partner.accountStatus} / ${partner.kycStatus}.`, 'PARTNER', String(partner._id));
    res.json({ success: true, data: partner.toJSON() });
  } catch (error) { next(error); }
};

export const getBusinessSettings = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const settings = await AppSetting.findOneAndUpdate({ key: 'business' }, { $setOnInsert: { minimumWithdrawalAmount: 200 } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean().exec();
    res.json({ success: true, data: settings });
  } catch (error) { next(error); }
};

export const updateBusinessSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const amount = Number(req.body.minimumWithdrawalAmount);
    if (!Number.isFinite(amount) || amount < 1 || Math.round(amount * 100) !== amount * 100) {
      res.status(400).json({ success: false, message: 'Minimum withdrawal must be at least ₹1 with no more than two decimals.' });
      return;
    }
    const previous: any = await AppSetting.findOne({ key: 'business' }).lean().exec();
    const settings = await AppSetting.findOneAndUpdate({ key: 'business' }, { $set: { minimumWithdrawalAmount: amount, updatedBy: String(req.user._id) } }, { upsert: true, new: true, runValidators: true }).lean().exec();
    await writeAudit(req, 'BUSINESS_SETTINGS_UPDATED', 'AppSetting', 'business', { minimumWithdrawalAmount: previous?.minimumWithdrawalAmount || 200 }, { minimumWithdrawalAmount: amount });
    res.json({ success: true, data: settings });
  } catch (error) { next(error); }
};

export const listAdminSupportTickets = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page, limit, skip } = pageOptions(req);
    const query: Record<string, any> = {};
    if (typeof req.query.status === 'string' && req.query.status !== 'ALL') query.status = req.query.status;
    const [data, total] = await Promise.all([SupportTicket.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean().exec(), SupportTicket.countDocuments(query)]);
    res.json({ success: true, data, total, page, totalPages: Math.ceil(total / limit) || 1 });
  } catch (error) { next(error); }
};

export const updateAdminSupportTicket = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const statuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
    if (!statuses.includes(req.body.status)) {
      res.status(400).json({ success: false, message: 'Invalid support ticket status.' });
      return;
    }
    const ticket: any = await SupportTicket.findById(req.params.id).exec();
    if (!ticket) {
      res.status(404).json({ success: false, message: 'Support ticket not found.' });
      return;
    }
    const previous = ticket.status;
    ticket.status = req.body.status;
    ticket.adminResponse = typeof req.body.adminResponse === 'string' ? req.body.adminResponse.trim().slice(0, 4000) : ticket.adminResponse;
    ticket.updatedBy = String(req.user._id);
    await ticket.save();
    await writeAudit(req, 'SUPPORT_TICKET_UPDATED', 'SupportTicket', String(ticket._id), { status: previous }, { status: ticket.status });
    res.json({ success: true, data: ticket.toJSON() });
  } catch (error) { next(error); }
};

export const getAuditLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { limit } = pageOptions(req);
    const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(limit).lean().exec();
    res.json({ success: true, data: logs });
  } catch (error) { next(error); }
};