import mongoose from 'mongoose';
import {
  VEHICLE_ISSUE_DECISIONS,
  VEHICLE_ISSUE_SEVERITIES,
  VEHICLE_ISSUE_STATUSES,
  VEHICLE_ISSUE_TYPES,
} from './VehicleIssue.js';

const isValidDate = (value) => value && !Number.isNaN(new Date(value).getTime());

export const validateVehicleIssueListQuery = (query) => {
  const errors = {};

  if (query.status && !VEHICLE_ISSUE_STATUSES.includes(query.status)) {
    errors.status = 'Invalid vehicle issue status';
  }

  if (query.severity && !VEHICLE_ISSUE_SEVERITIES.includes(query.severity)) {
    errors.severity = 'Invalid vehicle issue severity';
  }

  if (query.issueType && !VEHICLE_ISSUE_TYPES.includes(query.issueType)) {
    errors.issueType = 'Invalid vehicle issue type';
  }

  if (query.vehicleId && !mongoose.isValidObjectId(query.vehicleId)) {
    errors.vehicleId = 'Invalid vehicle identifier';
  }

  if (query.startDate && !isValidDate(query.startDate)) {
    errors.startDate = 'Invalid start date';
  }

  if (query.endDate && !isValidDate(query.endDate)) {
    errors.endDate = 'Invalid end date';
  }

  if (isValidDate(query.startDate) && isValidDate(query.endDate)) {
    if (new Date(query.startDate) > new Date(query.endDate)) {
      errors.endDate = 'Start date must not be later than end date';
    }
  }

  return errors;
};

export const validateVehicleIssueIdParam = (params) => {
  const errors = {};

  if (!mongoose.isValidObjectId(params.id)) {
    errors.id = 'Invalid vehicle issue identifier';
  }

  return errors;
};

export const validateVehicleIssueReview = (body) => {
  const errors = {};

  if (!body.decision || !VEHICLE_ISSUE_DECISIONS.includes(body.decision)) {
    errors.decision = 'Invalid review decision';
  }

  if (body.adminNote !== undefined && String(body.adminNote).trim().length > 2000) {
    errors.adminNote = 'Admin note must not exceed 2000 characters';
  }

  ['markVehicleUnderMaintenance', 'createMaintenanceTask'].forEach((field) => {
    if (body[field] !== undefined && typeof body[field] !== 'boolean') {
      errors[field] = `${field} must be boolean`;
    }
  });

  if (body.replacementVehicleId && !mongoose.isValidObjectId(body.replacementVehicleId)) {
    errors.replacementVehicleId = 'Invalid replacement vehicle identifier';
  }

  if (
    ['no_action_needed', 'dismissed'].includes(body.decision)
    && !String(body.adminNote || '').trim()
  ) {
    errors.adminNote = 'Admin note is required for no-action or dismissed decisions';
  }

  return errors;
};

export default {
  validateVehicleIssueListQuery,
  validateVehicleIssueIdParam,
  validateVehicleIssueReview,
};
