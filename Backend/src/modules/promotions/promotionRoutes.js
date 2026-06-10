import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authMiddleware, authorizeRole } from '../../middleware/authMiddleware.js';
import validateRequest from '../../middleware/validateRequest.js';
import PromotionController from './PromotionController.js';
import {
  validateObjectIdParam,
  validatePromotionCreate,
  validatePromotionListQuery,
  validatePromotionStatusUpdate,
  validatePromotionUpdate,
} from './promotionValidators.js';

const router = express.Router();

router.use(authMiddleware, authorizeRole('ADMIN'));

router.get(
  '/',
  validateRequest(validatePromotionListQuery, 'query'),
  asyncHandler(PromotionController.getPromotions)
);
router.post(
  '/',
  validateRequest(validatePromotionCreate),
  asyncHandler(PromotionController.createPromotion)
);
router.get('/statistics/overview', asyncHandler(PromotionController.getOverviewStatistics));
router.get(
  '/:id',
  validateRequest(validateObjectIdParam, 'params'),
  asyncHandler(PromotionController.getPromotionById)
);
router.put(
  '/:id',
  validateRequest(validateObjectIdParam, 'params'),
  validateRequest(validatePromotionUpdate),
  asyncHandler(PromotionController.updatePromotion)
);
router.patch(
  '/:id/status',
  validateRequest(validateObjectIdParam, 'params'),
  validateRequest(validatePromotionStatusUpdate),
  asyncHandler(PromotionController.updatePromotionStatus)
);
router.get(
  '/:id/statistics',
  validateRequest(validateObjectIdParam, 'params'),
  asyncHandler(PromotionController.getPromotionStatistics)
);

export default router;
