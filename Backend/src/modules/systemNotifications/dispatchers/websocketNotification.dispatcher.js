import { NOTIFICATION_EVENTS } from '../notification.constants.js';

const normalizeId = (value) => (value ? String(value) : '');

export const buildSocketNotificationPayload = (notification) => ({
  _id: normalizeId(notification._id),
  id: normalizeId(notification._id),
  title: notification.title,
  message: notification.message,
  type: notification.type,
  notificationType: notification.notificationType || notification.metadata?.notificationType || notification.type,
  priority: notification.priority,
  targetAudience: notification.targetAudience,
  targetType: notification.targetType || '',
  routeId: normalizeId(notification.routeId) || null,
  tripId: normalizeId(notification.tripId) || null,
  relatedPromotionId: normalizeId(notification.relatedPromotionId) || null,
  promotionCode: notification.promotionCode || '',
  actionUrl: notification.actionUrl || '',
  metadata: notification.metadata || {},
  data: notification.metadata || {},
  source: notification.source || {
    module: notification.sourceType || '',
    entityId: normalizeId(notification.sourceId) || null,
  },
  channels: notification.channels || { inApp: true, email: false, push: false },
  recipientUserIds: (notification.recipientUserIds || []).map(normalizeId),
  createdAt: notification.createdAt,
  sentAt: notification.deliverySummary?.sentAt || new Date(),
  isUrgent: notification.priority === 'urgent' || notification.type === 'emergency',
});

export class WebSocketNotificationDispatcher {
  static async dispatch(notification, io = null) {
    if (!io) {
      return { sent: false, reason: 'SOCKET_IO_NOT_AVAILABLE' };
    }

    io.emit(NOTIFICATION_EVENTS.NEW, buildSocketNotificationPayload(notification));
    return { sent: true, event: NOTIFICATION_EVENTS.NEW };
  }
}

export default WebSocketNotificationDispatcher;

