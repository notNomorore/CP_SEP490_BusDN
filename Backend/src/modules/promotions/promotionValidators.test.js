import { describe, expect, it } from 'vitest';
import {
  validatePromotionCreate,
  validatePromotionUpdate,
} from './promotionValidators.js';

const validPromotion = {
  code: 'DANANG20',
  name: 'Da Nang route discount',
  discountType: 'PERCENTAGE',
  discountValue: 20,
  applicableTo: 'ALL_ROUTES',
  startDate: '2026-08-01',
  endDate: '2026-08-31',
  usageLimit: 100,
  usagePerUser: 1,
};

describe('promotion validators', () => {
  it('accepts a valid percentage promotion', () => {
    expect(validatePromotionCreate(validPromotion)).toEqual({});
  });

  it('accepts a valid fixed amount promotion', () => {
    expect(validatePromotionCreate({
      ...validPromotion,
      discountType: 'FIXED_AMOUNT',
      discountValue: 10000,
    })).toEqual({});
  });

  it('rejects invalid discount values', () => {
    expect(validatePromotionCreate({ ...validPromotion, discountValue: 0 })).toHaveProperty(
      'discountValue',
      'Discount value must be greater than 0'
    );
    expect(validatePromotionCreate({ ...validPromotion, discountValue: 101 })).toHaveProperty(
      'discountValue',
      'Percentage discount cannot exceed 100'
    );
  });

  it('rejects start date after end date', () => {
    expect(validatePromotionCreate({
      ...validPromotion,
      startDate: '2026-09-01',
      endDate: '2026-08-31',
    })).toHaveProperty('endDate', 'Start date must be before end date');
  });

  it('rejects invalid usage limits on update', () => {
    expect(validatePromotionUpdate({ usageLimit: 0 })).toHaveProperty(
      'usageLimit',
      'Usage limit must be a positive integer'
    );
    expect(validatePromotionUpdate({ usagePerUser: 0 })).toHaveProperty(
      'usagePerUser',
      'Usage per user must be a positive integer'
    );
  });

  it('accepts a valid scheduled promotion notification time', () => {
    expect(validatePromotionCreate({
      ...validPromotion,
      notifyPassengers: true,
      notificationScheduledAt: '2026-08-15T08:00:00.000Z',
    })).toEqual({});
  });

  it('rejects scheduled notification time in the past', () => {
    expect(validatePromotionCreate({
      ...validPromotion,
      notifyPassengers: true,
      notificationScheduledAt: '2020-08-15T08:00:00.000Z',
    })).toHaveProperty('notificationScheduledAt', 'Notification time cannot be in the past');
  });

  it('rejects scheduled notification time before promotion start date', () => {
    expect(validatePromotionCreate({
      ...validPromotion,
      notifyPassengers: true,
      notificationScheduledAt: '2026-07-31T23:00:00.000Z',
    })).toHaveProperty(
      'notificationScheduledAt',
      'Notification time must be within promotion validity period'
    );
  });

  it('rejects scheduled notification time after promotion end date', () => {
    expect(validatePromotionCreate({
      ...validPromotion,
      notifyPassengers: true,
      notificationScheduledAt: '2026-09-01T00:00:00.000Z',
    })).toHaveProperty(
      'notificationScheduledAt',
      'Notification time must be within promotion validity period'
    );
  });
});
