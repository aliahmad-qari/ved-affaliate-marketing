import { Router } from 'express';
import {
  getProfile,
  updateProfile,
  changePassword,
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
} from '../controllers/partnerDataController.ts';
import { requireAuth } from '../middleware/authMiddleware.ts';

const router = Router();

// All partner routes require authentication
router.use(requireAuth);

// Milestone 3: Dashboard & Financial Endpoints
router.get('/dashboard', getDashboard);
router.get('/campaigns', getPartnerCampaigns);
router.post('/leads', submitLead);
router.get('/leads', getPartnerLeads);
router.get('/earnings', getPartnerEarnings);
router.get('/wallet', getPartnerWallet);
router.post('/wallet/withdraw', requestWithdrawal);
router.get('/referrals', getPartnerReferrals);

// Milestone 2: Profile & Security Endpoints
router.get('/profile', getProfile);
router.patch('/profile', updateProfile);
router.patch('/password', changePassword);

export default router;
