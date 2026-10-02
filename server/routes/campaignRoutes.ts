import { Router } from 'express';
import { getPublicCampaigns, getPublicCampaignBySlug } from '../controllers/campaignController.ts';

const router = Router();

// GET /api/public/campaigns
router.get('/', getPublicCampaigns);

// GET /api/public/campaigns/:slug
router.get('/:slug', getPublicCampaignBySlug);

export default router;
