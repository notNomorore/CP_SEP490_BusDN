import express from 'express';
import { authMiddleware, authorizeRole } from '../../middleware/authMiddleware.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import validateRequest from '../../middleware/validateRequest.js';
import BusAssistantController from './busAssistant.controller.js';
import {
  validateRevenueSummary,
  validateShiftRevenueQuery,
  validateTicketValidation,
  validateWalkInTicket,
} from './busAssistant.validators.js';

const router = express.Router();

router.use(authMiddleware, authorizeRole('BUS_ASSISTANT'));

router.post(
  '/tickets/validate',
  validateRequest(validateTicketValidation),
  asyncHandler(BusAssistantController.validateETicket)
);
router.post(
  '/walkin-tickets',
  validateRequest(validateWalkInTicket),
  asyncHandler(BusAssistantController.createWalkInTicket)
);
router.get(
  '/shift-revenue',
  validateRequest(validateShiftRevenueQuery, 'query'),
  asyncHandler(BusAssistantController.getShiftRevenue)
);
router.post(
  '/revenue-summary',
  validateRequest(validateRevenueSummary),
  asyncHandler(BusAssistantController.submitRevenueSummary)
);

export default router;
