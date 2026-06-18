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
router.get('/admin/requests/:requestId', authorizeRole('ADMIN'), PriorityProfileController.getRequestDetail);
router.patch('/admin/requests/:requestId/verify', authorizeRole('ADMIN'), PriorityProfileController.verifyRequest);

router.get('/me', authorizeRole('PASSENGER'), PriorityProfileController.getStatus);
router.get('/me/requests', authorizeRole('PASSENGER'), PriorityProfileController.listMyRequests);
router.post('/submit', authorizeRole('PASSENGER'), handlePriorityDocumentUpload, PriorityProfileController.submit);
router.post('/register', authorizeRole('PASSENGER'), PriorityProfileController.register);
router.post('/documents', authorizeRole('PASSENGER'), handlePriorityDocumentUpload, PriorityProfileController.uploadDocuments);

export default router;
