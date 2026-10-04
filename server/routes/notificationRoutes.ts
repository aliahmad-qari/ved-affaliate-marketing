import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware.ts';
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '../controllers/notificationController.ts';

const router = Router();
router.use(requireAuth, requireRole('PARTNER'));
router.get('/', listNotifications);
router.patch('/read-all', markAllNotificationsRead);
router.patch('/:id/read', markNotificationRead);
export default router;