import mongoose from 'mongoose';

const SUPPORTED_GROUP_BY = ['day', 'week', 'month', 'route'];

const isValidDate = (value) => value && !Number.isNaN(new Date(value).getTime());

export const validateRouteEfficiencyQuery = (query) => {
  const errors = {};

  if (!query.startDate) {
    errors.startDate = 'Start date is required';
  } else if (!isValidDate(query.startDate)) {
    errors.startDate = 'Invalid start date';
  }

  if (!query.endDate) {
    errors.endDate = 'End date is required';
  } else if (!isValidDate(query.endDate)) {
    errors.endDate = 'Invalid end date';
  }

  if (isValidDate(query.startDate) && isValidDate(query.endDate)) {
    if (new Date(query.startDate) > new Date(query.endDate)) {
      errors.endDate = 'Start date must not be later than end date';
    }
  }

  ['routeId', 'vehicleId', 'driverId'].forEach((field) => {
    if (query[field] && !mongoose.isValidObjectId(query[field])) {
      errors[field] = `Invalid ${field}`;
    }
  });

  if (query.groupBy && !SUPPORTED_GROUP_BY.includes(query.groupBy)) {
    errors.groupBy = 'Group by must be day, week, month, or route';
  }

  return errors;
};

export const validateRouteIdParam = (params) => {
  const errors = {};

  if (!mongoose.isValidObjectId(params.routeId)) {
    errors.routeId = 'Invalid route identifier';
  }

  return errors;
};

export default {
  validateRouteEfficiencyQuery,
  validateRouteIdParam,
};
