import { Router } from 'express';
import { getPublicCampaigns, getPublicCampaignBySlug } from '../controllers/campaignController.ts';
import { showLeadCaptureForm, submitCapturedLead } from '../controllers/leadCaptureController.ts';
import rateLimit from 'express-rate-limit';

const router = Router();

// GET /api/public/campaigns
router.get('/', getPublicCampaigns);

// GET /api/public/campaigns/:slug/go
router.get('/:slug/go', showLeadCaptureForm);
router.post('/:slug/go', rateLimit({
  windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false,
  message: 'Too many submissions. Please try again later.',
}), submitCapturedLead);

// GET /api/public/campaigns/:slug
router.get('/:slug', getPublicCampaignBySlug);

export default router;
