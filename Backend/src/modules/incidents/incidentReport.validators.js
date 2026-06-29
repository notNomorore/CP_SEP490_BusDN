import mongoose from 'mongoose';
import {
  INCIDENT_HANDLING_ACTIONS,
  INCIDENT_RESPONSIBLE_UNITS,
  INCIDENT_SEVERITIES,
  INCIDENT_STATUSES,
  INCIDENT_TYPES,
} from './IncidentReport.js';

const isValidDate = (value) => value && !Number.isNaN(new Date(value).getTime());

export const validateIncidentListQuery = (query) => {
  const errors = {};

  if (query.incidentType && !INCIDENT_TYPES.includes(query.incidentType)) {
    errors.incidentType = 'Invalid incident type';
  }

  if (query.severity && !INCIDENT_SEVERITIES.includes(query.severity)) {
    errors.severity = 'Invalid incident severity';
  }

  if (query.status && !INCIDENT_STATUSES.includes(query.status)) {
    errors.status = 'Invalid incident status';
  }

  ['routeId', 'vehicleId'].forEach((field) => {
    if (query[field] && !mongoose.isValidObjectId(query[field])) {
      errors[field] = `Invalid ${field}`;
    }
  });

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

export const validateIncidentIdParam = (params) => {
  const errors = {};

  if (!mongoose.isValidObjectId(params.id)) {
    errors.id = 'Invalid incident identifier';
  }

  return errors;
};

export const validateIncidentStatusUpdate = (body) => {
  const errors = {};

  if (!body.status || !INCIDENT_STATUSES.includes(body.status)) {
    errors.status = 'Invalid incident status';
  }

  if (body.adminNote !== undefined && String(body.adminNote).trim().length > 2000) {
    errors.adminNote = 'Admin note must not exceed 2000 characters';
  }

  if (body.resolutionSummary !== undefined && String(body.resolutionSummary).trim().length > 2000) {
    errors.resolutionSummary = 'Resolution summary must not exceed 2000 characters';
  }

  if (body.handlingAction && !INCIDENT_HANDLING_ACTIONS.includes(body.handlingAction)) {
    errors.handlingAction = 'Invalid handling action';
  }

  if (body.responsibleUnit && !INCIDENT_RESPONSIBLE_UNITS.includes(body.responsibleUnit)) {
    errors.responsibleUnit = 'Invalid responsible unit';
  }

  if (
    ['RESOLVED', 'REJECTED'].includes(body.status)
    && !String(body.resolutionSummary || body.adminNote || '').trim()
  ) {
    errors.resolutionSummary = 'Resolution summary is required when resolving or rejecting an incident';
  }

  return errors;
};

export default {
  validateIncidentListQuery,
  validateIncidentIdParam,
  validateIncidentStatusUpdate,
};
