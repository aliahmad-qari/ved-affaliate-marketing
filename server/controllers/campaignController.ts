import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { Campaign } from '../models/Campaign.ts';
import { Partner } from '../models/Partner.ts';
import { TrackingClick } from '../models/TrackingClick.ts';
import { initialCampaignSeeds } from '../seeds/campaignSeeds.ts';
import { getDbStatus } from '../config/db.ts';

// Helper to sanitize public campaign output
const sanitizeCampaign = (campaign: any) => {
  const obj = campaign.toObject ? campaign.toObject() : { ...campaign };
  delete obj.baseTrackingUrl;
  delete obj.__v;
  delete obj.logoImage;
  return obj;
};

// Seed fallback database if empty when MongoDB is connected
export const ensureSeededData = async () => {
  try {
    const { isConnected } = getDbStatus();
    if (!isConnected) return;

    const count = await Campaign.countDocuments();
    if (count === 0) {
      console.log('[VED SEED] Seeding initial campaigns into MongoDB Atlas...');
      await Campaign.insertMany(initialCampaignSeeds);
      console.log(`[VED SEED SUCCESS] Seeded ${initialCampaignSeeds.length} campaigns.`);
    }
    await Campaign.updateOne(
      { slug: 'kotak-cherry', baseTrackingUrl: 'https://internal-tracking.vedafl.com/kotakcherry/v1' },
      { $set: { baseTrackingUrl: initialCampaignSeeds.find((campaign) => campaign.slug === 'kotak-cherry')?.baseTrackingUrl } },
    );
  } catch (err) {
    console.error('[VED SEED ERROR] Error seeding initial campaign data:', err);
  }
};

/**
 * GET /api/public/campaigns
 * Retrieves list of public campaigns with optional category, status, and search filters.
 */
export const getPublicCampaigns = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, status, featured, search } = req.query;
    const { isConnected } = getDbStatus();

    let campaigns: any[] = [];

    if (isConnected) {
      const query: Record<string, any> = {};

      // Filter by status (default: show LIVE and PAUSED, hide DRAFT and ENDED from public)
      if (status && typeof status === 'string' && status !== 'all') {
        query.status = status.toUpperCase();
      } else {
        query.status = { $in: ['LIVE', 'PAUSED'] };
      }

      if (category && typeof category === 'string' && category !== 'all') {
        query.campaignType = category;
      }

      if (featured === 'true') {
        query.isFeatured = true;
      }

      if (search && typeof search === 'string') {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { companyName: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
        ];
      }

      campaigns = await Campaign.find(query)
        .select('-baseTrackingUrl -__v')
        .sort({ isFeatured: -1, sortOrder: 1, createdAt: -1 });

      // If DB connected but empty, fall back to seeds
      if (campaigns.length === 0 && !search && !category) {
        campaigns = initialCampaignSeeds.map(sanitizeCampaign);
      }
    } else {
      // Offline fallback store
      campaigns = initialCampaignSeeds
        .filter((c) => {
          if (status && status !== 'all' && c.status !== status) return false;
          if (category && category !== 'all' && c.campaignType !== category) return false;
          if (featured === 'true' && !c.isFeatured) return false;
          if (search && typeof search === 'string') {
            const s = search.toLowerCase();
            return (
              c.name.toLowerCase().includes(s) ||
              c.companyName.toLowerCase().includes(s) ||
              c.description.toLowerCase().includes(s)
            );
          }
          return c.status === 'LIVE' || c.status === 'PAUSED';
        })
        .map(sanitizeCampaign);
    }

    res.status(200).json({
      success: true,
      count: campaigns.length,
      data: campaigns,
      meta: {
        totalSupportedCampaigns: 12,
        clientNotice: 'Campaign payouts are configured in VED and conversion status may be confirmed by the provider callback or Admin review.',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/public/campaigns/:slug
 * Retrieves single campaign details by unique slug.
 */
export const getPublicCampaignBySlug = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug } = req.params;
    const { isConnected } = getDbStatus();

    let campaign: any = null;

    if (isConnected) {
      campaign = await Campaign.findOne({ slug, status: { $in: ['LIVE', 'PAUSED'] } }).select('-baseTrackingUrl -__v');
    }

    if (!campaign) {
      campaign = initialCampaignSeeds.find((c) => c.slug === slug);
      if (campaign) {
        campaign = sanitizeCampaign(campaign);
      }
    }

    if (!campaign) {
      res.status(404).json({
        success: false,
        message: `Campaign with identifier '${slug}' was not found or is currently inactive.`,
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: campaign,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/public/campaigns/:slug/go?ref=&pid=
 * Redirects a visitor to the broker tracking URL configured by Admin, tagged with the partner's codes.
 */
export const redirectToCampaignTracking = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const codePattern = /^[A-Za-z0-9-]{3,40}$/;
    const ref = typeof req.query.ref === 'string' ? req.query.ref.trim() : '';
    const pid = typeof req.query.pid === 'string' ? req.query.pid.trim() : '';

    const campaign: any = getDbStatus().isConnected
      ? await Campaign.findOne({ slug: req.params.slug, status: 'LIVE' }).select('+baseTrackingUrl').lean().exec()
      : null;

    let target: URL | null = null;
    try {
      target = campaign?.baseTrackingUrl ? new URL(campaign.baseTrackingUrl) : null;
    } catch {
      target = null;
    }

    if (!target || !['http:', 'https:'].includes(target.protocol)) {
      res.status(404).json({ success: false, message: 'This campaign link is not active yet.' });
      return;
    }

    if (codePattern.test(ref) || codePattern.test(pid)) {
      const partner = await Partner.findOne({
        referralCode: ref.toUpperCase(),
        partnerId: pid.toUpperCase(),
        accountStatus: 'ACTIVE',
      }).select('partnerId').lean().exec();
      if (!partner) {
        res.status(400).json({ success: false, message: 'Partner attribution is invalid or inactive.' });
        return;
      }

      const clickId = crypto.randomUUID();
      await TrackingClick.create({
        clickId,
        partnerId: partner.partnerId,
        campaignId: String(campaign._id),
        campaignSlug: campaign.slug,
        payoutSnapshot: Number(campaign.payout || 0),
        currency: campaign.currency || 'INR',
        expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      });
      const isWhatsApp = ['wa.me', 'www.whatsapp.com', 'api.whatsapp.com'].includes(target.hostname.toLowerCase());
      if (isWhatsApp) {
        const message = target.searchParams.get('text') || '';
        target.searchParams.set('text', `${message}${message ? '\n\n' : ''}VED reference: ${clickId}`);
        for (const key of [...target.searchParams.keys()]) {
          if (key.toLowerCase().startsWith('utm_')) target.searchParams.delete(key);
        }
      } else {
        target.searchParams.set('ref', partner.referralCode);
        target.searchParams.set('pid', partner.partnerId);
        target.searchParams.set('partner_id', partner.partnerId);
        target.searchParams.set('campaign_id', String(campaign._id));
        target.searchParams.set('clickid', clickId);
        target.searchParams.set('click_id', clickId);
        target.searchParams.set('subid', clickId);
      }
    }
    res.redirect(302, target.toString());
  } catch (error) {
    next(error);
  }
};
