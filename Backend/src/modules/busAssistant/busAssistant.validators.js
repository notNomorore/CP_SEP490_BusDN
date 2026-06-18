import mongoose from 'mongoose';

export const BUS_ASSISTANT_PAYMENT_METHODS = ['CASH', 'QR', 'E_WALLET'];

const requiredObjectId = (payload, field, errors) => {
  if (!payload[field]) {
    errors[field] = `${field} is required`;
  } else if (!mongoose.isValidObjectId(payload[field])) {
    errors[field] = `Invalid ${field}`;
  }
};

export const validateTicketValidation = (body) => {
  const errors = {};
  if (!String(body.qrCode || '').trim()) errors.qrCode = 'QR code is required';
  requiredObjectId(body, 'tripId', errors);
  requiredObjectId(body, 'vehicleId', errors);
  return errors;
};

export const validateWalkInTicket = (body) => {
  const errors = {};
  ['routeId', 'tripId', 'fromStopId', 'toStopId'].forEach((field) => requiredObjectId(body, field, errors));
  const quantity = Number(body.passengerQuantity);
  const amount = Number(body.amount);
  if (!String(body.passengerType || '').trim()) errors.passengerType = 'Passenger type is required';
  if (!String(body.ticketType || '').trim()) errors.ticketType = 'Ticket type is required';
  if (!Number.isInteger(quantity) || quantity < 1) errors.passengerQuantity = 'Passenger quantity must be greater than 0';
  if (!Number.isFinite(amount) || amount < 0) errors.amount = 'Amount must be zero or greater';
  if (!BUS_ASSISTANT_PAYMENT_METHODS.includes(body.paymentMethod)) errors.paymentMethod = 'Invalid payment method';
  return errors;
};

export const validateShiftRevenueQuery = (query) => {
  const errors = {};
  ['shiftId', 'routeId'].forEach((field) => {
    if (query[field] && !mongoose.isValidObjectId(query[field])) errors[field] = `Invalid ${field}`;
  });
  if (query.date && Number.isNaN(new Date(query.date).getTime())) errors.date = 'Invalid date';
  return errors;
};

export const validateRevenueSummary = (body) => {
  const errors = {};
  requiredObjectId(body, 'shiftId', errors);
  const amount = Number(body.actualCollectedAmount);
  if (!Number.isFinite(amount) || amount < 0) errors.actualCollectedAmount = 'Actual collected amount must be zero or greater';
  if (body.attachmentUrls && !Array.isArray(body.attachmentUrls)) errors.attachmentUrls = 'Attachment URLs must be an array';
  return errors;
};

export default {
  validateTicketValidation,
  validateWalkInTicket,
  validateShiftRevenueQuery,
  validateRevenueSummary,
};
