import { describe, expect, it } from 'vitest';
import {
  checkFutureStaffCoverage,
  evaluateResource,
  rangesOverlap,
  scoreDriver,
  validateOperatingWindow,
} from './schedulingEngine.js';

describe('schedulingEngine', () => {
  it('detects partial overlap for drivers and vehicles', () => {
    expect(rangesOverlap({ startTime: '05:30', endTime: '11:30' }, { startTime: '10:00', endTime: '14:00' })).toBe(true);
    expect(rangesOverlap({ startTime: '06:00', endTime: '10:00' }, { startTime: '09:30', endTime: '12:00' })).toBe(true);
    expect(rangesOverlap({ startTime: '06:00', endTime: '10:00' }, { startTime: '10:00', endTime: '12:00' })).toBe(false);
  });

  it('enforces the 05:30-18:30 operating window', () => {
    expect(validateOperatingWindow({ startTime: '04:30', endTime: '10:00' })).not.toHaveLength(0);
    expect(validateOperatingWindow({ startTime: '17:00', endTime: '19:00' })).not.toHaveLength(0);
    expect(validateOperatingWindow({ startTime: '05:30', endTime: '18:30' })).toEqual([]);
  });

  it('rejects maximum hours, leave, maintenance and overlap', () => {
    const base = { resource: { status: 'ACTIVE' }, shift: { startTime: '10:00', endTime: '14:00' } };
    expect(evaluateResource({ ...base, assignedMinutes: 6 * 60 }).eligible).toBe(false);
    expect(evaluateResource({ ...base, onLeave: true }).eligible).toBe(false);
    expect(evaluateResource({ ...base, operational: false }).eligible).toBe(false);
    expect(evaluateResource({ ...base, assignments: [{ startTime: '05:30', endTime: '11:30' }] }).eligible).toBe(false);
  });

  it('blocks an assignment that causes future driver shortage', () => {
    const result = checkFutureStaffCoverage({
      candidateId: 'A',
      futureSlots: [{ startTime: '16:00', endTime: '18:30', requiredDrivers: 10 }],
      candidates: Array.from({ length: 9 }, (_, index) => ({ id: index ? `D${index}` : 'A', availableSlots: [{ startTime: '16:00', endTime: '18:30' }] })),
    });
    expect(result.allowed).toBe(false);
    expect(result.shortages[0].shortage).toBe(2);
  });

  it('scores the under-hours balanced driver above a near-limit driver', () => {
    const balanced = scoreDriver({ driverId: 'B', assignedMinutes: 120, morningShiftCount: 0, afternoonShiftCount: 1, shiftType: 'MORNING' });
    const nearLimit = scoreDriver({ driverId: 'A', assignedMinutes: 450, morningShiftCount: 4, afternoonShiftCount: 0, shiftType: 'MORNING' });
    expect(balanced.score).toBeGreaterThan(nearLimit.score);
  });

  it('never accepts an overlapping row during automatic allocation', () => {
    const accepted = [{ startTime: '05:30', endTime: '09:00' }];
    const candidate = evaluateResource({
      resource: { status: 'ACTIVE' },
      shift: { startTime: '08:30', endTime: '12:30' },
      assignments: accepted,
    });
    expect(candidate.eligible).toBe(false);
    expect(candidate.errors).toContain('Trùng lịch đã phân.');
  });
});
