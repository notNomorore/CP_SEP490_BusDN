import mongoose from 'mongoose';
import { FARE_POLICY_STATUS, FARE_PRICING_TYPES } from './FareMatrix.js';
import { MONTHLY_PASS_TYPES } from './MonthlyPassPricing.js';
import { PRIORITY_DISCOUNT_TYPES } from './PriorityDiscount.js';

const isValidDate = (value) => value && !Number.isNaN(new Date(value).getTime());
const isPositive = (value) => Number.isFinite(Number(value)) && Number(value) > 0;
const isNonNegative = (value) => Number.isFinite(Number(value)) && Number(value) >= 0;

const validateObjectId = (value, field, errors) => {
  if (value && !mongoose.isValidObjectId(value)) {
    errors[field] = `${field} must be a valid identifier`;
  }
};

const validateWindow = (body, errors) => {
  if (!body.effectiveFrom) {
    errors.effectiveFrom = 'Effective from is required';
  } else if (!isValidDate(body.effectiveFrom)) {
    errors.effectiveFrom = 'Effective from must be a valid date';
  }

  if (body.effectiveTo && !isValidDate(body.effectiveTo)) {
    errors.effectiveTo = 'Effective to must be a valid date';
  }

  if (isValidDate(body.effectiveFrom) && isValidDate(body.effectiveTo)) {
    if (new Date(body.effectiveFrom) >= new Date(body.effectiveTo)) {
      errors.effectiveTo = 'Effective to must be after effective from';
    }
  }
};

export const validateFareMatrixPayload = (body) => {
  const errors = {};

  if (!FARE_PRICING_TYPES.includes(body.pricingType)) {
    errors.pricingType = 'Invalid pricing type';
  }

  validateObjectId(body.routeId, 'routeId', errors);
  validateWindow(body, errors);

  if (!isPositive(body.baseFare)) {
    errors.baseFare = 'Base fare must be greater than 0';
  }

  if (body.minDistanceKm !== undefined && body.minDistanceKm !== null && body.minDistanceKm !== '') {
    if (!isNonNegative(body.minDistanceKm)) {
      errors.minDistanceKm = 'Minimum distance must be 0 or greater';
    }
  }

  if (body.maxDistanceKm !== undefined && body.maxDistanceKm !== null && body.maxDistanceKm !== '') {
    if (!isNonNegative(body.maxDistanceKm)) {
      errors.maxDistanceKm = 'Maximum distance must be 0 or greater';
    }
  }

  if (body.minDistanceKm !== '' && body.maxDistanceKm !== '' && body.minDistanceKm != null && body.maxDistanceKm != null) {
    if (Number(body.maxDistanceKm) <= Number(body.minDistanceKm)) {
      errors.maxDistanceKm = 'Maximum distance must be greater than minimum distance';
    }
  }

  if (body.pricingType === 'ROUTE_BASED' && !body.routeId) {
    errors.routeId = 'Route is required for route-based fare rules';
  }

  if (body.pricingType === 'DISTANCE_BASED' && body.minDistanceKm == null && body.maxDistanceKm == null) {
    errors.minDistanceKm = 'Distance-based fare rules require a distance range';
  }

  if (body.status && !FARE_POLICY_STATUS.includes(body.status)) {
    errors.status = 'Invalid status';
  }

  return errors;
};

export const validateMonthlyPassPricingPayload = (body) => {
  const errors = {};

  if (!MONTHLY_PASS_TYPES.includes(body.passType)) {
    errors.passType = 'Invalid pass type';
  }

  validateObjectId(body.routeId, 'routeId', errors);
  validateWindow(body, errors);

  if (!isPositive(body.price)) {
    errors.price = 'Price must be greater than 0';
  }

  if (body.validityDays !== undefined && (!Number.isInteger(Number(body.validityDays)) || Number(body.validityDays) < 1)) {
    errors.validityDays = 'Validity days must be a positive integer';
  }

  if (body.passType === 'ROUTE_PASS' && !body.routeId) {
    errors.routeId = 'Route is required for route passes';
  }

  if (body.status && !FARE_POLICY_STATUS.includes(body.status)) {
    errors.status = 'Invalid status';
  }

  return errors;
};

export const validatePriorityDiscountPayload = (body) => {
  const errors = {};

  if (!PRIORITY_DISCOUNT_TYPES.includes(body.priorityType)) {
    errors.priorityType = 'Invalid priority type';
  }

  validateWindow(body, errors);

  if (!Number.isFinite(Number(body.discountPercent)) || Number(body.discountPercent) < 0 || Number(body.discountPercent) > 100) {
    errors.discountPercent = 'Discount percent must be from 0 to 100';
  }

  if (body.maxDiscountAmount !== undefined && body.maxDiscountAmount !== null && body.maxDiscountAmount !== '') {
    if (!isNonNegative(body.maxDiscountAmount)) {
      errors.maxDiscountAmount = 'Max discount amount must be 0 or greater';
    }
  }

  if (body.status && !FARE_POLICY_STATUS.includes(body.status)) {
    errors.status = 'Invalid status';
  }

  return errors;
};

export const validateStatusPayload = (body) => {
  const errors = {};

  if (!FARE_POLICY_STATUS.includes(body.status)) {
    errors.status = 'Status must be ACTIVE or INACTIVE';
  }

  return errors;
};

export const validateObjectIdParam = (params) => {
  const errors = {};

  if (!mongoose.isValidObjectId(params.id)) {
    errors.id = 'Invalid fare policy identifier';
  }

  return errors;
};
