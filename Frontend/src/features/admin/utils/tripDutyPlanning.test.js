import { describe, expect, it } from 'vitest';

import { splitTripsIntoNonOverlappingDuties } from './tripDutyPlanning.js';

describe('trip duty planning', () => {
  it('requires three teams for the overlapping DN05 timetable', () => {
    const trips = [
      ['06:30', '07:30'], ['06:40', '07:59'],
      ['07:31', '08:31'], ['07:40', '08:59'],
      ['08:31', '09:31'], ['08:41', '10:00'],
      ['09:31', '10:31'], ['09:41', '11:00'],
      ['10:41', '12:00'],
    ].map(([departureTime, expectedArrivalTime]) => ({ departureTime, expectedArrivalTime }));

    const duties = splitTripsIntoNonOverlappingDuties(trips);

    expect(duties).toHaveLength(3);
    duties.forEach((duty) => duty.slice(1).forEach((trip, index) => {
      expect(duty[index].expectedArrivalTime <= trip.departureTime).toBe(true);
    }));
  });

  it('keeps sequential trips in one team', () => {
    expect(splitTripsIntoNonOverlappingDuties([
      { departureTime: '05:30', expectedArrivalTime: '06:30' },
      { departureTime: '06:40', expectedArrivalTime: '07:40' },
    ])).toHaveLength(1);
  });
});
