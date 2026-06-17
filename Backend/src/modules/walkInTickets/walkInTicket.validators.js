import mongoose from 'mongoose';
import { WALKIN_PAYMENT_METHODS } from './WalkInTicket.js';

const isValidDate = (value) => value && !Number.isNaN(new Date(value).getTime());

export const validateWalkInQuery = (query) => {
  const errors = {};

  ['routeId', 'busAssistantId', 'shiftId'].forEach((field) => {
    if (query[field] && !mongoose.isValidObjectId(query[field])) {
      errors[field] = `Invalid ${field}`;
    }
  });

  if (query.paymentMethod && !WALKIN_PAYMENT_METHODS.includes(query.paymentMethod)) {
    errors.paymentMethod = 'Invalid payment method';
  }

  if (query.startDate && !isValidDate(query.startDate)) {
    errors.startDate = 'Invalid start date';
  }
  if (query.endDate && !isValidDate(query.endDate)) {
    errors.endDate = 'Invalid end date';
  }
  if (
    isValidDate(query.startDate)
    && isValidDate(query.endDate)
    && new Date(query.startDate) > new Date(query.endDate)
  ) {
    errors.endDate = 'Start date must not be later than end date';
  }

  ['page', 'limit'].forEach((field) => {
    if (query[field] && (!Number.isInteger(Number(query[field])) || Number(query[field]) < 1)) {
      errors[field] = `${field} must be a positive integer`;
    }
  });

  return errors;
};

export const validateWalkInId = (params) => {
  return mongoose.isValidObjectId(params.id) ? {} : { id: 'Invalid walk-in ticket identifier' };
};

export default {
  validateWalkInQuery,
  validateWalkInId,
};
