import { HTTP_STATUS } from '../../constants/index.js';
import { CustomError } from '../../middleware/errorHandler.js';
import Notification from './Notification.js';
import NotificationReceipt from './NotificationReceipt.js';
import notificationService from './notification.service.js';
import {
  LEGACY_AUDIENCE_ROLE,
  NOTIFICATION_TARGET_TYPES,
} from './notification.constants.js';
import {
  normalizeNotificationTarget,
  resolveNotificationRecipientIds,
  toObjectId,
} from './notificationRecipientResolver.js';

const normalizeId = (value) => (value ? String(value) : '');

const getAudienceForRole = (role) => ({
  PASSENGER: 'passengers',
  DRIVER: 'drivers',
  BUS_ASSISTANT: 'bus_assistants',
  CONDUCTOR: 'bus_assistants',
  ADMIN: 'admins',
}[String(role || '').toUpperCase()] || '');

const isStaffRole = (role) => ['DRIVER', 'BUS_ASSISTANT', 'CONDUCTOR', 'ADMIN'].includes(
  String(role || '').toUpperCase()
);

const buildMyNotificationFilter = (user) => {
  const userId = user?.userId || user?._id;
  const audience = getAudienceForRole(user?.role);

  return {
    status: 'sent',
    $and: [
      {
        $or: [
          { expiresAt: null },
          { expiresAt: { $gte: new Date() } },
        ],
      },
      {
        $or: [
          { targetAudience: 'all' },
          ...(audience ? [{ targetAudience: audience }] : []),
          ...(isStaffRole(user?.role) ? [{ targetAudience: 'staff' }] : []),
          { recipientUserIds: userId },
        ],
      },
    ],
  };
};

const decorateReadState = async (items, userId) => {
  if (!items.length) return items;

  const receipts = await NotificationReceipt.find({
    userId: toObjectId(userId, 'userId'),
    notificationId: { $in: items.map((item) => item._id) },
  }).lean();
  const readByNotificationId = new Map(
    receipts.map((receipt) => [normalizeId(receipt.notificationId), receipt.readAt])
  );

  return items.map((item) => {
    const readAt = readByNotificationId.get(normalizeId(item._id)) || null;
    return {
      ...item,
      id: normalizeId(item._id),
      readAt,
      isRead: Boolean(readAt),
    };
  });
};

const mapLegacyTarget = (payload = {}) => {
  const target = normalizeNotificationTarget(payload);

  if (payload.targetAudience === 'drivers' || payload.targetAudience === 'bus_assistants') {
    return {
      type: NOTIFICATION_TARGET_TYPES.ROLE,
      role: LEGACY_AUDIENCE_ROLE[payload.targetAudience],
    };
  }

  if (payload.targetAudience === 'specific_users') {
    return {
      type: NOTIFICATION_TARGET_TYPES.USERS,
      userIds: payload.userIds || [],
    };
  }

  return target;
};

export const resolveNotificationRecipients = async (payload) => {
  return resolveNotificationRecipientIds(payload);
};

export const sendNotificationNow = async (notificationId, io = null) => {
  return notificationService.sendExisting(notificationId, io);
};

export const createBroadcastNotification = async (payload, adminId, io = null) => {
  return notificationService.send({
    ...payload,
    target: payload.target || mapLegacyTarget(payload),
    source: payload.source || {
      module: payload.sourceType || '',
      entityId: payload.sourceId || null,
    },
    data: payload.data || payload.metadata || {},
    channels: payload.channels,
    createdBy: adminId,
  }, { createdBy: adminId, io });
};

export const createPromotionNotificationOnce = async (promotion, io = null) => {
  const existing = await Notification.findOne({
    type: 'promotion',
    relatedPromotionId: promotion._id,
  });

  if (existing?.status === 'sent') {
    return existing;
  }

  if (existing) {
    return notificationService.sendExisting(existing._id, io);
  }

  const discountText = promotion.discountType === 'PERCENTAGE'
    ? `${promotion.discountValue}%`
    : `${Number(promotion.discountValue || 0).toLocaleString('vi-VN')} VND`;
  const validUntil = new Intl.DateTimeFormat('vi-VN').format(new Date(promotion.endDate));
  const message = [
    `Use code ${promotion.code} to get ${discountText} off your next BusDN ticket.`,
    `Valid until ${validUntil}.`,
    promotion.description || '',
  ].filter(Boolean).join(' ');

  return notificationService.send({
    type: 'PROMOTION',
    title: promotion.name || 'New promotion available',
    message,
    target: { type: 'ALL_PASSENGERS' },
    channels: { inApp: true, email: false, push: false },
    priority: 'normal',
    relatedPromotionId: promotion._id,
    promotionCode: promotion.code,
    actionUrl: '/tickets/purchase',
    scheduledAt: promotion.notificationScheduledAt,
    expiresAt: promotion.endDate,
    createdBy: promotion.updatedBy || promotion.createdBy,
    source: {
      module: 'Promotion',
      entityId: promotion._id,
    },
    data: {
      promotionId: normalizeId(promotion._id),
      promotionCode: promotion.code,
      discountType: promotion.discountType,
      discountValue: promotion.discountValue,
      startDate: promotion.startDate,
      endDate: promotion.endDate,
    },
    deduplicationKey: `promotion:${promotion._id}`,
  }, { createdBy: promotion.updatedBy || promotion.createdBy, io });
};

export const listNotifications = async (query = {}) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 100);
  const filter = {};
  const search = String(query.search || '').trim();

  ['status', 'type', 'priority', 'targetAudience'].forEach((field) => {
    if (query[field]) filter[field] = query[field];
  });

  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: 'i' } },
      { message: { $regex: search, $options: 'i' } },
    ];
  }

  const [items, total] = await Promise.all([
    Notification.find(filter)
      .populate('createdBy', 'fullName email role')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Notification.countDocuments(filter),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

export const listMyNotifications = async (user, query = {}) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const userId = user?.userId || user?._id;
  const filter = buildMyNotificationFilter(user);

  const [rawItems, total] = await Promise.all([
    Notification.find(filter)
      .sort({ 'deliverySummary.sentAt': -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Notification.countDocuments(filter),
  ]);
  const items = await decorateReadState(rawItems, userId);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

export const getMyUnreadCount = async (user) => {
  const userId = toObjectId(user?.userId || user?._id, 'userId');
  const filter = buildMyNotificationFilter(user);
  const [total, readReceipts] = await Promise.all([
    Notification.countDocuments(filter),
    NotificationReceipt.find({ userId, readAt: { $ne: null } }).select('notificationId').lean(),
  ]);
  const readIds = readReceipts.map((receipt) => receipt.notificationId);
  const readableReadCount = readIds.length
    ? await Notification.countDocuments({ ...filter, _id: { $in: readIds } })
    : 0;

  return { unreadCount: Math.max(total - readableReadCount, 0) };
};

export const markMyNotificationRead = async (user, notificationId) => {
  const userId = toObjectId(user?.userId || user?._id, 'userId');
  const id = toObjectId(notificationId, 'notificationId');
  const notification = await Notification.findOne({
    ...buildMyNotificationFilter(user),
    _id: id,
  }).lean();

  if (!notification) {
    throw new CustomError('Notification not found', HTTP_STATUS.NOT_FOUND);
  }

  const receipt = await NotificationReceipt.findOneAndUpdate(
    { notificationId: id, userId },
    { $set: { readAt: new Date() } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();

  return {
    ...notification,
    id: normalizeId(notification._id),
    readAt: receipt.readAt,
    isRead: true,
  };
};

export const markAllMyNotificationsRead = async (user) => {
  const userId = toObjectId(user?.userId || user?._id, 'userId');
  const notifications = await Notification.find(buildMyNotificationFilter(user)).select('_id').lean();
  const now = new Date();

  if (!notifications.length) {
    return { updatedCount: 0 };
  }

  await NotificationReceipt.bulkWrite(
    notifications.map((notification) => ({
      updateOne: {
        filter: { notificationId: notification._id, userId },
        update: { $set: { readAt: now } },
        upsert: true,
      },
    }))
  );

  return { updatedCount: notifications.length };
};

export const getNotificationById = async (id) => {
  const notification = await Notification.findById(id)
    .populate('createdBy', 'fullName email role')
    .populate('cancelledBy', 'fullName email role')
    .populate('recipientUserIds', 'fullName email phoneNumber role')
    .lean();

  if (!notification) {
    throw new CustomError('Notification not found', HTTP_STATUS.NOT_FOUND);
  }

  return notification;
};

export const cancelNotification = async (id, adminId) => {
  const notification = await Notification.findById(id);

  if (!notification) {
    throw new CustomError('Notification not found', HTTP_STATUS.NOT_FOUND);
  }

  if (notification.status === 'sent') {
    throw new CustomError('Sent notification cannot be cancelled', HTTP_STATUS.CONFLICT);
  }

  if (notification.status === 'cancelled') {
    return notification;
  }

  notification.status = 'cancelled';
  notification.cancelledAt = new Date();
  notification.cancelledBy = adminId;
  await notification.save();
  return notification;
};

export default {
  resolveNotificationRecipients,
  createBroadcastNotification,
  createPromotionNotificationOnce,
  sendNotificationNow,
  listNotifications,
  listMyNotifications,
  getMyUnreadCount,
  markMyNotificationRead,
  markAllMyNotificationsRead,
  getNotificationById,
  cancelNotification,
};
