import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authMiddleware, authorizeRole } from '../../middleware/authMiddleware.js';
import validateRequest from '../../middleware/validateRequest.js';
import RevenueReportController from './revenueReport.controller.js';
import {
  validateRevenueExportQuery,
  validateRevenueReportQuery,
} from './revenueReport.validators.js';

const router = express.Router();

router.use(authMiddleware, authorizeRole('ADMIN'));

router.get(
  '/reports',
  validateRequest(validateRevenueReportQuery, 'query'),
  asyncHandler(RevenueReportController.getRevenueReports)
);
router.get(
  '/ticket-sales-statistics',
  validateRequest(validateRevenueReportQuery, 'query'),
  asyncHandler(RevenueReportController.getTicketSalesStatistics)
);
router.get(
  '/peak-hour-demand',
  validateRequest(validateRevenueReportQuery, 'query'),
  asyncHandler(RevenueReportController.getPeakHourDemand)
);
router.get(
  '/export',
  validateRequest(validateRevenueExportQuery, 'query'),
  asyncHandler(RevenueReportController.exportFinancialReport)
);

export default router;
