import { describe, expect, it } from 'vitest';

import { buildExperiencePriority } from './AutoGenerateShiftService.js';

describe('staff experience priority', () => {
  it('counts only experience belonging to target routes', () => {
    const assignments = [
      { shiftId: { _id: 'shift-a', routeId: 'route-a', workDate: new Date() } },
      { shiftId: { _id: 'shift-b', routeId: 'route-a', workDate: new Date() } },
      { shiftId: { _id: 'shift-c', routeId: 'route-b', workDate: new Date() } },
    ];
    const result = buildExperiencePriority({
      staff: { _id: 'staff-1' },
      assignments,
      tripCountByShift: new Map([['shift-a', 2], ['shift-b', 3], ['shift-c', 8]]),
      targetRouteIds: ['route-a'],
    });

    expect(result.routeExperienceCount).toBe(2);
    expect(result.tripExperienceCount).toBe(5);
    expect(result.completedShiftCount).toBe(3);
    expect(result.reasons).toContain('Đã hoàn thành 2 ca trên tuyến đang cần');
  });

  it('keeps eligible staff without history at normal priority', () => {
    const result = buildExperiencePriority({
      staff: { _id: 'staff-new' },
      assignments: [],
      tripCountByShift: new Map(),
      targetRouteIds: ['route-a'],
    });

    expect(result.suitabilityScore).toBe(30);
    expect(result.priorityLevel).toBe('NORMAL');
    expect(result.reasons[0]).toContain('chưa có lịch sử');
  });
});
