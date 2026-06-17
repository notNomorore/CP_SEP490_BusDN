import mongoose from 'mongoose';
import {
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_TARGET_AUDIENCES,
  NOTIFICATION_TYPES,
} from './Notification.js';

const isObjectId = (value) => mongoose.isValidObjectId(value);

export const validateBroadcastPayload = (body) => {
  const errors = {};
  const title = String(body.title || '').trim();
  const message = String(body.message || '').trim();

  if (!title) errors.title = 'Title is required';
  if (title.length > 160) errors.title = 'Title must not exceed 160 characters';
  if (!message) errors.message = 'Message is required';
  if (message.length > 4000) errors.message = 'Message must not exceed 4000 characters';

  if (!NOTIFICATION_TYPES.includes(body.type)) {
    errors.type = 'Invalid notification type';
  }

  if (body.priority && !NOTIFICATION_PRIORITIES.includes(body.priority)) {
    errors.priority = 'Invalid priority';
  }

  if (!NOTIFICATION_TARGET_AUDIENCES.includes(body.targetAudience)) {
    errors.targetAudience = 'Invalid target audience';
  }

  if (body.targetAudience === 'route_passengers' && !isObjectId(body.routeId)) {
    errors.routeId = 'Route is required for route passenger notifications';
  }

  if (body.targetAudience === 'trip_staff' && !isObjectId(body.tripId)) {
    errors.tripId = 'Trip is required for trip staff notifications';
  }

  if (body.targetAudience === 'specific_users') {
    if (!Array.isArray(body.userIds) || body.userIds.length === 0) {
      errors.userIds = 'At least one user is required';
    } else if (body.userIds.some((userId) => !isObjectId(userId))) {
      errors.userIds = 'User IDs must be valid identifiers';
    }
  }

  ['routeId', 'tripId'].forEach((field) => {
    if (body[field] && !isObjectId(body[field])) {
      errors[field] = `Invalid ${field}`;
    }
  });

  ['scheduledAt', 'expiresAt'].forEach((field) => {
    if (body[field] && Number.isNaN(new Date(body[field]).getTime())) {
      errors[field] = `Invalid ${field}`;
    }
  });

  if (body.scheduledAt && body.expiresAt && new Date(body.scheduledAt) >= new Date(body.expiresAt)) {
    errors.expiresAt = 'Expiration must be after scheduled time';
  }

  return errors;
};

export const validateNotificationListQuery = (query) => {
  const errors = {};

  if (query.status && !['draft', 'scheduled', 'sent', 'cancelled'].includes(query.status)) {
    errors.status = 'Invalid status';
  }

  if (query.type && !NOTIFICATION_TYPES.includes(query.type)) {
    errors.type = 'Invalid notification type';
  }

  if (query.targetAudience && !NOTIFICATION_TARGET_AUDIENCES.includes(query.targetAudience)) {
    errors.targetAudience = 'Invalid target audience';
  }

  if (query.page && (!Number.isInteger(Number(query.page)) || Number(query.page) < 1)) {
    errors.page = 'Page must be a positive integer';
  }

  if (query.limit && (!Number.isInteger(Number(query.limit)) || Number(query.limit) < 1)) {
    errors.limit = 'Limit must be a positive integer';
  }

  return errors;
};

export const validateObjectIdParam = (params) => {
  const errors = {};
  if (!isObjectId(params.id)) {
    errors.id = 'Invalid notification identifier';
  }
  return errors;
};
