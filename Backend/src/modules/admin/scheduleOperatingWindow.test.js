import { describe, expect, it } from 'vitest';
import { isTripOutsideOperatingWindow } from './scheduleOperatingWindow.js';

describe('schedule operating-window rules', () => {
  const routeWindow = { routeFirst: 330, routeLast: 720 };

  it('accepts a paired inbound leg after the route-origin departure cut-off', () => {
    expect(isTripOutsideOperatingWindow({
      ...routeWindow,
      direction: 'INBOUND',
      departure: 730,
      arrival: 790,
    })).toBe(false);
  });

  it('rejects an outbound leg after the route-origin departure cut-off', () => {
    expect(isTripOutsideOperatingWindow({
      ...routeWindow,
      direction: 'OUTBOUND',
      departure: 730,
      arrival: 790,
    })).toBe(true);
  });

  it('rejects either direction when the trip finishes after 18:30', () => {
    expect(isTripOutsideOperatingWindow({
      ...routeWindow,
      direction: 'INBOUND',
      departure: 1080,
      arrival: 1120,
    })).toBe(true);
  });

  it('uses the full-day window for demand plans instead of the route frequency window', () => {
    expect(isTripOutsideOperatingWindow({
      ...routeWindow,
      direction: 'OUTBOUND',
      departure: 840,
      arrival: 900,
      enforceRouteDepartureWindow: false,
    })).toBe(false);
  });
});
