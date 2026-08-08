import { describe, expect, it } from 'vitest';
import LostAndFoundMatchingService from './LostAndFoundMatchingService.js';
import { MatchReviewDTO } from './customerSupport.dto.js';

const buildLostReport = (overrides = {}) => ({
  routeName: 'R16 - Da Nang Central',
  tripCode: 'TRIP-R16-0800',
  busPlate: 'B12-345',
  incidentAt: '2026-08-08T08:15:00.000Z',
  lostItem: {
    itemCategory: 'WALLET_DOCUMENTS',
    itemName: 'black wallet',
    itemDescription: 'Black leather wallet with citizen card and student card',
    color: 'black',
    brand: 'local',
    identifyingDetails: 'student card inside',
    lostAt: '2026-08-08T08:15:00.000Z',
  },
  ...overrides,
});

const buildFoundReport = (overrides = {}) => ({
  reportedAt: '2026-08-08T09:10:00.000Z',
  route: {
    routeNumber: 'R16',
    routeName: 'R16 - Da Nang Central',
  },
  trip: {
    scheduleCode: 'TRIP-R16-0800',
  },
  vehicle: {
    plateNumber: 'B12-345',
  },
  foundItem: {
    itemCategory: 'WALLET_DOCUMENTS',
    itemName: 'black wallet',
    itemDescription: 'Black leather wallet with student card',
    color: 'black',
    brand: 'local',
    identifyingDetails: 'student card',
  },
  ...overrides,
});

describe('LostAndFoundMatchingService scoring', () => {
  it('scores a strong operational and item match above the review threshold', () => {
    const result = LostAndFoundMatchingService.calculateMatchScore(buildLostReport(), buildFoundReport());

    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.factors).toMatchObject({
      vehicle: true,
      route: true,
      trip: true,
      timeProximity: true,
      category: true,
      name: true,
      color: true,
      brand: true,
      description: true,
    });
  });

  it('keeps unrelated reports below the weak-match range', () => {
    const result = LostAndFoundMatchingService.calculateMatchScore(
      buildLostReport(),
      buildFoundReport({
        reportedAt: '2026-08-12T20:00:00.000Z',
        route: { routeNumber: 'R02', routeName: 'Airport route' },
        trip: { scheduleCode: 'TRIP-R02-2000' },
        vehicle: { plateNumber: 'C99-000' },
        foundItem: {
          itemCategory: 'ELECTRONICS',
          itemName: 'tablet',
          itemDescription: 'White tablet in blue case',
          color: 'white',
          brand: 'Apple',
          identifyingDetails: 'blue case',
        },
      })
    );

    expect(result.score).toBeLessThan(40);
  });
});

describe('lost-found admin workflow validation', () => {
  it('requires a rejection reason', () => {
    expect(MatchReviewDTO.validateReject({ rejectionReason: ' ' })).toHaveProperty('rejectionReason');
  });

  it('requires return location before starting a return', () => {
    expect(MatchReviewDTO.validateStartReturn({ method: 'PICKUP_AT_BUS_STATION', location: '' }))
      .toHaveProperty('location');
  });

  it('requires receiver name before completing handover', () => {
    expect(MatchReviewDTO.validateCompleteReturn({ receiverName: '' })).toHaveProperty('receiverName');
  });
});
