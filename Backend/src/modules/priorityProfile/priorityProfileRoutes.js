import express from 'express';
import PriorityProfileController from './PriorityProfileController.js';
import { authMiddleware, authorizeRole } from '../../middleware/authMiddleware.js';
import { uploadPriorityDocuments } from './priorityProfileUpload.js';

const router = express.Router();

const handlePriorityDocumentUpload = (req, res, next) => {
  uploadPriorityDocuments(req, res, (error) => {
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    next();
  });
};

router.use(authMiddleware);

router.get('/admin/requests', authorizeRole('ADMIN'), PriorityProfileController.listRequests);
router.get('/admin/requests/:userId', authorizeRole('ADMIN'), PriorityProfileController.getRequestDetail);
router.patch('/admin/requests/:userId/verify', authorizeRole('ADMIN'), PriorityProfileController.verifyRequest);

router.get('/me', authorizeRole('PASSENGER'), PriorityProfileController.getStatus);
router.post('/register', authorizeRole('PASSENGER'), PriorityProfileController.register);
router.post('/documents', authorizeRole('PASSENGER'), handlePriorityDocumentUpload, PriorityProfileController.uploadDocuments);

export default router;
