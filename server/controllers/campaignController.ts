import { Request, Response, NextFunction } from 'express';
import { Campaign } from '../models/Campaign.ts';
import { initialCampaignSeeds } from '../seeds/campaignSeeds.ts';
import { getDbStatus } from '../config/db.ts';

// Helper to sanitize public campaign output
const sanitizeCampaign = (campaign: any) => {
  const obj = campaign.toObject ? campaign.toObject() : { ...campaign };
  delete obj.baseTrackingUrl;
  delete obj.__v;
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
        clientNotice: 'Campaign payouts are configured and verified by Admin upon lead submission.',
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
