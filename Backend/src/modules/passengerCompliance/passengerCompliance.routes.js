import express from 'express';
import { authMiddleware, authorizeRole } from '../../middleware/authMiddleware.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import validateRequest from '../../middleware/validateRequest.js';
import PassengerComplianceController from './passengerCompliance.controller.js';
import {
  validateIdParam,
  validateRestrictionListQuery,
  validateRestrictionPayload,
  validateRestrictionStatus,
  validateViolationListQuery,
} from './passengerCompliance.validators.js';

const router = express.Router();
router.use(authMiddleware, authorizeRole('ADMIN'));

router.get(
  '/passenger-violations',
  validateRequest(validateViolationListQuery, 'query'),
  asyncHandler(PassengerComplianceController.listViolations)
);
router.get(
  '/passenger-violations/:id',
  validateRequest(validateIdParam, 'params'),
  asyncHandler(PassengerComplianceController.getViolation)
);
router.post(
  '/passenger-restrictions',
  validateRequest(validateRestrictionPayload),
  asyncHandler(PassengerComplianceController.applyRestriction)
);
router.patch(
  '/passenger-restrictions/:id',
  validateRequest(validateIdParam, 'params'),
  validateRequest(validateRestrictionStatus),
  asyncHandler(PassengerComplianceController.updateRestriction)
);
router.get(
  '/passenger-restrictions',
  validateRequest(validateRestrictionListQuery, 'query'),
  asyncHandler(PassengerComplianceController.listRestrictions)
);

export default router;
