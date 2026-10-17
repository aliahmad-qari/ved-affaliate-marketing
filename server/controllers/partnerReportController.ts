import mongoose from 'mongoose';
import { Request, Response, NextFunction } from 'express';
import { Lead } from '../models/Lead.ts';
import { Campaign } from '../models/Campaign.ts';
import { getDbStatus } from '../config/db.ts';
import { buildAdminLeadQuery } from '../services/adminLeadQuery.ts';

export const getPartnerReportCampaigns = async (req: Request, res: Response, next: NextFunction) => {
  if (!getDbStatus().isConnected) { res.status(503).json({ success: false, message: 'Campaign reports are temporarily unavailable.' }); return; }
  try {
    const ids = await Lead.distinct('campaignId', { partnerId: req.user.partnerId });
    const data = await Campaign.find({ $or: [{ status: { $in: ['LIVE', 'PAUSED'] } }, { _id: { $in: ids.filter(id => mongoose.isValidObjectId(id)) } }, { slug: { $in: ids } }] }).select('_id slug name status').sort({ name: 1 }).lean().exec();
    res.json({ success: true, data });
  } catch (error) { next(error); }
};

const csvCell = (value: unknown) => {
  let text = value == null ? '' : String(value);
  if (/^[\s]*[=+@\-\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};
const dateText = (value: any) => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toISOString() : '';

export const downloadPartnerLeadReport = async (req: Request, res: Response, next: NextFunction) => {
  if (!getDbStatus().isConnected) { res.status(503).json({ success: false, message: 'Campaign reports are temporarily unavailable.' }); return; }
  let cursor: any;
  try {
    const query = await buildAdminLeadQuery(req.query, req.user.partnerId);
    cursor = Lead.find(query).select('leadId clientName clientMobile campaignName createdAt updatedAt status payoutSnapshot currency').sort({ createdAt: -1, _id: -1 }).lean().cursor();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="ved-my-campaign-leads.csv"');
    res.setHeader('Cache-Control', 'private, no-store');
    res.write('\uFEFF' + ['Lead ID','Customer name','Masked mobile','Campaign','Submitted at (UTC)','Last update (UTC)','Status','Payout snapshot','Currency','Approved commission snapshot (not wallet balance)','Lead payment status'].map(csvCell).join(',') + '\r\n');
    for await (const lead of cursor) {
      if (res.destroyed) break;
      const values = [lead.leadId, lead.clientName, lead.clientMobile ? `******${String(lead.clientMobile).slice(-4)}` : '', lead.campaignName, dateText(lead.createdAt), dateText(lead.updatedAt), lead.status, Number(lead.payoutSnapshot || 0), lead.currency || 'INR', ['APPROVED','PAID'].includes(lead.status) ? Number(lead.payoutSnapshot || 0) : 0, lead.status === 'PAID' ? 'PAID' : 'NOT_MARKED_PAID'];
      if (!res.write(values.map(csvCell).join(',') + '\r\n')) {
        await new Promise<void>(resolve => { const done = () => { res.off('drain', done); res.off('close', done); resolve(); }; res.once('drain', done); res.once('close', done); });
      }
    }
    res.end();
  } catch (error) { if (res.headersSent) res.destroy(error instanceof Error ? error : undefined); else next(error); }
  finally { if (cursor) await cursor.close().catch(() => {}); }
};
