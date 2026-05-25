import express from 'express';
import CustomerSupportController from './CustomerSupportController.js';
import { authMiddleware, authorizeRole } from '../../middleware/authMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

router.post('/cases', authorizeRole('PASSENGER'), CustomerSupportController.createCase);

router.get('/admin/cases', authorizeRole('ADMIN'), CustomerSupportController.listCases);
router.get('/admin/cases/:caseId', authorizeRole('ADMIN'), CustomerSupportController.getCaseDetail);
router.post('/admin/cases/:caseId/respond', authorizeRole('ADMIN'), CustomerSupportController.respondToComplaint);
router.patch('/admin/cases/:caseId/lost-item', authorizeRole('ADMIN'), CustomerSupportController.updateLostItemCase);

export default router;
