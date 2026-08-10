import mongoose from 'mongoose';
import { HTTP_STATUS } from '../../constants/index.js';
import { CustomError } from '../../middleware/errorHandler.js';
import User from '../auth/User.js';
import Trip from '../fleetOperations/Trip.js';
import TripSchedule from '../admin/TripSchedule.js';
import {
  LEGACY_AUDIENCE_ROLE,
  LEGACY_AUDIENCE_TO_TARGET_TYPE,
  NOTIFICATION_TARGET_TYPES,
} from './notification.constants.js';

const ACTIVE_USER_FILTER = { status: 'ACTIVE', 'accountLock.isLocked': { $ne: true } };
const STAFF_ROLES = ['DRIVER', 'BUS_ASSISTANT', 'CONDUCTOR', 'ADMIN'];
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

export const toObjectId = (value, field = 'id') => {
  if (!value) return null;
  if (!mongoose.isValidObjectId(value)) {
    throw new CustomError(`Invalid ${field}`, HTTP_STATUS.BAD_REQUEST);
  }
  return new mongoose.Types.ObjectId(value);
};

const normalizeId = (value) => (value ? String(value) : '');

const uniqueIds = (ids = []) => [...new Set(ids.map(normalizeId).filter(Boolean))];

const normalizeRole = (role) => String(role || '').trim().toUpperCase().replace(/[\s-]+/g, '_');

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

const findUsersByIds = async (ids = [], roleFilter = null) => {
  const userIds = uniqueIds(ids).map((id) => toObjectId(id, 'userId'));
  if (!userIds.length) return [];

  return User.find({
    ...ACTIVE_USER_FILTER,
    ...(roleFilter ? { role: roleFilter } : {}),
    _id: { $in: userIds },
  }).select('_id email fullName role preferences notificationEnabled').lean();
};

const resolveRoutePassengerUsers = async (routeId) => {
  const routeObjectId = toObjectId(routeId, 'routeId');
  const favoriteUsers = await User.find({
    ...ACTIVE_USER_FILTER,
    role: 'PASSENGER',
    $or: [
      { 'favoriteRoutes.routeId': String(routeId) },
      { 'favoriteRoutes.routeId': routeObjectId },
      { 'delayNotifications.routeId': String(routeId), 'delayNotifications.notificationStatus': 'ENABLED' },
      { 'routeChangeNotifications.routeId': String(routeId), 'routeChangeNotifications.notificationStatus': 'ENABLED' },
      { 'arrivalNotifications.routeId': String(routeId), 'arrivalNotifications.notificationStatus': 'ENABLED' },
    ],
  }).select('_id').lean();

  const [ticketIds, monthlyPassIds, monthlyPassUsageIds] = await Promise.all([
    readCollectionUserIdsByRoute('tickets', routeId, ['status', 'ticketStatus', 'paymentStatus']),
    readCollectionUserIdsByRoute('monthlypasses', routeId, ['status', 'passStatus']),
    readCollectionUserIdsByRoute('monthlypassusages', routeId, ['status']),
  ]);

  return findUsersByIds([
    ...favoriteUsers.map((user) => user._id),
    ...ticketIds,
    ...monthlyPassIds,
    ...monthlyPassUsageIds,
  ], 'PASSENGER');
};

const resolveTripStaffUsers = async (tripId) => {
  const tripObjectId = toObjectId(tripId, 'tripId');
  const [trip, schedule] = await Promise.all([
    Trip.findById(tripObjectId).select('driverId assistantId').lean(),
    TripSchedule.findById(tripObjectId).select('driver.userId assistant.userId').lean(),
  ]);

  if (!trip && !schedule) {
    throw new CustomError('Trip not found', HTTP_STATUS.NOT_FOUND);
  }

  return findUsersByIds([
    trip?.driverId,
    trip?.assistantId,
    schedule?.driver?.userId,
    schedule?.assistant?.userId,
  ], { $in: ['DRIVER', 'BUS_ASSISTANT'] });
};

export const normalizeNotificationTarget = (payload = {}) => {
  if (payload.target?.type) {
    return {
      ...payload.target,
      type: String(payload.target.type).trim().toUpperCase(),
    };
  }

  const audience = payload.targetAudience || 'all';
  const targetType = LEGACY_AUDIENCE_TO_TARGET_TYPE[audience];
  const role = payload.role || LEGACY_AUDIENCE_ROLE[audience] || null;

  return {
    type: targetType,
    role,
    userId: payload.userId,
    userIds: payload.userIds,
    routeId: payload.routeId,
    tripId: payload.tripId,
    vehicleId: payload.vehicleId,
  };
};

export const resolveNotificationRecipients = async (target = {}) => {
  const targetType = String(target.type || '').trim().toUpperCase();

  if (targetType === NOTIFICATION_TARGET_TYPES.USER) {
    return findUsersByIds([target.userId]);
  }

  if (targetType === NOTIFICATION_TARGET_TYPES.USERS) {
    return findUsersByIds(target.userIds || []);
  }

  if (targetType === NOTIFICATION_TARGET_TYPES.ALL_USERS) {
    return User.find(ACTIVE_USER_FILTER).select('_id email fullName role preferences notificationEnabled').lean();
  }

  if (targetType === NOTIFICATION_TARGET_TYPES.ALL_PASSENGERS) {
    return User.find({ ...ACTIVE_USER_FILTER, role: 'PASSENGER' })
      .select('_id email fullName role preferences notificationEnabled')
      .lean();
  }

  if (targetType === NOTIFICATION_TARGET_TYPES.ALL_STAFF) {
    return User.find({ ...ACTIVE_USER_FILTER, role: { $in: STAFF_ROLES } })
      .select('_id email fullName role preferences notificationEnabled')
      .lean();
  }

  if (targetType === NOTIFICATION_TARGET_TYPES.ROLE) {
    const role = normalizeRole(target.role);
    if (!role) {
      throw new CustomError('Role is required for role notifications', HTTP_STATUS.BAD_REQUEST);
    }
    return User.find({ ...ACTIVE_USER_FILTER, role })
      .select('_id email fullName role preferences notificationEnabled')
      .lean();
  }

  if (targetType === NOTIFICATION_TARGET_TYPES.ADMINS) {
    return User.find({ ...ACTIVE_USER_FILTER, role: 'ADMIN' })
      .select('_id email fullName role preferences notificationEnabled')
      .lean();
  }

  if (targetType === NOTIFICATION_TARGET_TYPES.ROUTE_PASSENGERS) {
    if (!target.routeId) {
      throw new CustomError('Route is required for route passenger notifications', HTTP_STATUS.BAD_REQUEST);
    }
    return resolveRoutePassengerUsers(target.routeId);
  }

  if (targetType === NOTIFICATION_TARGET_TYPES.TRIP_STAFF) {
    if (!target.tripId) {
      throw new CustomError('Trip is required for trip staff notifications', HTTP_STATUS.BAD_REQUEST);
    }
    return resolveTripStaffUsers(target.tripId);
  }

  if (targetType === NOTIFICATION_TARGET_TYPES.VEHICLE_STAFF) {
    throw new CustomError('Vehicle staff notifications are not supported by the current schema', HTTP_STATUS.BAD_REQUEST);
  }

  throw new CustomError('Unsupported notification target type', HTTP_STATUS.BAD_REQUEST);
};

export const resolveNotificationRecipientIds = async (payloadOrTarget = {}) => {
  const target = payloadOrTarget.type ? payloadOrTarget : normalizeNotificationTarget(payloadOrTarget);
  const users = await resolveNotificationRecipients(target);
  return users.map((user) => user._id);
};

