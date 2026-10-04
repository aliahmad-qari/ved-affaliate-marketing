import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { adminLogin, adminMe } from '../controllers/adminAuthController.ts';
import { requireAuth, requireRole } from '../middleware/authMiddleware.ts';

const router = Router();
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', loginLimiter, adminLogin);
router.get('/me', requireAuth, requireRole('ADMIN'), adminMe);

export default router;