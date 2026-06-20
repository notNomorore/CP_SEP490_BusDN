import express from 'express';
import { authMiddleware, authorizeRole } from '../../middleware/authMiddleware.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import validateRequest from '../../middleware/validateRequest.js';
import IncidentReportController from './incidentReport.controller.js';
import {
  validateIncidentIdParam,
  validateIncidentListQuery,
  validateIncidentStatusUpdate,
} from './incidentReport.validators.js';

const router = express.Router();

router.use(authMiddleware, authorizeRole('ADMIN'));

router.get(
  '/',
  validateRequest(validateIncidentListQuery, 'query'),
  asyncHandler(IncidentReportController.getIncidents)
);
router.get(
  '/statistics/overview',
  asyncHandler(IncidentReportController.getOverviewStatistics)
);
router.get(
  '/:id',
  validateRequest(validateIncidentIdParam, 'params'),
  asyncHandler(IncidentReportController.getIncidentById)
);
router.patch(
  '/:id/status',
  validateRequest(validateIncidentIdParam, 'params'),
  validateRequest(validateIncidentStatusUpdate),
  asyncHandler(IncidentReportController.updateIncidentStatus)
);
router.patch(
  '/:id/reassign-assistant',
  validateRequest(validateIncidentIdParam, 'params'),
  asyncHandler(IncidentReportController.reassignTripAssistant)
);

export default router;
