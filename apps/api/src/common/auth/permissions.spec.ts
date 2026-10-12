import { hasPermission } from './permissions';

describe('hasPermission (PRD §4.2)', () => {
  it('lets only Super Admin delete employees', () => {
    expect(hasPermission('SUPER_ADMIN', 'employees.delete')).toBe(true);
    expect(hasPermission('HR_ADMIN', 'employees.delete')).toBe(false);
  });

  it('lets HR review and override but not edit employees', () => {
    expect(hasPermission('HR', 'review.decide')).toBe(true);
    expect(hasPermission('HR', 'attendance.override')).toBe(true);
    expect(hasPermission('HR', 'employees.write')).toBe(false);
  });

  it('gives Manager and Team Lead read-only access', () => {
    for (const role of ['MANAGER', 'TEAM_LEAD'] as const) {
      expect(hasPermission(role, 'dashboard.read')).toBe(true);
      expect(hasPermission(role, 'employees.read')).toBe(true);
      expect(hasPermission(role, 'review.decide')).toBe(false);
      expect(hasPermission(role, 'audit.read')).toBe(false);
    }
  });
});
