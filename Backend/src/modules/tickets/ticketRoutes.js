import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authMiddleware, authorizeRole } from '../../middleware/authMiddleware.js';
import TicketController from './TicketController.js';

const router = express.Router();

router.use(authMiddleware);

router.post(
  '/validate-qr',
  authorizeRole('BUS_ASSISTANT', 'ADMIN'),
  asyncHandler(TicketController.validateQRCode)
);

router.post('/one-way', authorizeRole('PASSENGER'), asyncHandler(TicketController.purchaseOneWay));
router.get('/me', authorizeRole('PASSENGER'), asyncHandler(TicketController.listMyTickets));
router.post('/monthly-pass', authorizeRole('PASSENGER'), asyncHandler(TicketController.purchaseMonthlyPass));
router.get('/monthly-passes/me', authorizeRole('PASSENGER'), asyncHandler(TicketController.listMyMonthlyPasses));
router.get('/:ticketId', authorizeRole('PASSENGER'), asyncHandler(TicketController.getMyTicket));
router.patch('/:ticketId/cancel', authorizeRole('PASSENGER'), asyncHandler(TicketController.cancelMyTicket));

export default router;
