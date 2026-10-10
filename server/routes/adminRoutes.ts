import { Router } from 'express';
import multer from 'multer';
import { requireAuth, requireRole } from '../middleware/authMiddleware.ts';
import {
  archiveAdminCampaign,
  createAdminCampaign,
  getAdminCampaigns,
  getAdminPartnerKyc,
  getAuditLogs,
  getBusinessSettings,
  listAdminPartners,
  listAdminReferrals,
  listAdminSupportTickets,
  updateAdminCampaign,
  updateAdminPartner,
  updateAdminSupportTicket,
  updateBusinessSettings,
  uploadCampaignLogo,
} from '../controllers/adminController.ts';
import { adjustAdminLeadPayout, getAdminDashboard, listAdminLeads, markAdminLeadPaid, reviewAdminLead } from '../controllers/adminLeadController.ts';
import { listWithdrawals, updateWithdrawal } from '../controllers/adminWithdrawalController.ts';
import { sendAdminNotification, listAdminAnnouncements, saveAdminAnnouncement, listAdminNotifications } from '../controllers/adminCommunicationController.ts';
import { exportAdminCampaignWorkbook, exportAdminReport } from '../controllers/adminReportController.ts';
import { updateEnquiryProcess } from '../controllers/adminEnquiryController.ts';
import { getLeadCampaignOptions, getPartnerLeadLedger, getAdminLeadDetail } from '../controllers/adminPartnerLedgerController.ts';

const router = Router();
const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, callback) {
    callback(null, ['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype));
  },
});

router.use(requireAuth, requireRole('ADMIN'));
router.get('/dashboard', getAdminDashboard);
router.get('/campaigns', getAdminCampaigns);
router.post('/campaigns', createAdminCampaign);
router.patch('/campaigns/:id', updateAdminCampaign);
router.delete('/campaigns/:id', archiveAdminCampaign);
router.post('/campaigns/:id/logo', logoUpload.single('logo'), uploadCampaignLogo);
router.get('/partners', listAdminPartners);
router.get('/referrals', listAdminReferrals);
router.get('/partners/:id/kyc', getAdminPartnerKyc);
router.get('/partners/:id/leads', getPartnerLeadLedger);
router.patch('/partners/:id', updateAdminPartner);
router.get('/leads', listAdminLeads);
router.get('/lead-campaigns', getLeadCampaignOptions);
router.get('/leads/:id', getAdminLeadDetail);
router.patch('/leads/:id/process', updateEnquiryProcess);
router.patch('/leads/:id/review', reviewAdminLead);
router.patch('/leads/:id/payout', adjustAdminLeadPayout);
router.patch('/leads/:id/paid', markAdminLeadPaid);
router.get('/withdrawals', listWithdrawals);
router.patch('/withdrawals/:id', updateWithdrawal);
router.get('/settings', getBusinessSettings);
router.patch('/settings', updateBusinessSettings);
router.get('/support', listAdminSupportTickets);
router.patch('/support/:id', updateAdminSupportTicket);
router.get('/audit', getAuditLogs);
router.get('/reports/campaign-report.xlsx', exportAdminCampaignWorkbook);
router.get('/reports/:type.csv', exportAdminReport);
router.get('/announcements', listAdminAnnouncements);
router.post('/announcements', saveAdminAnnouncement);
router.patch('/announcements/:id', saveAdminAnnouncement);
router.get('/notifications', listAdminNotifications);
router.post('/notifications', sendAdminNotification);

export default router;
