import { describe, expect, it } from 'vitest';
import { vehicleTypeGroup } from './AutoGenerateShiftService.js';

describe('vehicle type normalization for shift assignment', () => {
  it.each([
    'Standard City Bus',
    'Xe buýt đô thị',
    'Xe buýt tiêu chuẩn đô thị',
    'Xe buýt thành phố tiêu chuẩn',
  ])('maps %s to the standard city-bus group', (value) => {
    expect(vehicleTypeGroup(value)).toBe('STANDARD_CITY_BUS');
  });

  it('keeps electric buses in a separate group', () => {
    expect(vehicleTypeGroup('Xe buýt điện đô thị')).toBe('ELECTRIC_BUS');
  });
});
