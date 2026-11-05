import crypto from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { Campaign } from '../models/Campaign.ts';
import { Lead } from '../models/Lead.ts';
import { PartnerSubTeamLink } from '../models/PartnerSubTeamLink.ts';
import { buildSubTeamTrackingUrl, summarizeSubTeamLinks } from '../services/subTeamAttribution.ts';

const ownerId = (req: Request) => String(req.user?.partnerId || '').toUpperCase();
const cleanName = (value: unknown) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';

function publicBaseUrl(req: Request): string {
  const configured = (process.env.FRONTEND_URL || '').split(',')[0].trim().replace(/\/$/, '');
  if (configured) {
    try {
      const parsed = new URL(configured);
      if (['http:', 'https:'].includes(parsed.protocol)) return parsed.origin;
    } catch { /* Fall through to the current app origin. */ }
  }
  const forwarded = req.get('x-forwarded-proto')?.split(',')[0].trim();
  const protocol = forwarded === 'https' || req.protocol === 'https' ? 'https' : 'http';
  return `${protocol}://${req.get('host') || 'localhost'}`;
}

function serialize(link: any, baseUrl: string, partner: any, stats: any, campaignName = link.campaignSlug) {
  const { trackingId, ...safeLink } = link;
  return {
    ...safeLink,
    campaignName,
    trackingUrl: link.status === 'ACTIVE'
      ? buildSubTeamTrackingUrl(baseUrl, link.campaignSlug, partner.referralCode, partner.partnerId, trackingId)
      : undefined,
    leads: stats?.leads || 0,
    approvedConversions: stats?.approvedConversions || 0,
    attributedEarnings: Math.round((stats?.attributedEarnings || 0) * 100) / 100,
  };
}

export const listPartnerSubTeamLinks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const partnerId = ownerId(req);
    const partner: any = req.user;
    const links = await PartnerSubTeamLink.find({ partnerId }).sort({ createdAt: -1 }).lean().exec();
    const ids = links.map(link => String(link._id));
    const campaigns = links.length ? await Campaign.find({ _id: { $in: [...new Set(links.map(link => link.campaignId))] } }).select('_id name').lean().exec() : [];
    const campaignNames = new Map(campaigns.map(campaign => [String(campaign._id), campaign.name]));
    const leads = ids.length ? await Lead.find({ partnerId, subTeamLinkId: { $in: ids } })
      .select('subTeamLinkId status payoutSnapshot').lean().exec() : [];
    const stats = new Map(summarizeSubTeamLinks(links, leads).map(item => [String(item._id), item]));
    res.set('Cache-Control', 'private, no-store');
    res.json({ success: true, data: links.map(link => serialize(link, publicBaseUrl(req), partner, stats.get(String(link._id)), campaignNames.get(link.campaignId))) });
  } catch (error) { next(error); }
};

export const createPartnerSubTeamLink = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const name = cleanName(req.body?.name);
  const campaignInput = typeof req.body?.campaignId === 'string' ? req.body.campaignId.trim() : '';
  if (name.length < 2 || name.length > 60 || !campaignInput) {
    res.status(400).json({ success: false, message: 'Enter a link name from 2 to 60 characters and choose a campaign.' }); return;
  }
  try {
    const campaign: any = await Campaign.findOne({
      $or: [{ slug: campaignInput.toLowerCase() }, ...( /^[a-f\d]{24}$/i.test(campaignInput) ? [{ _id: campaignInput }] : [])],
      status: 'LIVE',
    }).select('_id slug name status').lean().exec();
    if (!campaign) { res.status(400).json({ success: false, message: 'Choose a currently live campaign.' }); return; }
    const partner: any = req.user;
    let link: any;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        [link] = await PartnerSubTeamLink.create([{
          partnerId: ownerId(req), campaignId: String(campaign._id), campaignSlug: campaign.slug,
          name, trackingId: crypto.randomBytes(32).toString('base64url'), status: 'ACTIVE', clickCount: 0,
        }]);
        break;
      } catch (error: any) {
        if (error?.code !== 11000 || attempt === 2) throw error;
      }
    }
    res.status(201).json({ success: true, data: serialize(link.toObject(), publicBaseUrl(req), partner, null, campaign.name) });
  } catch (error) { next(error); }
};

export const updatePartnerSubTeamLink = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const updates: Record<string, unknown> = {};
  if (req.body?.name !== undefined) {
    const name = cleanName(req.body.name);
    if (name.length < 2 || name.length > 60) { res.status(400).json({ success: false, message: 'Link name must be 2 to 60 characters.' }); return; }
    updates.name = name;
  }
  if (req.body?.status !== undefined) {
    if (!['ACTIVE', 'ARCHIVED'].includes(req.body.status)) { res.status(400).json({ success: false, message: 'Status must be ACTIVE or ARCHIVED.' }); return; }
    updates.status = req.body.status;
  }
  if (!Object.keys(updates).length) { res.status(400).json({ success: false, message: 'Provide a new name or status.' }); return; }
  try {
    const link = await PartnerSubTeamLink.findOneAndUpdate(
      { _id: req.params.id, partnerId: ownerId(req) }, { $set: updates }, { new: true, runValidators: true },
    ).lean().exec();
    if (!link) { res.status(404).json({ success: false, message: 'Sub-team link not found.' }); return; }
    const campaign: any = await Campaign.findById(link.campaignId).select('name').lean().exec();
    res.json({ success: true, data: serialize(link, publicBaseUrl(req), req.user, null, campaign?.name || link.campaignSlug) });
  } catch (error) { next(error); }
};
