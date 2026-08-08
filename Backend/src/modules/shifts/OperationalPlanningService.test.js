import { describe, expect, it } from 'vitest';
import { configsFromTrips } from './OperationalPlanningService.js';

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
