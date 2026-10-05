import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { receiveVendorWebhook } from '../controllers/vendorWebhookController.ts';

const router = Router();
const webhookLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: true, legacyHeaders: false });

router.post('/vendor', webhookLimiter, receiveVendorWebhook);

export default router;