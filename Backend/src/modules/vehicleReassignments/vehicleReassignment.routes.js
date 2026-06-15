import express from 'express';
import { authMiddleware, authorizeRole } from '../../middleware/authMiddleware.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import validateRequest from '../../middleware/validateRequest.js';
import VehicleReassignmentController from './vehicleReassignment.controller.js';
import {
  validateAssignReplacementVehicle,
  validateReplacementCandidateQuery,
  validateTripIdParam,
} from './vehicleReassignment.validators.js';

const router = express.Router();

router.use(authMiddleware, authorizeRole('ADMIN'));

router.get(
  '/vehicles/replacement-candidates',
  validateRequest(validateReplacementCandidateQuery, 'query'),
  asyncHandler(VehicleReassignmentController.getReplacementCandidates)
);

router.patch(
  '/trips/:tripId/assign-replacement-vehicle',
  validateRequest(validateTripIdParam, 'params'),
  validateRequest(validateAssignReplacementVehicle),
  asyncHandler(VehicleReassignmentController.assignReplacementVehicle)
);

export default router;
