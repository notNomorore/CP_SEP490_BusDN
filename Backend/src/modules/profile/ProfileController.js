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

  static async saveFavoriteRoute(req, res) {
    const route = await ProfileService.saveFavoriteRoute(req.user.userId, req.params.routeId);
    return res.success(route, 'Route saved to favorites successfully', 201);
  }

  static async removeFavoriteRoute(req, res) {
    const route = await ProfileService.removeFavoriteRoute(req.user.userId, req.params.routeId);
    return res.success(route, 'Route removed from favorites successfully');
  }

  static async getFavoriteStops(req, res) {
    const stops = await ProfileService.getFavoriteStops(req.user.userId);
    return res.success(stops, 'Favorite stops retrieved successfully');
  }

  static async saveFavoriteStop(req, res) {
    const stop = await ProfileService.saveFavoriteStop(req.user.userId, req.body);
    return res.success(stop, 'Stop saved to favorites successfully', 201);
  }

  static async removeFavoriteStop(req, res) {
    const stop = await ProfileService.removeFavoriteStop(req.user.userId, req.params.stopId);
    return res.success(stop, 'Stop removed from favorites successfully');
  }

  static async getArrivalNotifications(req, res) {
    const subscriptions = await ProfileService.getArrivalNotifications(req.user.userId);
    return res.success(subscriptions, 'Arrival notifications retrieved successfully');
  }

  static async subscribeArrivalNotification(req, res) {
    const subscription = await ProfileService.subscribeArrivalNotification(req.user.userId, req.body);
    return res.success(subscription, 'Arrival notification enabled successfully', 201);
  }

  static async removeArrivalNotification(req, res) {
    const subscription = await ProfileService.removeArrivalNotification(
      req.user.userId,
      req.params.subscriptionId
    );
    return res.success(subscription, 'Arrival notification disabled successfully');
  }

  static async getDelayNotifications(req, res) {
    const subscriptions = await ProfileService.getDelayNotifications(req.user.userId);
    return res.success(subscriptions, 'Delay notifications retrieved successfully');
  }

  static async subscribeDelayNotification(req, res) {
    const subscription = await ProfileService.subscribeDelayNotification(req.user.userId, req.body);
    return res.success(subscription, 'Delay notification enabled successfully', 201);
  }

  static async removeDelayNotification(req, res) {
    const subscription = await ProfileService.removeDelayNotification(
      req.user.userId,
      req.params.subscriptionId
    );
    return res.success(subscription, 'Delay notification disabled successfully');
  }
}

export default ProfileController;
