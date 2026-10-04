import { Router } from 'express';
import { sendAdminNotification, listAdminAnnouncements, saveAdminAnnouncement, listAdminNotifications } from '../controllers/adminCommunicationController.ts';
import { requireAuth, requireRole } from '../middleware/authMiddleware.ts';

const router = Router();
router.use(requireAuth, requireRole('ADMIN'));
router.get('/announcements', listAdminAnnouncements);
router.post('/announcements', saveAdminAnnouncement);
router.patch('/announcements/:id', saveAdminAnnouncement);
router.get('/notifications', listAdminNotifications);
router.post('/notifications', sendAdminNotification);
export default router;