import mongoose from 'mongoose';
import {
  VIOLATION_SEVERITIES,
  VIOLATION_STATUSES,
  VIOLATION_TYPES,
} from './PassengerViolation.js';
import {
  RESTRICTION_STATUSES,
  RESTRICTION_TYPES,
} from './PassengerRestriction.js';

const validDate = (value) => value && !Number.isNaN(new Date(value).getTime());

export const validateViolationListQuery = (query) => {
  const errors = {};

  ['passengerId', 'routeId'].forEach((field) => {
    if (query[field] && !mongoose.isValidObjectId(query[field])) {
      errors[field] = `Invalid ${field}`;
    }
  });
  if (query.violationType && !VIOLATION_TYPES.includes(query.violationType)) {
    errors.violationType = 'Invalid violation type';
  }
  if (query.severity && !VIOLATION_SEVERITIES.includes(query.severity)) {
    errors.severity = 'Invalid severity';
  }
  if (query.status && !VIOLATION_STATUSES.includes(query.status)) {
    errors.status = 'Invalid violation status';
  }
  if (query.startDate && !validDate(query.startDate)) errors.startDate = 'Invalid start date';
  if (query.endDate && !validDate(query.endDate)) errors.endDate = 'Invalid end date';
  if (validDate(query.startDate) && validDate(query.endDate)
    && new Date(query.startDate) > new Date(query.endDate)) {
    errors.endDate = 'Start date must not be later than end date';
  }
  ['page', 'limit'].forEach((field) => {
    if (query[field] && (!Number.isInteger(Number(query[field])) || Number(query[field]) < 1)) {
      errors[field] = `${field} must be a positive integer`;
    }
  });
  return errors;
};

export const validateIdParam = (params) => (
  mongoose.isValidObjectId(params.id) ? {} : { id: 'Invalid identifier' }
);

export const validateRestrictionPayload = (body) => {
  const errors = {};
  ['passengerId', 'violationId'].forEach((field) => {
    if (!body[field] || !mongoose.isValidObjectId(body[field])) {
      errors[field] = `${field} must be a valid ObjectId`;
    }
  });
  if (!RESTRICTION_TYPES.includes(body.restrictionType)) {
    errors.restrictionType = 'Invalid restriction type';
  }
  if (!String(body.reason || '').trim()) errors.reason = 'Reason is required';
  if (String(body.reason || '').trim().length > 2000) {
    errors.reason = 'Reason must not exceed 2000 characters';
  }
  if (!validDate(body.startDate)) errors.startDate = 'Valid start date is required';
  if (!validDate(body.endDate)) errors.endDate = 'Valid end date is required';
  if (validDate(body.startDate) && validDate(body.endDate)
    && new Date(body.startDate) > new Date(body.endDate)) {
    errors.endDate = 'Start date must not be later than end date';
  }
  return errors;
};

export const validateRestrictionStatus = (body) => {
  const allowed = RESTRICTION_STATUSES.filter((status) => status !== 'EXPIRED');
  return allowed.includes(body.status)
    ? {}
    : { status: 'Restriction status must be ACTIVE or REVOKED' };
};

export const validateRestrictionListQuery = (query) => {
  const errors = {};
  if (query.passengerId && !mongoose.isValidObjectId(query.passengerId)) {
    errors.passengerId = 'Invalid passengerId';
  }
  if (query.status && !RESTRICTION_STATUSES.includes(query.status)) {
    errors.status = 'Invalid restriction status';
  }
  if (query.restrictionType && !RESTRICTION_TYPES.includes(query.restrictionType)) {
    errors.restrictionType = 'Invalid restriction type';
  }
  return errors;
};

export default {
  validateViolationListQuery,
  validateIdParam,
  validateRestrictionPayload,
  validateRestrictionStatus,
  validateRestrictionListQuery,
};
