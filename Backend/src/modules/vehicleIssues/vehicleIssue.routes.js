import express from 'express';
import { authMiddleware, authorizeRole } from '../../middleware/authMiddleware.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import validateRequest from '../../middleware/validateRequest.js';
import VehicleIssueController from './vehicleIssue.controller.js';
import {
  validateEmergencyBreakdownDispatch,
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

router.patch(
  '/:id/emergency/confirm',
  validateRequest(validateVehicleIssueIdParam, 'params'),
  asyncHandler(VehicleIssueController.confirmEmergencyBreakdown)
);

router.patch(
  '/:id/emergency/dispatch-standby-bus',
  validateRequest(validateVehicleIssueIdParam, 'params'),
  validateRequest(validateEmergencyBreakdownDispatch),
  asyncHandler(VehicleIssueController.dispatchStandbyBus)
);

router.patch(
  '/:id/emergency/resolve',
  validateRequest(validateVehicleIssueIdParam, 'params'),
  asyncHandler(VehicleIssueController.resolveEmergencyBreakdown)
);

export default router;
