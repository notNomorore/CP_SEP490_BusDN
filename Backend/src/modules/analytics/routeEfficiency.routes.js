import express from 'express';
import { authMiddleware, authorizeRole } from '../../middleware/authMiddleware.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import validateRequest from '../../middleware/validateRequest.js';
import RouteEfficiencyController from './routeEfficiency.controller.js';
import {
  validateRouteEfficiencyQuery,
  validateRouteIdParam,
} from './routeEfficiency.validators.js';

const router = express.Router();

router.use(authMiddleware, authorizeRole('ADMIN'));

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
