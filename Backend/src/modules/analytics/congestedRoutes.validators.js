import mongoose from 'mongoose';

const SEVERITIES = ['low', 'medium', 'high', 'critical'];

const isValidDate = (value) => value && !Number.isNaN(new Date(value).getTime());

export const validateCongestedRoutesQuery = (query = {}) => {
  const errors = {};

  if (query.routeId && !mongoose.isValidObjectId(query.routeId)) {
    errors.routeId = 'Invalid routeId';
  }

  if (query.severity && !SEVERITIES.includes(String(query.severity).toLowerCase())) {
    errors.severity = 'Severity must be low, medium, high, or critical';
  }

  if (query.area && String(query.area).trim().length > 120) {
    errors.area = 'Area must not exceed 120 characters';
  }

  ['from', 'to'].forEach((field) => {
    if (query[field] && !isValidDate(query[field])) {
      errors[field] = `Invalid ${field} date`;
    }
  });

  if (isValidDate(query.from) && isValidDate(query.to) && new Date(query.from) > new Date(query.to)) {
    errors.to = 'From date must not be later than to date';
  }

  return errors;
};

export const validateCongestedRouteIdParam = (params = {}) => {
  const errors = {};

  if (!mongoose.isValidObjectId(params.routeId)) {
    errors.routeId = 'Invalid route identifier';
  }

  return errors;
};

export default {
  validateCongestedRoutesQuery,
  validateCongestedRouteIdParam,
};
