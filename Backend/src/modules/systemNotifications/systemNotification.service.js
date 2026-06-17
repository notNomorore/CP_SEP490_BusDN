import mongoose from 'mongoose';
import { HTTP_STATUS } from '../../constants/index.js';
import { CustomError } from '../../middleware/errorHandler.js';
import logger from '../../utils/logger.js';
import User from '../auth/User.js';
import Trip from '../fleetOperations/Trip.js';
import TripSchedule from '../admin/TripSchedule.js';
import Notification from './Notification.js';

const ACTIVE_USER_FILTER = { status: 'ACTIVE', 'accountLock.isLocked': { $ne: true } };
const IMMEDIATE_SKEW_MS = 30 * 1000;
const NOTIFICATION_EVENT = 'server:notification:new';
const ACTIVE_ROUTE_RECORD_STATUSES = [
  'ACTIVE',
  'VALID',
  'PAID',
  'CONFIRMED',
  'PENDING',
  'active',
  'valid',
  'paid',
  'confirmed',
  'pending',
];

const toObjectId = (value, field = 'id') => {
  if (!value) return null;
  if (!mongoose.isValidObjectId(value)) {
    throw new CustomError(`Invalid ${field}`, HTTP_STATUS.BAD_REQUEST);
  }
  return new mongoose.Types.ObjectId(value);
};

const normalizeId = (value) => (value ? String(value) : '');

const uniqueIds = (ids = []) => [...new Set(ids.map(normalizeId).filter(Boolean))];

const collectionExists = async (name) => {
  const collections = await mongoose.connection.db.listCollections({ name }).toArray();
  return collections.length > 0;
};

const readCollectionUserIdsByRoute = async (collectionName, routeId, statusFields = []) => {
  if (!await collectionExists(collectionName)) return [];

  const routeObjectId = toObjectId(routeId, 'routeId');
  const routeValue = String(routeId);
  const statusOr = statusFields.length
    ? statusFields.map((field) => ({ [field]: { $in: ACTIVE_ROUTE_RECORD_STATUSES } }))
    : [];

  const query = {
    $and: [
      {
        $or: [
          { routeId: routeObjectId },
          { routeId: routeValue },
          { 'route._id': routeObjectId },
          { 'route.id': routeValue },
        ],
      },
      ...(statusOr.length ? [{ $or: statusOr }] : []),
    ],
  };

  const docs = await mongoose.connection.db
    .collection(collectionName)
    .find(query, { projection: { userId: 1, passengerId: 1, customerId: 1, ownerId: 1 } })
    .toArray();

  return docs.flatMap((doc) => [doc.userId, doc.passengerId, doc.customerId, doc.ownerId]);
};

const resolveRoutePassengerIds = async (routeId) => {
  const routeObjectId = toObjectId(routeId, 'routeId');
  const favoriteUsers = await User.find({
    ...ACTIVE_USER_FILTER,
    role: 'PASSENGER',
    $or: [
      { 'favoriteRoutes.routeId': String(routeId) },
      { 'favoriteRoutes.routeId': routeObjectId },
    ],
  }).select('_id').lean();

  const [ticketIds, monthlyPassIds, monthlyPassUsageIds] = await Promise.all([
    readCollectionUserIdsByRoute('tickets', routeId, ['status', 'ticketStatus', 'paymentStatus']),
    readCollectionUserIdsByRoute('monthlypasses', routeId, ['status', 'passStatus']),
    readCollectionUserIdsByRoute('monthlypassusages', routeId, ['status']),
  ]);

  const userIds = uniqueIds([
    ...favoriteUsers.map((user) => user._id),
    ...ticketIds,
    ...monthlyPassIds,
    ...monthlyPassUsageIds,
  ]);

  if (!userIds.length) return [];

  const activePassengers = await User.find({
    ...ACTIVE_USER_FILTER,
    role: 'PASSENGER',
    _id: { $in: userIds.map((id) => toObjectId(id, 'userId')) },
  }).select('_id').lean();

  return activePassengers.map((user) => user._id);
};

const resolveTripStaffIds = async (tripId) => {
  const tripObjectId = toObjectId(tripId, 'tripId');
  const [trip, schedule] = await Promise.all([
    Trip.findById(tripObjectId).select('driverId assistantId').lean(),
    TripSchedule.findById(tripObjectId).select('driver.userId assistant.userId').lean(),
  ]);

  if (!trip && !schedule) {
    throw new CustomError('Trip not found', HTTP_STATUS.NOT_FOUND);
  }

  const ids = uniqueIds([
    trip?.driverId,
    trip?.assistantId,
    schedule?.driver?.userId,
    schedule?.assistant?.userId,
  ]);

  if (!ids.length) return [];

  const users = await User.find({
    ...ACTIVE_USER_FILTER,
    role: { $in: ['DRIVER', 'BUS_ASSISTANT'] },
    _id: { $in: ids.map((id) => toObjectId(id, 'userId')) },
  }).select('_id').lean();

  return users.map((user) => user._id);
};

export const resolveNotificationRecipients = async (payload) => {
  const targetAudience = payload.targetAudience;
  let query = null;

  if (targetAudience === 'all') query = { ...ACTIVE_USER_FILTER };
  if (targetAudience === 'passengers') query = { ...ACTIVE_USER_FILTER, role: 'PASSENGER' };
  if (targetAudience === 'drivers') query = { ...ACTIVE_USER_FILTER, role: 'DRIVER' };
  if (targetAudience === 'bus_assistants') query = { ...ACTIVE_USER_FILTER, role: 'BUS_ASSISTANT' };
  if (targetAudience === 'admins') query = { ...ACTIVE_USER_FILTER, role: 'ADMIN' };

  if (query) {
    const users = await User.find(query).select('_id').lean();
    return users.map((user) => user._id);
  }

  if (targetAudience === 'specific_users') {
    const userIds = uniqueIds(payload.userIds).map((id) => toObjectId(id, 'userId'));
    const users = await User.find({ ...ACTIVE_USER_FILTER, _id: { $in: userIds } }).select('_id').lean();
    return users.map((user) => user._id);
  }

  if (targetAudience === 'route_passengers') {
    return resolveRoutePassengerIds(payload.routeId);
  }

  if (targetAudience === 'trip_staff') {
    return resolveTripStaffIds(payload.tripId);
  }

  throw new CustomError('Unsupported target audience', HTTP_STATUS.BAD_REQUEST);
};

const buildSocketPayload = (notification) => ({
  _id: normalizeId(notification._id),
  title: notification.title,
  message: notification.message,
  type: notification.type,
  priority: notification.priority,
  targetAudience: notification.targetAudience,
  routeId: normalizeId(notification.routeId) || null,
  tripId: normalizeId(notification.tripId) || null,
  recipientUserIds: (notification.recipientUserIds || []).map(normalizeId),
  createdAt: notification.createdAt,
  sentAt: notification.deliverySummary?.sentAt || new Date(),
  isUrgent: notification.priority === 'urgent' || notification.type === 'emergency',
});

export const sendNotificationNow = async (notificationId, io = null) => {
  const notification = await Notification.findById(notificationId);

  if (!notification) {
    throw new CustomError('Notification not found', HTTP_STATUS.NOT_FOUND);
  }

  if (notification.status === 'cancelled') {
    throw new CustomError('Cancelled notification cannot be sent', HTTP_STATUS.CONFLICT);
  }

  const recipientIds = await resolveNotificationRecipients(notification);
  notification.recipientUserIds = recipientIds;
  notification.status = 'sent';
  notification.deliverySummary = {
    resolvedCount: recipientIds.length,
    sentCount: recipientIds.length,
    failedCount: 0,
    sentAt: new Date(),
  };

  await notification.save();

  if (io) {
    io.emit(NOTIFICATION_EVENT, buildSocketPayload(notification));
  }

  return notification;
};

export const createBroadcastNotification = async (payload, adminId, io = null) => {
  const scheduledAt = payload.scheduledAt ? new Date(payload.scheduledAt) : null;
  const shouldSendNow = !scheduledAt || scheduledAt.getTime() <= Date.now() + IMMEDIATE_SKEW_MS;

  const notification = await Notification.create({
    title: payload.title,
    message: payload.message,
    type: payload.type,
    priority: payload.priority || 'normal',
    targetAudience: payload.targetAudience,
    routeId: payload.routeId || null,
    tripId: payload.tripId || null,
    userIds: payload.userIds || [],
    scheduledAt,
    expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
    createdBy: adminId,
    status: shouldSendNow ? 'draft' : 'scheduled',
  });

  if (!shouldSendNow) {
    const recipientIds = await resolveNotificationRecipients(notification);
    notification.recipientUserIds = recipientIds;
    notification.deliverySummary.resolvedCount = recipientIds.length;
    await notification.save();
    return notification;
  }

  try {
    return await sendNotificationNow(notification._id, io);
  } catch (error) {
    logger.error('Immediate notification send failed:', error);
    throw error;
  }
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
  sendNotificationNow,
  listNotifications,
  getNotificationById,
  cancelNotification,
};
