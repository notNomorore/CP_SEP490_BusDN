import express from 'express';
import { authMiddleware, authorizeRole } from '../../middleware/authMiddleware.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import validateRequest from '../../middleware/validateRequest.js';
import FleetOperationsController from './fleetOperations.controller.js';
import {
  validateGpsUpdate,
  validateIdParam,
  validateIncidentCreate,
  validateIncidentStatusUpdate,
  validateTripCreate,
  validateVehicleCreate,
} from './fleetOperations.validators.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/vehicles', authorizeRole('ADMIN'), asyncHandler(FleetOperationsController.listVehicles));
router.post(
  '/vehicles',
  authorizeRole('ADMIN'),
  validateRequest(validateVehicleCreate),
  asyncHandler(FleetOperationsController.createVehicle)
);

router.get('/trips', authorizeRole('ADMIN', 'DRIVER', 'BUS_ASSISTANT'), asyncHandler(FleetOperationsController.listTrips));
router.post(
  '/trips',
  authorizeRole('ADMIN'),
  validateRequest(validateTripCreate),
  asyncHandler(FleetOperationsController.createTrip)
);

router.post(
  '/gps',
  authorizeRole('DRIVER', 'BUS_ASSISTANT', 'ADMIN'),
  validateRequest(validateGpsUpdate),
  asyncHandler(FleetOperationsController.updateGps)
);

router.post(
  '/incidents',
  authorizeRole('DRIVER', 'BUS_ASSISTANT', 'ADMIN'),
  validateRequest(validateIncidentCreate),
  asyncHandler(FleetOperationsController.createIncident)
);

router.patch(
  '/incidents/:id/status',
  authorizeRole('ADMIN'),
  validateRequest(validateIdParam, 'params'),
  validateRequest(validateIncidentStatusUpdate),
  asyncHandler(FleetOperationsController.updateIncidentStatus)
);

export default router;
