import mongoose from 'mongoose';
import { VEHICLE_REASSIGNMENT_REASONS } from './VehicleReassignmentLog.js';

const isObjectId = (value) => !value || mongoose.isValidObjectId(value);

export const validateReplacementCandidateQuery = (query) => {
  const errors = {};

  if (!query.tripId && !query.routeId) {
    errors.tripId = 'tripId or routeId is required';
  }
  if (!isObjectId(query.tripId)) errors.tripId = 'Invalid tripId';
  if (!isObjectId(query.routeId)) errors.routeId = 'Invalid routeId';
  if (query.requiredCapacity !== undefined && query.requiredCapacity !== '' && Number(query.requiredCapacity) < 1) {
    errors.requiredCapacity = 'requiredCapacity must be a positive number';
  }

  return errors;
};

export const validateTripIdParam = (params) => {
  const errors = {};
  if (!mongoose.isValidObjectId(params.tripId)) errors.tripId = 'Invalid tripId';
  return errors;
};

export const validateAssignReplacementVehicle = (body) => {
  const errors = {};

  if (!mongoose.isValidObjectId(body.replacementVehicleId)) {
    errors.replacementVehicleId = 'Valid replacementVehicleId is required';
  }
  if (!VEHICLE_REASSIGNMENT_REASONS.includes(body.reason)) {
    errors.reason = 'Invalid replacement reason';
  }
  if (!String(body.note || '').trim()) {
    errors.note = 'Emergency replacement note is required';
  }
  if (String(body.note || '').length > 2000) {
    errors.note = 'Note must not exceed 2000 characters';
  }
  ['notifyStaff', 'notifyPassengers'].forEach((field) => {
    if (body[field] !== undefined && typeof body[field] !== 'boolean') {
      errors[field] = `${field} must be boolean`;
    }
  });

  return errors;
};
