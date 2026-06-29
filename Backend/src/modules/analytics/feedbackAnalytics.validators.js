import mongoose from 'mongoose';

export const FEEDBACK_CATEGORIES = [
  'punctuality',
  'driver_behavior',
  'bus_cleanliness',
  'safety',
  'overcrowding',
  'ticketing',
  'route_information',
  'app_experience',
  'other',
];

export const FEEDBACK_GROUPS = [
  'day',
  'week',
  'month',
  'route',
  'driver',
  'vehicle',
  'category',
  'sentiment',
];

const isValidDate = (value) => value && !Number.isNaN(new Date(value).getTime());

const validateObjectId = (query, field, errors) => {
  if (query[field] && !mongoose.isValidObjectId(query[field])) {
    errors[field] = `Invalid ${field}`;
  }
};

export const validateFeedbackAnalyticsQuery = (query = {}) => {
  const errors = {};

  ['routeId', 'driverId', 'vehicleId'].forEach((field) => validateObjectId(query, field, errors));

  if (query.category && !FEEDBACK_CATEGORIES.includes(String(query.category))) {
    errors.category = 'Invalid feedback category';
  }

  if (query.rating) {
    const rating = Number(query.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      errors.rating = 'Rating must be an integer from 1 to 5';
    }
  }

  if (query.groupBy && !FEEDBACK_GROUPS.includes(String(query.groupBy))) {
    errors.groupBy = 'Invalid feedback analytics groupBy';
  }

  ['from', 'to'].forEach((field) => {
    if (query[field] && !isValidDate(query[field])) {
      errors[field] = `Invalid ${field} date`;
    }
  });

  if (isValidDate(query.from) && isValidDate(query.to) && new Date(query.from) > new Date(query.to)) {
    errors.to = 'From date must not be later than to date';
  }

  if (query.groupKey && String(query.groupKey).length > 160) {
    errors.groupKey = 'Group key must not exceed 160 characters';
  }

  return errors;
};

export default {
  validateFeedbackAnalyticsQuery,
};
