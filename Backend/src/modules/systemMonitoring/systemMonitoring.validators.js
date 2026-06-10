import mongoose from 'mongoose';
import { AUDIT_STATUSES, RISK_LEVELS } from './AuditLog.js';
import {
  SUSPICIOUS_ACTIVITY_TYPES,
  SUSPICIOUS_STATUSES,
} from './SuspiciousActivity.js';

const isValidDate = (value) => value && !Number.isNaN(new Date(value).getTime());

const validateBase = (query) => {
  const errors = {};
  if (query.userId && !mongoose.isValidObjectId(query.userId)) {
    errors.userId = 'Invalid user identifier';
  }
  if (query.startDate && !isValidDate(query.startDate)) {
    errors.startDate = 'Invalid start date';
  }
  if (query.endDate && !isValidDate(query.endDate)) {
    errors.endDate = 'Invalid end date';
  }
  if (isValidDate(query.startDate) && isValidDate(query.endDate)
    && new Date(query.startDate) > new Date(query.endDate)) {
    errors.endDate = 'Start date must not be later than end date';
  }
  ['page', 'limit'].forEach((field) => {
    if (query[field] && (!Number.isInteger(Number(query[field])) || Number(query[field]) < 1)) {
      errors[field] = `${field} must be a positive number`;
    }
  });
  return errors;
};

export const validateAuditLogQuery = (query) => {
  const errors = validateBase(query);
  if (query.status && !AUDIT_STATUSES.includes(query.status)) {
    errors.status = 'Invalid audit status';
  }
  if (query.riskLevel && !RISK_LEVELS.includes(query.riskLevel)) {
    errors.riskLevel = 'Invalid risk level';
  }
  return errors;
};

export const validateSuspiciousQuery = (query) => {
  const errors = validateBase(query);
  if (query.activityType && !SUSPICIOUS_ACTIVITY_TYPES.includes(query.activityType)) {
    errors.activityType = 'Invalid suspicious activity type';
  }
  if (query.status && !SUSPICIOUS_STATUSES.includes(query.status)) {
    errors.status = 'Invalid suspicious activity status';
  }
  if (query.riskLevel && !RISK_LEVELS.includes(query.riskLevel)) {
    errors.riskLevel = 'Invalid risk level';
  }
  return errors;
};

export const validateIdParam = (params) => {
  return mongoose.isValidObjectId(params.id) ? {} : { id: 'Invalid identifier' };
};

export const validateSuspiciousStatusUpdate = (body) => {
  const errors = {};
  if (!SUSPICIOUS_STATUSES.includes(body.status)) {
    errors.status = 'Invalid investigation status';
  }
  if (['RESOLVED', 'DISMISSED'].includes(body.status) && !String(body.adminNote || '').trim()) {
    errors.adminNote = 'Admin note is required when resolving or dismissing a case';
  }
  return errors;
};
