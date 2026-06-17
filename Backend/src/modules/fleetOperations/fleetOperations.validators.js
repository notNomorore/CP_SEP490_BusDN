import mongoose from 'mongoose';
import {
  INCIDENT_SEVERITIES,
  INCIDENT_STATUSES,
  INCIDENT_TYPES,
  REPORTER_ROLES,
  TRIP_STATUSES,
  VEHICLE_STATUSES,
} from './fleetOperations.constants.js';

const isObjectId = (value) => !value || mongoose.isValidObjectId(value);
const isDate = (value) => !value || !Number.isNaN(new Date(value).getTime());
const isLat = (value) => Number.isFinite(Number(value)) && Number(value) >= -90 && Number(value) <= 90;
const isLng = (value) => Number.isFinite(Number(value)) && Number(value) >= -180 && Number(value) <= 180;
const isHeading = (value) => value === undefined || (Number(value) >= 0 && Number(value) <= 360);
const isSpeed = (value) => value === undefined || Number(value) >= 0;

export const validateVehicleCreate = (body) => {
  const errors = {};

  if (!String(body.plateNumber || '').trim()) errors.plateNumber = 'Plate number is required';
  if (!String(body.vehicleCode || '').trim()) errors.vehicleCode = 'Vehicle code is required';
  if (!Number.isFinite(Number(body.capacity)) || Number(body.capacity) < 1) {
    errors.capacity = 'Capacity must be a positive number';
  }
  if (body.status && !VEHICLE_STATUSES.includes(body.status)) errors.status = 'Invalid vehicle status';
  if (!isObjectId(body.assignedRouteId)) errors.assignedRouteId = 'Invalid assigned route';

  return errors;
};

export const validateTripCreate = (body) => {
  const errors = {};

  ['routeId', 'vehicleId', 'driverId'].forEach((field) => {
    if (!mongoose.isValidObjectId(body[field])) errors[field] = `Invalid ${field}`;
  });
  ['scheduleId', 'assistantId', 'nextStopId'].forEach((field) => {
    if (!isObjectId(body[field])) errors[field] = `Invalid ${field}`;
  });
  if (!isDate(body.plannedStartTime)) errors.plannedStartTime = 'Invalid planned start time';
  if (!isDate(body.plannedEndTime)) errors.plannedEndTime = 'Invalid planned end time';
  if (!body.plannedStartTime) errors.plannedStartTime = 'Planned start time is required';
  if (!body.plannedEndTime) errors.plannedEndTime = 'Planned end time is required';
  if (body.status && !TRIP_STATUSES.includes(body.status)) errors.status = 'Invalid trip status';

  return errors;
};

export const validateGpsUpdate = (body) => {
  const errors = {};

  if (!mongoose.isValidObjectId(body.vehicleId)) errors.vehicleId = 'Invalid vehicleId';
  if (!isObjectId(body.tripId)) errors.tripId = 'Invalid tripId';
  if (!isLat(body.lat)) errors.lat = 'Latitude must be between -90 and 90';
  if (!isLng(body.lng)) errors.lng = 'Longitude must be between -180 and 180';
  if (!isSpeed(body.speed)) errors.speed = 'Speed must be 0 or greater';
  if (!isHeading(body.heading)) errors.heading = 'Heading must be between 0 and 360';
  if (!isDate(body.recordedAt)) errors.recordedAt = 'Invalid recordedAt';

  return errors;
};

export const validateIncidentCreate = (body) => {
  const errors = {};

  ['tripId', 'vehicleId', 'routeId', 'reporterId'].forEach((field) => {
    if (!isObjectId(body[field])) errors[field] = `Invalid ${field}`;
  });
  if (body.reporterRole && !REPORTER_ROLES.includes(body.reporterRole)) {
    errors.reporterRole = 'Invalid reporter role';
  }
  if (!INCIDENT_TYPES.includes(body.type)) errors.type = 'Invalid incident type';
  if (body.severity && !INCIDENT_SEVERITIES.includes(body.severity)) {
    errors.severity = 'Invalid severity';
  }
  if (!String(body.description || '').trim()) errors.description = 'Description is required';
  if (!body.location || !isLat(body.location.lat) || !isLng(body.location.lng)) {
    errors.location = 'Location with valid lat/lng is required';
  }

  return errors;
};

export const validateIncidentStatusUpdate = (body) => {
  const errors = {};

  if (!INCIDENT_STATUSES.includes(body.status)) errors.status = 'Invalid incident status';
  if (body.adminNote !== undefined && String(body.adminNote).length > 2000) {
    errors.adminNote = 'Admin note must not exceed 2000 characters';
  }

  return errors;
};

export const validateIdParam = (params) => {
  const errors = {};
  if (!mongoose.isValidObjectId(params.id)) errors.id = 'Invalid id';
  return errors;
};
