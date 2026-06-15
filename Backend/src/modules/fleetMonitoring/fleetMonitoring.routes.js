import express from 'express';
import { authMiddleware, authorizeRole } from '../../middleware/authMiddleware.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import validateRequest from '../../middleware/validateRequest.js';
import FleetMonitoringController from './fleetMonitoring.controller.js';
import {
  validateActiveTripQuery,
  validateDelayedTripAcknowledge,
  validateDelayedTripQuery,
  validateFleetLocationQuery,
  validateTripIdParam,
} from './fleetMonitoring.validators.js';

const router = express.Router();

router.use(authMiddleware, authorizeRole('ADMIN'));

router.post(
  '/system-incidents/scan',
  asyncHandler(FleetMonitoringController.scanSystemIncidents)
);

router.get(
  '/active-trips',
  validateRequest(validateActiveTripQuery, 'query'),
  asyncHandler(FleetMonitoringController.getActiveTrips)
);

router.get(
  '/active-trips/:tripId',
  validateRequest(validateTripIdParam, 'params'),
  asyncHandler(FleetMonitoringController.getActiveTripDetail)
);

router.get(
  '/delayed-trips',
  validateRequest(validateDelayedTripQuery, 'query'),
  asyncHandler(FleetMonitoringController.getDelayedTrips)
);

router.patch(
  '/delayed-trips/:tripId/acknowledge',
  validateRequest(validateTripIdParam, 'params'),
  validateRequest(validateDelayedTripAcknowledge),
  asyncHandler(FleetMonitoringController.acknowledgeDelayedTrip)
);

router.get(
  '/locations',
  validateRequest(validateFleetLocationQuery, 'query'),
  asyncHandler(FleetMonitoringController.getFleetLocations)
);

router.post('/mock-data', asyncHandler(FleetMonitoringController.seedDemoFleet));

export default router;
