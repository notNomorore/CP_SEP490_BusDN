import express from 'express';
import { authMiddleware, authorizeRole } from '../../middleware/authMiddleware.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import validateRequest from '../../middleware/validateRequest.js';
import SystemMonitoringController from './systemMonitoring.controller.js';
import {
  validateAuditLogQuery,
  validateIdParam,
  validateSuspiciousQuery,
  validateSuspiciousStatusUpdate,
} from './systemMonitoring.validators.js';

const router = express.Router();
router.use(authMiddleware, authorizeRole('ADMIN'));

router.get('/audit-logs', validateRequest(validateAuditLogQuery, 'query'), asyncHandler(SystemMonitoringController.getAuditLogs));
router.get('/audit-logs/:id', validateRequest(validateIdParam, 'params'), asyncHandler(SystemMonitoringController.getAuditLogDetail));
router.get('/suspicious-activities', validateRequest(validateSuspiciousQuery, 'query'), asyncHandler(SystemMonitoringController.getSuspiciousActivities));
router.get('/suspicious-activities/:id', validateRequest(validateIdParam, 'params'), asyncHandler(SystemMonitoringController.getSuspiciousDetail));
router.patch(
  '/suspicious-activities/:id/status',
  validateRequest(validateIdParam, 'params'),
  validateRequest(validateSuspiciousStatusUpdate),
  asyncHandler(SystemMonitoringController.updateSuspiciousStatus)
);
router.get('/system-monitoring/overview', asyncHandler(SystemMonitoringController.getOverview));

export default router;
