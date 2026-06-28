import express from 'express';
import CustomerSupportController from './CustomerSupportController.js';
import { authMiddleware, authorizeRole } from '../../middleware/authMiddleware.js';
import { feedbackUpload } from '../../middleware/uploadMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

router.post(
  '/cases',
  authorizeRole('PASSENGER'),
  feedbackUpload.array('attachments', 5),
  CustomerSupportController.createCase
);
router.get('/lost-items/me', authorizeRole('PASSENGER'), CustomerSupportController.listMyLostItemCases);
router.get('/lost-items/:caseId', authorizeRole('PASSENGER'), CustomerSupportController.getMyLostItemCase);
router.get('/feedback/me', authorizeRole('PASSENGER'), CustomerSupportController.listMyFeedback);
router.get('/feedback/:caseId', authorizeRole('PASSENGER'), CustomerSupportController.getMyFeedback);
router.post('/feedback/:caseId/replies', authorizeRole('PASSENGER'), CustomerSupportController.addPassengerFeedbackReply);

router.get('/admin/feedback/analytics', authorizeRole('ADMIN'), CustomerSupportController.getFeedbackAnalytics);
router.get('/admin/cases', authorizeRole('ADMIN'), CustomerSupportController.listCases);
router.get('/admin/cases/:caseId', authorizeRole('ADMIN'), CustomerSupportController.getCaseDetail);
router.post('/admin/cases/:caseId/respond', authorizeRole('ADMIN'), CustomerSupportController.respondToComplaint);
router.patch('/admin/cases/:caseId/lost-item', authorizeRole('ADMIN'), CustomerSupportController.updateLostItemCase);
router.patch('/admin/cases/:caseId/assign', authorizeRole('ADMIN'), CustomerSupportController.assignFeedback);
router.patch('/admin/cases/:caseId/feedback', authorizeRole('ADMIN'), CustomerSupportController.updateFeedback);

export default router;
