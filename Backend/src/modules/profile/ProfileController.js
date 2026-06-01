import ProfileService from './ProfileService.js';

export class ProfileController {
  static async getMe(req, res) {
    const profile = await ProfileService.getProfile(req.user.userId);
    return res.success(profile, 'Profile retrieved successfully');
  }

  static async updateProfile(req, res) {
    const profile = await ProfileService.updateProfile(req.user.userId, req.body);
    return res.success(profile, 'Profile updated successfully');
  }

  static async changePassword(req, res) {
    await ProfileService.changePassword(
      req.user.userId,
      req.body.currentPassword,
      req.body.newPassword
    );

    return res.success(null, 'Password changed successfully');
  }

  static async uploadAvatar(req, res) {
    if (!req.file) {
      return res.badRequest('Avatar image is required');
    }

    const avatarPath = `/uploads/avatars/${req.file.filename}`;
    const profile = await ProfileService.updateAvatar(req.user.userId, avatarPath);
    return res.success(profile, 'Avatar uploaded successfully');
  }

  static async getFavoriteRoutes(req, res) {
    const routes = await ProfileService.getFavoriteRoutes(req.user.userId);
    return res.success(routes, 'Favorite routes retrieved successfully');
  }

  static async getFavoriteStops(req, res) {
    const stops = await ProfileService.getFavoriteStops(req.user.userId);
    return res.success(stops, 'Favorite stops retrieved successfully');
  }
}

export default ProfileController;
