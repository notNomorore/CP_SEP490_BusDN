import { describe, expect, it } from 'vitest';
import { splitRowsIntoCycleDuties, validateAtomicCycleDuties } from './shiftDutyPlanning.js';

const trips = [
  { _id: 'D1', operationCycleCode: 'CYCLE-1', direction: 'OUTBOUND', departureTime: '05:30', expectedArrivalTime: '06:30' },
  { _id: 'V1', operationCycleCode: 'CYCLE-1', direction: 'INBOUND', departureTime: '06:40', expectedArrivalTime: '07:40' },
  { _id: 'D2', operationCycleCode: 'CYCLE-2', direction: 'OUTBOUND', departureTime: '06:00', expectedArrivalTime: '07:00' },
  { _id: 'V2', operationCycleCode: 'CYCLE-2', direction: 'INBOUND', departureTime: '07:10', expectedArrivalTime: '08:10' },
];

describe('D-V duty planning', () => {
  it('splits concurrent cycles into independent vehicle duties', () => {
    const rows = splitRowsIntoCycleDuties([{ workDate: '2026-08-08', routeId: 'R1', route: { routeCode: 'R1' }, trips }]);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.tripIds)).toEqual([['D1', 'V1'], ['D2', 'V2']]);
  });

  it('rejects a D-V cycle split across rows', () => {
    expect(validateAtomicCycleDuties([{ tripIds: ['D1'] }, { tripIds: ['V1'] }], trips).length).toBeGreaterThan(0);
  });

  it('rejects the same trip assigned to two duties', () => {
    expect(validateAtomicCycleDuties([{ tripIds: ['D1', 'V1'] }, { tripIds: ['D1', 'V1'] }], trips).length).toBeGreaterThan(0);
  });

  it('requires at least ten minutes to turn the vehicle around', () => {
    const invalidTrips = [trips[0], { ...trips[1], departureTime: '06:35' }];
    expect(validateAtomicCycleDuties([{ tripIds: ['D1', 'V1'] }], invalidTrips).length).toBeGreaterThan(0);
  });

  it('rejects a duty exceeding four hours of continuous driving', () => {
    const invalidTrips = [
      { ...trips[0], departureTime: '05:30', expectedArrivalTime: '08:00' },
      { ...trips[1], departureTime: '08:10', expectedArrivalTime: '10:40' },
    ];
    expect(validateAtomicCycleDuties([{ tripIds: ['D1', 'V1'] }], invalidTrips).length).toBeGreaterThan(0);
  });
});
