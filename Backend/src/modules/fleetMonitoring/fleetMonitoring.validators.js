import mongoose from 'mongoose';

const STATUSES = ['active', 'idle', 'paused', 'delayed', 'incident', 'lost_signal'];
const DELAY_SEVERITIES = ['minor', 'moderate', 'severe', 'critical'];
const NOTIFY_TARGETS = ['driver', 'assistant', 'passenger', 'admin'];
const SORTS = [
  'delayMinutes',
  'delayMinutes:asc',
  'delayMinutes:desc',
  'startTime',
  'startTime:asc',
  'startTime:desc',
  'route',
  'route:asc',
  'route:desc',
  'lastGpsAt',
  'lastGpsAt:asc',
  'lastGpsAt:desc',
];

export const validateFleetLocationQuery = (query = {}) => {
  const errors = {};

  if (query.routeId && !mongoose.isValidObjectId(query.routeId)) {
    errors.routeId = 'Invalid routeId';
  }

  if (query.status && !STATUSES.includes(query.status)) {
    errors.status = 'Invalid fleet status';
  }

  if (query.keyword && String(query.keyword).length > 80) {
    errors.keyword = 'Keyword must not exceed 80 characters';
  }

  return errors;
};

export const validateActiveTripQuery = (query = {}) => {
  const errors = {};

  ['routeId', 'driverId', 'vehicleId'].forEach((field) => {
    if (query[field] && !mongoose.isValidObjectId(query[field])) {
      errors[field] = `Invalid ${field}`;
    }
  });

  if (query.status && !STATUSES.includes(query.status)) {
    errors.status = 'Invalid trip status';
  }

  if (query.keyword && String(query.keyword).length > 80) {
    errors.keyword = 'Keyword must not exceed 80 characters';
  }

  if (query.sort && !SORTS.includes(query.sort)) {
    errors.sort = 'Invalid sort';
  }

  return errors;
};

export const validateDelayedTripQuery = (query = {}) => {
  const errors = {};

  if (query.routeId && !mongoose.isValidObjectId(query.routeId)) {
    errors.routeId = 'Invalid routeId';
  }

  if (query.severity && !DELAY_SEVERITIES.includes(query.severity)) {
    errors.severity = 'Invalid delay severity';
  }

  if (query.reason && String(query.reason).length > 80) {
    errors.reason = 'Reason must not exceed 80 characters';
  }

  ['from', 'to'].forEach((field) => {
    if (query[field] && Number.isNaN(new Date(query[field]).getTime())) {
      errors[field] = `Invalid ${field} date`;
    }
  });

  if (query.from && query.to && new Date(query.from) > new Date(query.to)) {
    errors.to = 'To date must be after from date';
  }

  return errors;
};

export const validateDelayedTripAcknowledge = (body = {}) => {
  const errors = {};

  if (!String(body.reason || '').trim()) {
    errors.reason = 'Reason is required';
  } else if (String(body.reason).length > 80) {
    errors.reason = 'Reason must not exceed 80 characters';
  }

  if (!String(body.note || '').trim()) {
    errors.note = 'Operation note is required';
  } else if (String(body.note).length > 2000) {
    errors.note = 'Operation note must not exceed 2000 characters';
  }

  if (body.notifyTargetRole && !NOTIFY_TARGETS.includes(body.notifyTargetRole)) {
    errors.notifyTargetRole = 'Invalid notification target';
  }

  return errors;
};

export const validateTripIdParam = (params = {}) => {
  const errors = {};
  if (!mongoose.isValidObjectId(params.tripId)) {
    errors.tripId = 'Invalid tripId';
  }
  return errors;
};

export default {
  validateFleetLocationQuery,
  validateActiveTripQuery,
  validateDelayedTripQuery,
  validateDelayedTripAcknowledge,
  validateTripIdParam,
};
