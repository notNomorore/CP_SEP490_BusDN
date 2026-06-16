import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authMiddleware, authorizeRole } from '../../middleware/authMiddleware.js';
import validateRequest from '../../middleware/validateRequest.js';
import { avatarUpload } from '../../middleware/uploadMiddleware.js';
import ProfileController from './ProfileController.js';
import {
  validatePasswordChange,
  validateProfileUpdate,
} from './profileValidators.js';

const router = express.Router();

router.use(authMiddleware, authorizeRole('PASSENGER'));

router.get('/me', asyncHandler(ProfileController.getMe));
router.put(
  '/update',
  validateRequest(validateProfileUpdate),
  asyncHandler(ProfileController.updateProfile)
);
router.put(
  '/change-password',
  validateRequest(validatePasswordChange),
  asyncHandler(ProfileController.changePassword)
);
router.post(
  '/upload-avatar',
  avatarUpload.single('avatar'),
  asyncHandler(ProfileController.uploadAvatar)
);
router.get('/favorites/routes', asyncHandler(ProfileController.getFavoriteRoutes));
router.post('/favorites/routes/:routeId', asyncHandler(ProfileController.saveFavoriteRoute));
router.delete('/favorites/routes/:routeId', asyncHandler(ProfileController.removeFavoriteRoute));
router.get('/favorites/stops', asyncHandler(ProfileController.getFavoriteStops));
router.post('/favorites/stops', asyncHandler(ProfileController.saveFavoriteStop));
router.delete('/favorites/stops/:stopId', asyncHandler(ProfileController.removeFavoriteStop));
router.get('/notifications/arrival', asyncHandler(ProfileController.getArrivalNotifications));
router.post('/notifications/arrival', asyncHandler(ProfileController.subscribeArrivalNotification));
router.delete(
  '/notifications/arrival/:subscriptionId',
  asyncHandler(ProfileController.removeArrivalNotification)
);
router.get('/notifications/delay', asyncHandler(ProfileController.getDelayNotifications));
router.post('/notifications/delay', asyncHandler(ProfileController.subscribeDelayNotification));
router.delete(
  '/notifications/delay/:subscriptionId',
  asyncHandler(ProfileController.removeDelayNotification)
);
router.get('/notifications/route-change', asyncHandler(ProfileController.getRouteChangeNotifications));
router.post('/notifications/route-change', asyncHandler(ProfileController.subscribeRouteChangeNotification));
router.delete(
  '/notifications/route-change/:subscriptionId',
  asyncHandler(ProfileController.removeRouteChangeNotification)
);

export default router;
