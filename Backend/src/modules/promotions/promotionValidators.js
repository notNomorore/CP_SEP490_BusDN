import mongoose from 'mongoose';
import {
  PROMOTION_APPLICABLE_TO,
  PROMOTION_DISCOUNT_TYPES,
  PROMOTION_STATUS,
} from './Promotion.js';

const isValidDate = (value) => {
  if (!value) {
    return false;
  }

  return !Number.isNaN(new Date(value).getTime());
};

const isPositiveNumber = (value) => typeof value === 'number' && Number.isFinite(value) && value > 0;
const isNonNegativeNumber = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;

const validatePromotionPayload = (body, { partial = false } = {}) => {
  const errors = {};

  const required = (field, message) => {
    if (!partial && (body[field] === undefined || body[field] === null || body[field] === '')) {
      errors[field] = message;
    }
  };

  required('code', 'Promotion code is required');
  required('name', 'Promotion name is required');
  required('discountType', 'Discount type is required');
  required('discountValue', 'Discount value is required');
  required('applicableTo', 'Applicable target is required');
  required('startDate', 'Start date is required');
  required('endDate', 'End date is required');

  if (body.code !== undefined && String(body.code).trim().length < 2) {
    errors.code = 'Promotion code must be at least 2 characters';
  }

  if (body.name !== undefined && String(body.name).trim().length < 2) {
    errors.name = 'Promotion name must be at least 2 characters';
  }

  if (body.discountType !== undefined && !PROMOTION_DISCOUNT_TYPES.includes(body.discountType)) {
    errors.discountType = 'Invalid discount type';
  }

  if (body.discountValue !== undefined) {
    const value = Number(body.discountValue);
    if (!isPositiveNumber(value)) {
      errors.discountValue = 'Discount value must be greater than 0';
    } else if (body.discountType === 'PERCENTAGE' && value > 100) {
      errors.discountValue = 'Percentage discount cannot exceed 100';
    }
  }

  if (body.maxDiscountAmount !== undefined && body.maxDiscountAmount !== null && body.maxDiscountAmount !== '') {
    if (!isNonNegativeNumber(Number(body.maxDiscountAmount))) {
      errors.maxDiscountAmount = 'Max discount amount must be a non-negative number';
    }
  }

  if (body.minOrderAmount !== undefined && !isNonNegativeNumber(Number(body.minOrderAmount))) {
    errors.minOrderAmount = 'Minimum order amount must be a non-negative number';
  }

  if (body.applicableTo !== undefined && !PROMOTION_APPLICABLE_TO.includes(body.applicableTo)) {
    errors.applicableTo = 'Invalid applicable target';
  }

  if (body.applicableTo === 'SELECTED_ROUTES') {
    if (!Array.isArray(body.routeIds) || body.routeIds.length === 0) {
      errors.routeIds = 'Route IDs are required for selected routes';
    } else if (body.routeIds.some((routeId) => !mongoose.isValidObjectId(routeId))) {
      errors.routeIds = 'Route IDs must be valid identifiers';
    }
  }

  if (body.startDate !== undefined && !isValidDate(body.startDate)) {
    errors.startDate = 'Invalid start date';
  }

  if (body.endDate !== undefined && !isValidDate(body.endDate)) {
    errors.endDate = 'Invalid end date';
  }

  if (isValidDate(body.startDate) && isValidDate(body.endDate)) {
    const startDate = new Date(body.startDate);
    const endDate = new Date(body.endDate);
    if (startDate >= endDate) {
      errors.endDate = 'Start date must be before end date';
    }
  }

  if (body.usageLimit !== undefined && body.usageLimit !== null && body.usageLimit !== '') {
    if (!Number.isInteger(Number(body.usageLimit)) || Number(body.usageLimit) < 1) {
      errors.usageLimit = 'Usage limit must be a positive integer';
    }
  }

  if (body.usagePerUser !== undefined) {
    if (!Number.isInteger(Number(body.usagePerUser)) || Number(body.usagePerUser) < 1) {
      errors.usagePerUser = 'Usage per user must be a positive integer';
    }
  }

  if (body.status !== undefined && !PROMOTION_STATUS.includes(body.status)) {
    errors.status = 'Invalid promotion status';
  }

  return errors;
};

export const validatePromotionCreate = (body) => validatePromotionPayload(body);
export const validatePromotionUpdate = (body) => validatePromotionPayload(body, { partial: true });

export const validatePromotionStatusUpdate = (body) => {
  const errors = {};

  if (!['ACTIVE', 'INACTIVE'].includes(body.status)) {
    errors.status = 'Status must be ACTIVE or INACTIVE';
  }

  return errors;
};

export const validatePromotionListQuery = (query) => {
  const errors = {};

  if (query.status && !PROMOTION_STATUS.includes(query.status)) {
    errors.status = 'Invalid status filter';
  }

  if (query.discountType && !PROMOTION_DISCOUNT_TYPES.includes(query.discountType)) {
    errors.discountType = 'Invalid discount type filter';
  }

  if (query.startDate && !isValidDate(query.startDate)) {
    errors.startDate = 'Invalid start date filter';
  }

  if (query.endDate && !isValidDate(query.endDate)) {
    errors.endDate = 'Invalid end date filter';
  }

  if (isValidDate(query.startDate) && isValidDate(query.endDate)) {
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    if (startDate > endDate) {
      errors.endDate = 'Start date filter must be before end date filter';
    }
  }

  return errors;
};

export const validateObjectIdParam = (params) => {
  const errors = {};

  if (!mongoose.isValidObjectId(params.id)) {
    errors.id = 'Invalid promotion identifier';
  }

  return errors;
};

export default {
  validatePromotionCreate,
  validatePromotionUpdate,
  validatePromotionStatusUpdate,
  validatePromotionListQuery,
  validateObjectIdParam,
};
