import express from 'express';
import { authMiddleware, authorizeRole } from '../../middleware/authMiddleware.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import validateRequest from '../../middleware/validateRequest.js';
import SystemNotificationController from './systemNotification.controller.js';
import {
  validateBroadcastPayload,
  validateNotificationListQuery,
  validateObjectIdParam,
} from './systemNotification.validators.js';

const router = express.Router();

router.use(authMiddleware, authorizeRole('ADMIN'));

router.post(
  '/broadcast',
  validateRequest(validateBroadcastPayload),
  asyncHandler(SystemNotificationController.broadcast)
);

router.get(
  '/',
  validateRequest(validateNotificationListQuery, 'query'),
  asyncHandler(SystemNotificationController.list)
);

router.get(
  '/:id',
  validateRequest(validateObjectIdParam, 'params'),
  asyncHandler(SystemNotificationController.detail)
);

router.patch(
  '/:id/cancel',
  validateRequest(validateObjectIdParam, 'params'),
  asyncHandler(SystemNotificationController.cancel)
);

export default router;
