import express from 'express';
import { authMiddleware, authorizeRole } from '../../middleware/authMiddleware.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import validateRequest from '../../middleware/validateRequest.js';
import MaintenanceApprovalController from './maintenanceApproval.controller.js';
import {
  validateApproveMaintenanceTask,
  validateMaintenanceTaskIdParam,
  validateRejectMaintenanceTask,
  validateUpdateMaintenanceTaskProgress,
} from './maintenanceApproval.validators.js';

const router = express.Router();

router.use(authMiddleware, authorizeRole('ADMIN'));

router.get(
  '/pending-approval',
  asyncHandler(MaintenanceApprovalController.getPendingApprovalTasks)
);

router.patch(
  '/tasks/:id/start',
  validateRequest(validateMaintenanceTaskIdParam, 'params'),
  validateRequest(validateUpdateMaintenanceTaskProgress),
  asyncHandler(MaintenanceApprovalController.startMaintenanceTask)
);

router.patch(
  '/tasks/:id/complete',
  validateRequest(validateMaintenanceTaskIdParam, 'params'),
  validateRequest(validateUpdateMaintenanceTaskProgress),
  asyncHandler(MaintenanceApprovalController.completeMaintenanceTask)
);

router.patch(
  '/tasks/:id/approve',
  validateRequest(validateMaintenanceTaskIdParam, 'params'),
  validateRequest(validateApproveMaintenanceTask),
  asyncHandler(MaintenanceApprovalController.approveMaintenanceTask)
);

router.patch(
  '/tasks/:id/reject',
  validateRequest(validateMaintenanceTaskIdParam, 'params'),
  validateRequest(validateRejectMaintenanceTask),
  asyncHandler(MaintenanceApprovalController.rejectMaintenanceTask)
);

export default router;
