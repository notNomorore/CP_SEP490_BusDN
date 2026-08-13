import { describe, expect, it } from 'vitest';
import { configsFromTrips, globalDemandFromTrips } from './OperationalPlanningService.js';

const cycle = (code, outboundStart, outboundEnd, inboundStart, inboundEnd) => [
  { _id: `${code}-D`, routeId: 'R1', operationCycleCode: code, direction: 'OUTBOUND', departureTime: outboundStart, expectedArrivalTime: outboundEnd },
  { _id: `${code}-V`, routeId: 'R1', operationCycleCode: code, direction: 'INBOUND', departureTime: inboundStart, expectedArrivalTime: inboundEnd },
];

describe('resource demand derived from planned trips', () => {
  it('uses peak concurrent D-V cycles instead of the total number of trips', () => {
    const trips = [
      ...cycle('C1', '05:30', '06:30', '06:40', '07:40'),
      ...cycle('C2', '06:00', '07:00', '07:10', '08:10'),
      ...cycle('C3', '08:20', '09:20', '09:30', '10:30'),
    ];
    const [morning] = configsFromTrips(trips);
    expect(morning.actualTripCount).toBe(6);
    expect(morning.requiredDrivers).toBe(2);
    expect(morning.requiredAssistants).toBe(2);
    expect(morning.requiredVehicles).toBe(0);
  });

  it('separates morning and afternoon demand', () => {
    const trips = [
      ...cycle('C1', '05:30', '06:30', '06:40', '07:40'),
      ...cycle('C2', '13:30', '14:30', '14:40', '15:40'),
    ];
    const configs = configsFromTrips(trips);
    expect(configs).toHaveLength(2);
    expect(configs.map((item) => item.actualTripCount)).toEqual([2, 2]);
  });
});

describe('global staffing demand across routes', () => {
  it('uses concurrent cycles across different routes', () => {
    const trips = [
      ...cycle('C1', '05:30', '06:30', '06:40', '07:40'),
      ...cycle('C2', '05:45', '06:45', '06:55', '07:55').map((trip) => ({ ...trip, routeId: 'R2' })),
      ...cycle('C3', '08:10', '09:10', '09:20', '10:20'),
    ];
    const morning = globalDemandFromTrips(trips).find((item) => item.shiftType === 'MORNING');
    expect(morning.tripCount).toBe(6);
    expect(morning.required).toBe(2);
  });

  it('returns zero when a shift has no trips', () => {
    const afternoon = globalDemandFromTrips(cycle('C1', '05:30', '06:30', '06:40', '07:40'))
      .find((item) => item.shiftType === 'AFTERNOON');
    expect(afternoon.tripCount).toBe(0);
    expect(afternoon.required).toBe(0);
  });

  it('does not merge equal cycle codes from different routes', () => {
    const firstRoute = cycle('MORNING-1', '05:30', '06:30', '06:40', '07:40');
    const secondRoute = cycle('MORNING-1', '05:45', '06:45', '06:55', '07:55')
      .map((trip) => ({ ...trip, routeId: 'R2' }));
    const morning = globalDemandFromTrips([...firstRoute, ...secondRoute])
      .find((item) => item.shiftType === 'MORNING');
    expect(morning.tripCount).toBe(4);
    expect(morning.required).toBe(2);
  });

  it('uses the common 12:00 boundary for morning and afternoon', () => {
    const trips = [
      ...cycle('C1', '11:10', '11:30', '11:40', '11:55'),
      ...cycle('C2', '12:00', '12:30', '12:40', '13:10'),
    ];
    const demand = globalDemandFromTrips(trips);
    expect(demand.find((item) => item.shiftType === 'MORNING').tripCount).toBe(2);
    expect(demand.find((item) => item.shiftType === 'AFTERNOON').tripCount).toBe(2);
  });

  it('keeps a cycle occupied through its turnaround buffer', () => {
    const trips = [
      ...cycle('C1', '05:30', '06:30', '06:40', '07:40').map((trip) => (
        trip.direction === 'INBOUND' ? { ...trip, turnaroundEndTime: '08:00' } : trip
      )),
      ...cycle('C2', '07:50', '08:20', '08:30', '09:00'),
    ];
    const morning = globalDemandFromTrips(trips).find((item) => item.shiftType === 'MORNING');
    expect(morning.required).toBe(2);
  });

  it('returns operational windows so short peak shifts can cover real shortages', () => {
    const trips = [
      ...cycle('C1', '05:30', '06:30', '06:40', '07:40'),
      ...cycle('C2', '06:00', '07:00', '07:10', '08:10'),
    ];
    const morning = globalDemandFromTrips(trips).find((item) => item.shiftType === 'MORNING');
    expect(morning.windows).toEqual(expect.arrayContaining([
      expect.objectContaining({ startTime: '06:00', endTime: '07:40', required: 2, demandLevel: 'PEAK' }),
    ]));
  });
});
