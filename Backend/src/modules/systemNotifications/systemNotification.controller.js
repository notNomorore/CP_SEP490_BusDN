import ApiResponse from '../../utils/response.js';
import SystemNotificationService from './systemNotification.service.js';

export class SystemNotificationController {
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
