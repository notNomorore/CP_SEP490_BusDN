import express from 'express';
import { authMiddleware, authorizeRole } from '../../middleware/authMiddleware.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import validateRequest from '../../middleware/validateRequest.js';
import WalkInTicketController from './walkInTicket.controller.js';
import { validateWalkInId, validateWalkInQuery } from './walkInTicket.validators.js';

const router = express.Router();
router.use(authMiddleware, authorizeRole('ADMIN'));

router.get('/walkin-tickets', validateRequest(validateWalkInQuery, 'query'), asyncHandler(WalkInTicketController.getTickets));
router.get('/walkin-tickets/:id', validateRequest(validateWalkInId, 'params'), asyncHandler(WalkInTicketController.getTicketDetail));
router.get('/walkin-revenue/reconciliation', validateRequest(validateWalkInQuery, 'query'), asyncHandler(WalkInTicketController.reconcileRevenue));

export default router;
