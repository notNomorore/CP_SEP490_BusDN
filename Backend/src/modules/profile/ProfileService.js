import { CustomError } from '../../middleware/errorHandler.js';
import { HTTP_STATUS } from '../../constants/index.js';
import ProfileRepository from './ProfileRepository.js';
import { ProfileResponseDTO } from './profile.dto.js';

export class ProfileService {
  static async getProfile(userId) {
    const user = await ProfileRepository.findById(userId);

    if (!user) {
      throw new CustomError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    return ProfileResponseDTO.format(user);
  }

  static async updateProfile(userId, payload) {
    const existingUser = await ProfileRepository.findById(userId);

    if (!existingUser) {
      throw new CustomError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    const user = await ProfileRepository.updateById(userId, {
      fullName: payload.fullName.trim(),
      email: payload.email.toLowerCase(),
      phoneNumber: payload.phoneNumber,
      gender: payload.gender || 'PREFER_NOT_TO_SAY',
      dateOfBirth: payload.dateOfBirth || null,
      address: payload.address?.trim() || '',
      notificationEnabled:
        payload.notificationEnabled === undefined
          ? existingUser.notificationEnabled
          : payload.notificationEnabled,
      favoriteRoutes: Array.isArray(payload.favoriteRoutes)
        ? payload.favoriteRoutes
        : existingUser.favoriteRoutes,
      favoriteStops: Array.isArray(payload.favoriteStops)
        ? payload.favoriteStops
        : existingUser.favoriteStops,
    });

    return ProfileResponseDTO.format(user);
  }

  static async changePassword(userId, currentPassword, newPassword) {
    const user = await ProfileRepository.findByIdWithPassword(userId);

    if (!user) {
      throw new CustomError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    const isValidPassword = await user.comparePassword(currentPassword);
    if (!isValidPassword) {
      throw new CustomError('Current password is incorrect', HTTP_STATUS.BAD_REQUEST);
    }

    user.password = newPassword;
    await ProfileRepository.save(user);

    return { success: true };
  }

  static async updateAvatar(userId, avatarPath) {
    const user = await ProfileRepository.updateById(userId, { avatar: avatarPath });

    if (!user) {
      throw new CustomError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    return ProfileResponseDTO.format(user);
  }

  static async getFavoriteRoutes(userId) {
    const user = await ProfileRepository.findById(userId);

    if (!user) {
      throw new CustomError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    return user.favoriteRoutes || [];
  }

  static async getFavoriteStops(userId) {
    const user = await ProfileRepository.findById(userId);

    if (!user) {
      throw new CustomError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    return user.favoriteStops || [];
  }
}

export default ProfileService;
