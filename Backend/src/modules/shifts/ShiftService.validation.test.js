import { describe, expect, it } from 'vitest';
import ShiftService from './ShiftService.js';

const payload = (overrides = {}) => ShiftService.normalizeShiftPayload({
  workDate: '2026-08-10',
  startTime: '05:30',
  endTime: '12:00',
  shiftType: 'MORNING',
  ...overrides,
});

describe('manual staff shift validation', () => {
  it('allows a staff shift before a route is allocated', () => {
    expect(ShiftService.validateShiftPayload(payload())).toEqual([]);
  });

  it('allows a short morning peak reinforcement shift', () => {
    expect(ShiftService.validateShiftPayload(payload({ startTime: '06:00', endTime: '08:30' }))).toEqual([]);
  });

  it('keeps manual shifts inside their operational shift window', () => {
    expect(ShiftService.validateShiftPayload(payload({ endTime: '14:00' })))
      .toContain('Ca sáng phải kết thúc chậm nhất lúc 12:00.');
    expect(ShiftService.validateShiftPayload(payload({ shiftType: 'AFTERNOON', startTime: '09:30', endTime: '17:30' })))
      .toContain('Ca chiều chỉ được bắt đầu từ 12:00.');
  });
});
