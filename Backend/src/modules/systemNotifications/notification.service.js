import mongoose from 'mongoose';
import { HTTP_STATUS } from '../../constants/index.js';
import { CustomError } from '../../middleware/errorHandler.js';
import logger from '../../utils/logger.js';
import OperationNotification from '../scheduleOperations/OperationNotification.js';
import Notification from './Notification.js';
import {
  LEGACY_NOTIFICATION_TYPES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_PRIORITIES,
  SEMANTIC_TYPE_TO_LEGACY_TYPE,
  TARGET_TYPE_TO_LEGACY_AUDIENCE,
} from './notification.constants.js';
import {
  normalizeNotificationTarget,
  resolveNotificationRecipients,
  toObjectId,
} from './notificationRecipientResolver.js';
import WebSocketNotificationDispatcher from './dispatchers/websocketNotification.dispatcher.js';
import EmailNotificationDispatcher from './dispatchers/emailNotification.dispatcher.js';

const IMMEDIATE_SKEW_MS = 30 * 1000;

const normalizeId = (value) => (value ? String(value) : '');

const normalizeChannels = (channels = {}) => ({
  [NOTIFICATION_CHANNELS.IN_APP]: channels.inApp !== false,
  [NOTIFICATION_CHANNELS.EMAIL]: channels.email === true,
  [NOTIFICATION_CHANNELS.PUSH]: channels.push === true,
});

const normalizePriority = (priority) => (
  NOTIFICATION_PRIORITIES.includes(priority) ? priority : 'normal'
);

const normalizeNotificationType = (type, priority) => {
  const requestedType = String(type || '').trim();
  if (LEGACY_NOTIFICATION_TYPES.includes(requestedType)) {
    return {
      storedType: requestedType,
      notificationType: requestedType,
    };
  }

  const semanticType = requestedType.toUpperCase();
  return {
    storedType: SEMANTIC_TYPE_TO_LEGACY_TYPE[semanticType] || (priority === 'urgent' ? 'emergency' : 'general'),
    notificationType: semanticType || 'SYSTEM_ALERT',
  };
};

const dateOrNull = (value) => (value ? new Date(value) : null);

const assertValidDate = (date, field) => {
  if (date && Number.isNaN(date.getTime())) {
    throw new CustomError(`Invalid ${field}`, HTTP_STATUS.BAD_REQUEST);
  }
};

const getTargetUserIds = (target) => {
  if (target.userId) return [target.userId];
  if (Array.isArray(target.userIds)) return target.userIds;
  return [];
};

const normalizeEmailRecipients = (recipients = []) => recipients
  .map((recipient) => {
    if (typeof recipient === 'string') {
      return { email: recipient };
    }
    return recipient;
  })
  .filter((recipient) => recipient?.email);

const buildSource = (payload = {}) => ({
  module: payload.source?.module || payload.sourceType || '',
  entityId: normalizeId(payload.source?.entityId || payload.sourceId),
});

const buildMetadata = (payload = {}, notificationType) => ({
  ...(payload.metadata || {}),
  ...(payload.data || {}),
  notificationType,
});

const maybeObjectId = (value, field) => {
  if (!value) return null;
  return toObjectId(value, field);
};

const maybeObjectIdOrNull = (value) => {
  if (!value || !mongoose.isValidObjectId(value)) return null;
  return new mongoose.Types.ObjectId(value);
};

export class NotificationService {
  static async send(payload = {}, options = {}) {
    const io = options.io || payload.io || null;
    const createdBy = options.createdBy || payload.createdBy || null;
    const channels = normalizeChannels(payload.channels);
    const priority = normalizePriority(payload.priority);
    const { storedType, notificationType } = normalizeNotificationType(payload.type, priority);
    const target = normalizeNotificationTarget(payload);
    const targetAudience = payload.targetAudience || TARGET_TYPE_TO_LEGACY_AUDIENCE[target.type];
    const scheduledAt = dateOrNull(payload.scheduledAt);
    const expiresAt = dateOrNull(payload.expiresAt);
    const source = buildSource(payload);
    const shouldSendNow = !scheduledAt || scheduledAt.getTime() <= Date.now() + IMMEDIATE_SKEW_MS;

    assertValidDate(scheduledAt, 'scheduledAt');
    assertValidDate(expiresAt, 'expiresAt');

    if (!payload.title || !String(payload.title).trim()) {
      throw new CustomError('Notification title is required', HTTP_STATUS.BAD_REQUEST);
    }
    if (!payload.message || !String(payload.message).trim()) {
      throw new CustomError('Notification message is required', HTTP_STATUS.BAD_REQUEST);
    }
    if (!targetAudience) {
      throw new CustomError('Unsupported notification target type', HTTP_STATUS.BAD_REQUEST);
    }

    if (payload.deduplicationKey) {
      const existing = await Notification.findOne({ deduplicationKey: payload.deduplicationKey });
      if (existing) {
        logger.info('notification.deduplicated', { deduplicationKey: payload.deduplicationKey });
        return existing;
      }
    }

    const recipients = await resolveNotificationRecipients(target);
    const dispatchRecipients = [
      ...recipients,
      ...normalizeEmailRecipients(payload.emailRecipients),
    ];
    const recipientUserIds = recipients.map((user) => user._id);

    const notification = await Notification.create({
      title: String(payload.title).trim(),
      message: String(payload.message).trim(),
      type: storedType,
      notificationType,
      priority,
      targetAudience,
      targetType: target.type,
      routeId: maybeObjectId(target.routeId || payload.routeId, 'routeId'),
      tripId: maybeObjectId(target.tripId || payload.tripId, 'tripId'),
      relatedPromotionId: maybeObjectId(payload.relatedPromotionId, 'relatedPromotionId'),
      promotionCode: payload.promotionCode || '',
      actionUrl: payload.actionUrl || '',
      source,
      sourceType: source.module || '',
      sourceId: maybeObjectIdOrNull(source.entityId),
      metadata: buildMetadata(payload, notificationType),
      userIds: getTargetUserIds(target),
      recipientUserIds,
      channels,
      deduplicationKey: payload.deduplicationKey || '',
      scheduledAt,
      expiresAt,
      createdBy: createdBy && mongoose.isValidObjectId(createdBy) ? createdBy : null,
      status: shouldSendNow ? 'draft' : 'scheduled',
      deliverySummary: {
        resolvedCount: recipientUserIds.length,
        sentCount: 0,
        failedCount: 0,
        sentAt: null,
      },
    });

    logger.info('notification.created', {
      notificationId: normalizeId(notification._id),
      targetType: target.type,
      channels,
      scheduled: !shouldSendNow,
    });

    if (!shouldSendNow) {
      return notification;
    }

    return this.dispatchPersisted(notification, dispatchRecipients, io);
  }

  static async dispatchPersisted(notification, recipients = null, io = null) {
    const resolvedRecipients = recipients || await resolveNotificationRecipients(normalizeNotificationTarget(notification));
    const channels = normalizeChannels(notification.channels);
    let websocketFailed = false;
    let emailResult = { attemptedCount: 0, sentCount: 0, failedCount: 0, results: [] };

    notification.recipientUserIds = resolvedRecipients.map((user) => user._id).filter(Boolean);
    notification.status = 'sent';
    notification.deliverySummary = {
      resolvedCount: resolvedRecipients.length,
      sentCount: channels.inApp ? resolvedRecipients.length : 0,
      failedCount: 0,
      sentAt: new Date(),
    };
    await notification.save();

    if (channels.inApp) {
      try {
        await WebSocketNotificationDispatcher.dispatch(notification, io);
      } catch (error) {
        websocketFailed = true;
        logger.error('notification.websocket_failed', {
          notificationId: normalizeId(notification._id),
          message: error.message,
        });
      }
    }

    if (channels.email) {
      emailResult = await EmailNotificationDispatcher.dispatch(notification, resolvedRecipients);
      if (emailResult.failedCount) {
        logger.warn('notification.email_failed', {
          notificationId: normalizeId(notification._id),
          failedCount: emailResult.failedCount,
        });
      }
    }

    notification.deliverySummary = {
      resolvedCount: resolvedRecipients.length,
      sentCount: (channels.inApp ? resolvedRecipients.length : 0) + emailResult.sentCount,
      failedCount: emailResult.failedCount + (websocketFailed ? 1 : 0),
      sentAt: notification.deliverySummary.sentAt,
    };
    notification.metadata = {
      ...(notification.metadata || {}),
      emailDelivery: emailResult.attemptedCount ? {
        attemptedCount: emailResult.attemptedCount,
        sentCount: emailResult.sentCount,
        failedCount: emailResult.failedCount,
      } : undefined,
    };
    await notification.save();

    logger.info('notification.sent', {
      notificationId: normalizeId(notification._id),
      resolvedCount: resolvedRecipients.length,
      channels,
    });

    return notification;
  }

  static async sendExisting(notificationId, io = null) {
    const notification = await Notification.findById(notificationId);

    if (!notification) {
      throw new CustomError('Notification not found', HTTP_STATUS.NOT_FOUND);
    }

    if (notification.status === 'cancelled') {
      throw new CustomError('Cancelled notification cannot be sent', HTTP_STATUS.CONFLICT);
    }

    if (notification.status === 'sent') {
      return notification;
    }

    return this.dispatchPersisted(notification, null, io);
  }

  static async sendToUser(payload = {}, userId, options = {}) {
    return this.send({
      ...payload,
      target: { type: 'USER', userId },
    }, options);
  }

  static async sendToRole(payload = {}, role, options = {}) {
    return this.send({
      ...payload,
      target: { type: 'ROLE', role },
    }, options);
  }

  static async broadcast(payload = {}, options = {}) {
    return this.send({
      ...payload,
      target: { type: 'ALL_USERS' },
    }, options);
  }

  static async createOperationNotification(payload = {}) {
    const notification = await OperationNotification.create(payload);
    logger.info('notification.operation_created', {
      notificationId: normalizeId(notification._id),
      sourceType: notification.sourceType || '',
    });
    return notification;
  }

  static async upsertOperationNotification(filter, update, options = {}) {
    const notification = await OperationNotification.findOneAndUpdate(filter, update, options);
    logger.info('notification.operation_upserted', {
      notificationId: normalizeId(notification?._id),
      sourceType: notification?.sourceType || filter?.sourceType || '',
    });
    return notification;
  }

  static async updateOperationNotifications(filter, update, options = {}) {
    const result = await OperationNotification.updateMany(filter, update, options);
    logger.info('notification.operation_updated', {
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
    });
    return result;
  }
}

export default NotificationService;
