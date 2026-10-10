import { Request, Response, NextFunction } from 'express';
import { Partner } from '../models/Partner.ts';
import { Lead } from '../models/Lead.ts';
import { Campaign } from '../models/Campaign.ts';
import { AuditLog } from '../models/AuditLog.ts';
import { buildAdminLeadQuery } from '../services/adminLeadQuery.ts';

export const getLeadCampaignOptions = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await Campaign.find({}).select('_id slug name status').sort({ name: 1 }).lean().exec();
    res.json({ success: true, data });
  } catch (error) { next(error); }
};

export const getPartnerLeadLedger = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partner: any = await Partner.findById(req.params.id).select('partnerId fullName').lean().exec();
    if (!partner) { res.status(404).json({ success: false, message: 'Partner not found.' }); return; }
    const query = await buildAdminLeadQuery(req.query, partner.partnerId);
    const page = Math.max(1, parseInt(String(req.query.page || 1), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || 20), 10) || 20));
    const [leads, total, counts] = await Promise.all([
      Lead.find(query).select('_id leadId campaignId campaignName clientName clientMobile accountId payoutSnapshot status createdAt rejectionReason').sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
      Lead.countDocuments(query),
      Lead.aggregate([{ $match: { partnerId: partner.partnerId } }, { $group: { _id: '$status', count: { $sum: 1 } } }]).exec(),
    ]);
    const summary = Object.fromEntries(['PENDING','VERIFIED','APPROVED','REJECTED','PAID'].map(status => [status, 0]));
    let all = 0;
    for (const row of counts) { summary[row._id] = Number(row.count); all += Number(row.count); }
    res.json({ success: true, partner: { _id: partner._id, fullName: partner.fullName, partnerId: partner.partnerId }, summary: { ALL: all, ...summary }, data: leads.map(lead => ({ ...lead, clientMobile: lead.clientMobile ? `******${String(lead.clientMobile).slice(-4)}` : '' })), total, page, totalPages: Math.ceil(total / limit) || 1 });
  } catch (error) { next(error); }
};

// Only stored audit events are shown: historical gaps are not reconstructed or invented.
export const getAdminLeadDetail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const lead: any = await Lead.findById(req.params.id).lean().exec();
    if (!lead) { res.status(404).json({ success: false, message: 'Lead not found.' }); return; }
    const [partner, audits] = await Promise.all([
      Partner.findOne({ partnerId: lead.partnerId }).select('fullName').lean().exec(),
      AuditLog.find({ entityType: 'Lead', entityId: String(lead._id) }).select('action adminEmail createdAt before after').sort({ createdAt: 1, _id: 1 }).lean().exec(),
    ]);
    const snapshot = (value: any) => Object.fromEntries(['status','payoutSnapshot','rejectionReason','processStatus'].filter(key => value?.[key] !== undefined).map(key => [key, value[key]]));
    res.json({ success: true, data: { ...lead, referringPartnerName: partner?.fullName || null }, history: audits.map(row => ({ _id: row._id, action: row.action, adminEmail: row.adminEmail, createdAt: row.createdAt, before: snapshot(row.before), after: snapshot(row.after) })) });
  } catch (error) { next(error); }
};
