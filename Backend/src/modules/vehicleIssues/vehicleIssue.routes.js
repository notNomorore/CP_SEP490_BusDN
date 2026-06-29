import express from 'express';
import { authMiddleware, authorizeRole } from '../../middleware/authMiddleware.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import validateRequest from '../../middleware/validateRequest.js';
import VehicleIssueController from './vehicleIssue.controller.js';
import {
  validateVehicleIssueIdParam,
  validateVehicleIssueListQuery,
  validateVehicleIssueReview,
} from './vehicleIssue.validators.js';

const router = express.Router();

router.use(authMiddleware, authorizeRole('ADMIN'));

router.get(
  '/',
  validateRequest(validateVehicleIssueListQuery, 'query'),
  asyncHandler(VehicleIssueController.getIssues)
);

router.get(
  '/:id',
  validateRequest(validateVehicleIssueIdParam, 'params'),
  asyncHandler(VehicleIssueController.getIssueById)
);

router.patch(
  '/:id/review',
  validateRequest(validateVehicleIssueIdParam, 'params'),
  validateRequest(validateVehicleIssueReview),
  asyncHandler(VehicleIssueController.reviewIssue)
);

export default router;
