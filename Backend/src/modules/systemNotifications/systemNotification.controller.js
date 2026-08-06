import ApiResponse from '../../utils/response.js';
import SystemNotificationService from './systemNotification.service.js';

export class SystemNotificationController {
  static async listMine(req, res) {
    const result = await SystemNotificationService.listMyNotifications(req.user, req.query);
    return res.apiResponse(
      ApiResponse.success(
        result.items,
        'My notifications retrieved successfully',
        200,
        result.pagination
      )
    );
  }

  static async unreadCountMine(req, res) {
    const result = await SystemNotificationService.getMyUnreadCount(req.user);
    return res.success(result, 'Unread notification count retrieved successfully');
  }

  static async markMineRead(req, res) {
    const notification = await SystemNotificationService.markMyNotificationRead(req.user, req.params.id);
    return res.success(notification, 'Notification marked as read');
  }

  static async markAllMineRead(req, res) {
    const result = await SystemNotificationService.markAllMyNotificationsRead(req.user);
    return res.success(result, 'Notifications marked as read');
  }

  static async broadcast(req, res) {
    const notification = await SystemNotificationService.createBroadcastNotification(
      req.body,
      req.user.userId,
      req.app.io
    );

    return res.created(notification, notification.status === 'sent'
      ? 'Notification broadcast successfully'
      : 'Notification scheduled successfully');
  }

  static async list(req, res) {
    const result = await SystemNotificationService.listNotifications(req.query);
    return res.apiResponse(
      ApiResponse.success(
        result.items,
        'Notifications retrieved successfully',
        200,
        result.pagination
      )
    );
  }

  static async detail(req, res) {
    const notification = await SystemNotificationService.getNotificationById(req.params.id);
    return res.success(notification, 'Notification retrieved successfully');
  }

  static async cancel(req, res) {
    const notification = await SystemNotificationService.cancelNotification(req.params.id, req.user.userId);
    return res.success(notification, 'Notification cancelled successfully');
  }
}

export default SystemNotificationController;
