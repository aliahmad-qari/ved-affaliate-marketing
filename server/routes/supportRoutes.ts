import { Router } from 'express';
import { createSupportTicket } from '../controllers/supportController.ts';

const router = Router();

// POST /api/public/support/tickets
router.post('/tickets', createSupportTicket);

export default router;
