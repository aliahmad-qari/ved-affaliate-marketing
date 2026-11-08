import { Router } from 'express';
import { getPublicCampaigns, getPublicCampaignBySlug } from '../controllers/campaignController.ts';
import { continueCapturedCampaign, showLeadCaptureForm, submitCapturedLead } from '../controllers/leadCaptureController.ts';
import rateLimit from 'express-rate-limit';
import { getCampaignLogo } from '../controllers/campaignLogoController.ts';

const router = Router();

// GET /api/public/campaigns
router.get('/', getPublicCampaigns);
router.get('/logos/:id/:version', getCampaignLogo);

// GET /api/public/campaigns/:slug/go
router.get('/:slug/go', showLeadCaptureForm);
router.post('/:slug/go', rateLimit({
  windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false,
  message: 'Too many submissions. Please try again later.',
}), submitCapturedLead);
router.post('/:slug/continue', rateLimit({
  windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false,
  message: 'Too many continuation attempts. Please reopen the original campaign link.',
}), continueCapturedCampaign);

// GET /api/public/campaigns/:slug
router.get('/:slug', getPublicCampaignBySlug);

export default router;
