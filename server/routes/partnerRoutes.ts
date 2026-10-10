import { Router } from 'express';
import {
  getProfile,
  updateProfile,
  changePassword,
  submitKyc,
} from '../controllers/partnerController.ts';
import {
  getDashboard,
  getPartnerCampaigns,
  submitLead,
  getPartnerLeads,
  getPartnerEarnings,
  getPartnerWallet,
  requestWithdrawal,
  getPartnerReferrals,
  updateLead,
} from '../controllers/partnerDataController.ts';
import { requireAuth, requireRole } from '../middleware/authMiddleware.ts';
import notificationRoutes from './notificationRoutes.ts';

const router = Router();

// All partner routes require authentication
router.use(requireAuth, requireRole('PARTNER'));

// Milestone 3: Dashboard & Financial Endpoints
router.get('/dashboard', getDashboard);
router.get('/campaigns', getPartnerCampaigns);
router.post('/leads', submitLead);
router.get('/leads', getPartnerLeads);
router.patch('/leads/:leadId', updateLead); // Update existing lead (works on LIVE and PAUSED campaigns)
router.get('/earnings', getPartnerEarnings);
router.get('/wallet', getPartnerWallet);
router.post('/wallet/withdraw', requestWithdrawal);
router.get('/referrals', getPartnerReferrals);
router.use('/notifications', notificationRoutes);

// Milestone 2: Profile & Security Endpoints
router.get('/profile', getProfile);
router.patch('/profile', updateProfile);
router.post('/kyc', submitKyc);
router.patch('/password', changePassword);

export default router;
