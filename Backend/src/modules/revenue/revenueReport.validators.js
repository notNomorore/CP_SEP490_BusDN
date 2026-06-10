import mongoose from 'mongoose';
import { PAYMENT_METHOD } from '../../constants/index.js';

export const SUPPORTED_TICKET_TYPES = ['E_TICKET', 'WALK_IN', 'MONTHLY_PASS'];
export const SUPPORTED_GROUP_BY = ['day', 'week', 'month', 'route', 'paymentMethod'];
export const SUPPORTED_EXPORT_FORMATS = ['pdf', 'excel'];

const supportedPaymentMethods = new Set([
  ...Object.values(PAYMENT_METHOD),
  ...Object.values(PAYMENT_METHOD).map((method) => method.toUpperCase()),
  'E_WALLET',
  'CASH',
  'CARD',
  'BANK_TRANSFER',
  'WALLET',
  'UNKNOWN',
]);

const isValidDate = (value) => value && !Number.isNaN(new Date(value).getTime());

export const validateRevenueReportQuery = (query) => {
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
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    if (startDate > endDate) {
      errors.endDate = 'Start date must not be later than end date';
    }
  }

  if (query.routeId && !mongoose.isValidObjectId(query.routeId)) {
    errors.routeId = 'Invalid route identifier';
  }

  if (query.paymentMethod && !supportedPaymentMethods.has(String(query.paymentMethod))) {
    errors.paymentMethod = 'Invalid payment method';
  }

  if (query.ticketType && !SUPPORTED_TICKET_TYPES.includes(String(query.ticketType).toUpperCase())) {
    errors.ticketType = 'Invalid ticket type';
  }

  if (query.groupBy && !SUPPORTED_GROUP_BY.includes(query.groupBy)) {
    errors.groupBy = 'Invalid groupBy value';
  }

  return errors;
};

export const validateRevenueExportQuery = (query) => {
  const errors = validateRevenueReportQuery(query);

  if (!query.format || !SUPPORTED_EXPORT_FORMATS.includes(String(query.format).toLowerCase())) {
    errors.format = 'Export format must be pdf or excel';
  }

  return errors;
};

export default {
  validateRevenueReportQuery,
  validateRevenueExportQuery,
};
