import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import validateRequest from '../../middleware/validateRequest.js';
import AiController from './ai.controller.js';
import {
  validateNearbyRoutesQuery,
  validateRouteIdParam,
  validateRouteSearchQuery,
  validateRouteSuggestionsQuery,
} from './ai.validators.js';

const router = express.Router();

router.get(
  '/routes/search',
  validateRequest(validateRouteSearchQuery, 'query'),
  asyncHandler(AiController.searchRoutes)
);

router.get(
  '/routes/suggestions',
  validateRequest(validateRouteSuggestionsQuery, 'query'),
  asyncHandler(AiController.suggestRoutes)
);

router.get(
  '/routes/nearby',
  validateRequest(validateNearbyRoutesQuery, 'query'),
  asyncHandler(AiController.findNearbyRoutes)
);

router.get(
  '/routes/:routeId/eta',
  validateRequest(validateRouteIdParam, 'params'),
  asyncHandler(AiController.getRouteEta)
);

router.get(
  '/routes/:routeId/live',
  validateRequest(validateRouteIdParam, 'params'),
  asyncHandler(AiController.getLiveRoute)
);

export default router;
