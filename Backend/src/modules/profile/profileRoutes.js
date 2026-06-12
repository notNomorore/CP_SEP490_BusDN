import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import validateRequest from '../../middleware/validateRequest.js';
import { avatarUpload } from '../../middleware/uploadMiddleware.js';
import ProfileController from './ProfileController.js';
import {
  validatePasswordChange,
  validateProfileUpdate,
} from './profileValidators.js';

const router = express.Router();

router.use(authMiddleware);

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
router.get('/favorites/stops', asyncHandler(ProfileController.getFavoriteStops));

export default router;
