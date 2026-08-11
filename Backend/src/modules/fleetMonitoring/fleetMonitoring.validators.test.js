import { describe, expect, it } from 'vitest';
import {
  validateActiveTripQuery,
  validateFleetLocationQuery,
} from './fleetMonitoring.validators.js';

describe('fleet monitoring status validation', () => {
  it.each(['available', 'active', 'incident', 'maintenance'])(
    'accepts %s for the fleet location filter',
    (status) => {
      expect(validateFleetLocationQuery({ status })).toEqual({});
    }
  );

  it('keeps maintenance invalid for the active-trip filter', () => {
    expect(validateActiveTripQuery({ status: 'maintenance' })).toEqual({
      status: 'Invalid trip status',
    });
  });
});
