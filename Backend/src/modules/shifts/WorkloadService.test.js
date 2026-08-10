import { describe, expect, it } from 'vitest';
import { calculateWorkload, consecutiveDays } from './WorkloadService.js';

const assignment = (date, type) => ({
  workDate: new Date(`${date}T00:00:00.000Z`),
  driverId: { _id: 'D1', fullName: 'Tài xế A' },
  shiftId: type === 'MORNING'
    ? { shiftType: type, startTime: '05:30', endTime: '12:00', breakMinutes: 0 }
    : { shiftType: type, startTime: '12:00', endTime: '18:30', breakMinutes: 0 },
});

describe('weekly roster workload', () => {
  it('calculates hours, rotating shifts and remaining capacity', () => {
    const [workload] = calculateWorkload([
      assignment('2026-08-10', 'MORNING'),
      assignment('2026-08-11', 'AFTERNOON'),
      assignment('2026-08-12', 'MORNING'),
    ], 'driverId');
    expect(workload).toMatchObject({ totalShifts: 3, totalHours: 19.5, morningShifts: 2, afternoonShifts: 1, consecutiveWorkingDays: 3, remainingCapacity: 3 });
  });

  it('detects the longest consecutive run and preserves OFF days', () => {
    expect(consecutiveDays(['2026-08-10', '2026-08-11', '2026-08-13'])).toBe(2);
  });
});
