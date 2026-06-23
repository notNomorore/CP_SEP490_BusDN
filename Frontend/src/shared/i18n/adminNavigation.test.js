import { describe, expect, it } from 'vitest';
import { adminNavGroups, adminNavigation } from './adminMessages.js';

const expectedGroups = [
  ['operations-monitoring', 5],
  ['analytics-statistics', 5],
  ['fares-promotions', 3],
  ['incidents-maintenance', 4],
  ['users-support', 3],
  ['system', 2],
];

const expectedPaths = [
  '/admin/dashboard',
  '/admin/fleet/active-trips',
  '/admin/fleet/delayed-trips',
  '/admin/routes',
  '/admin/analytics/congested-routes',
  '/admin/analytics/route-efficiency',
  '/admin/analytics/feedback',
  '/admin/promotions/statistics',
  '/admin/revenue',
  '/admin/staff-performance',
  '/admin/fare-operations',
  '/admin/walkin-tickets',
  '/admin/promotions',
  '/admin/incidents',
  '/admin/vehicle-issues',
  '/admin/maintenance-approval',
  '/admin/passenger-compliance',
  '/admin/users',
  '/admin/priority-verification',
  '/admin/customer-support',
  '/admin/system-notifications',
  '/admin/system-monitoring',
];

describe('admin grouped navigation', () => {
  it('contains the six requested groups with the expected number of children', () => {
    expect(adminNavGroups.map((group) => [group.id, group.children.length])).toEqual(expectedGroups);
  });

  it('preserves every existing sidebar route exactly once', () => {
    expect(adminNavigation.map((item) => item.path)).toEqual(expectedPaths);
    expect(new Set(adminNavigation.map((item) => item.path)).size).toBe(expectedPaths.length);
  });

  it('keeps legacy fleet location navigation associated with Fleet Operations', () => {
    expect(adminNavigation[0].aliases).toContain('/admin/fleet/locations');
  });
});
