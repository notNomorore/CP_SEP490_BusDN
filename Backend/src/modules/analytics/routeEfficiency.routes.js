import express from 'express';
import { authMiddleware, authorizeRole } from '../../middleware/authMiddleware.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import validateRequest from '../../middleware/validateRequest.js';
import RouteEfficiencyController from './routeEfficiency.controller.js';
import CongestedRoutesController from './congestedRoutes.controller.js';
import FeedbackAnalyticsController from './feedbackAnalytics.controller.js';
import {
  validateRouteEfficiencyQuery,
  validateRouteIdParam,
} from './routeEfficiency.validators.js';
import {
  validateCongestedRouteIdParam,
  validateCongestedRoutesQuery,
} from './congestedRoutes.validators.js';
import { validateFeedbackAnalyticsQuery } from './feedbackAnalytics.validators.js';

const router = express.Router();

router.use(authMiddleware, authorizeRole('ADMIN'));

router.get(
  '/feedback',
  validateRequest(validateFeedbackAnalyticsQuery, 'query'),
  asyncHandler(FeedbackAnalyticsController.getFeedbackAnalytics)
);
router.get(
  '/feedback/detail',
  validateRequest(validateFeedbackAnalyticsQuery, 'query'),
  asyncHandler(FeedbackAnalyticsController.getFeedbackDetail)
);
router.get(
  '/congested-routes',
  validateRequest(validateCongestedRoutesQuery, 'query'),
  asyncHandler(CongestedRoutesController.getCongestedRoutes)
);
router.get(
  '/congested-routes/:routeId/detail',
  validateRequest(validateCongestedRouteIdParam, 'params'),
  validateRequest(validateCongestedRoutesQuery, 'query'),
  asyncHandler(CongestedRoutesController.getCongestedRouteDetail)
);
router.post(
  '/congested-routes/:routeId/broadcast',
  validateRequest(validateCongestedRouteIdParam, 'params'),
  validateRequest(validateCongestedRoutesQuery, 'query'),
  asyncHandler(CongestedRoutesController.broadcastCongestionNotification)
);
router.get(
  '/route-efficiency',
  validateRequest(validateRouteEfficiencyQuery, 'query'),
  asyncHandler(RouteEfficiencyController.getRouteEfficiency)
);
router.get(
  '/route-efficiency/:routeId',
  validateRequest(validateRouteIdParam, 'params'),
  validateRequest(validateRouteEfficiencyQuery, 'query'),
  asyncHandler(RouteEfficiencyController.getRouteEfficiencyDetail)
);

export default router;
