import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authMiddleware, authorizeRole } from '../../middleware/authMiddleware.js';
import TicketController from './TicketController.js';

const router = express.Router();

router.use(authMiddleware, authorizeRole('PASSENGER'));

router.post('/one-way', asyncHandler(TicketController.purchaseOneWay));
router.get('/me', asyncHandler(TicketController.listMyTickets));
router.post('/monthly-pass', asyncHandler(TicketController.purchaseMonthlyPass));
router.get('/monthly-passes/me', asyncHandler(TicketController.listMyMonthlyPasses));
router.get('/:ticketId', asyncHandler(TicketController.getMyTicket));
router.patch('/:ticketId/cancel', asyncHandler(TicketController.cancelMyTicket));

export default router;
