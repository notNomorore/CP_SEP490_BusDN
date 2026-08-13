import mongoose from 'mongoose';
import {
  EMERGENCY_BREAKDOWN_STATUSES,
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

  if (query.emergency && !['true', 'false', '1', '0'].includes(String(query.emergency))) {
    errors.emergency = 'Invalid emergency filter';
  }

  if (query.emergencyStatus && !EMERGENCY_BREAKDOWN_STATUSES.includes(query.emergencyStatus)) {
    errors.emergencyStatus = 'Invalid emergency status';
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

export const validateEmergencyBreakdownDispatch = (body) => {
  const errors = {};

  if (!body.standbyVehicleId || !mongoose.isValidObjectId(body.standbyVehicleId)) {
    errors.standbyVehicleId = 'Valid standbyVehicleId is required';
  }

  if (body.assignedDriverId && !mongoose.isValidObjectId(body.assignedDriverId)) {
    errors.assignedDriverId = 'Invalid assigned driver identifier';
  }

  if (body.adminNote !== undefined && String(body.adminNote).trim().length > 2000) {
    errors.adminNote = 'Admin note must not exceed 2000 characters';
  }

  const estimatedDelayMinutes = Number(body.estimatedDelayMinutes);
  if (!Number.isInteger(estimatedDelayMinutes) || estimatedDelayMinutes < 1 || estimatedDelayMinutes > 1440) {
    errors.estimatedDelayMinutes = 'Estimated delay must be an integer from 1 to 1440 minutes';
  }

  const staffNotificationMessage = String(body.staffNotificationMessage || '').trim();
  const passengerNotificationMessage = String(body.passengerNotificationMessage || '').trim();
  if (body.notifyStaff !== undefined && typeof body.notifyStaff !== 'boolean') {
    errors.notifyStaff = 'notifyStaff must be boolean';
  }
  if (body.notifyPassengers !== undefined && typeof body.notifyPassengers !== 'boolean') {
    errors.notifyPassengers = 'notifyPassengers must be boolean';
  }
  if (body.notifyStaff && !staffNotificationMessage) {
    errors.staffNotificationMessage = 'Staff notification message is required';
  } else if (staffNotificationMessage.length > 2000) {
    errors.staffNotificationMessage = 'Staff notification message must not exceed 2000 characters';
  }
  if (body.notifyPassengers && !passengerNotificationMessage) {
    errors.passengerNotificationMessage = 'Passenger notification message is required';
  } else if (passengerNotificationMessage.length > 2000) {
    errors.passengerNotificationMessage = 'Passenger notification message must not exceed 2000 characters';
  }

  return errors;
};

export default {
  validateVehicleIssueListQuery,
  validateVehicleIssueIdParam,
  validateVehicleIssueReview,
  validateEmergencyBreakdownDispatch,
};
