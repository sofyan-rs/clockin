import { ScopeService } from './scope.service';

describe('ScopeService.employeeWhere', () => {
  const scope = new ScopeService();

  it('does not filter for scope all', () => {
    expect(
      scope.employeeWhere({ role: 'HR_ADMIN', employeeId: null, scope: { kind: 'ALL' } }),
    ).toEqual({});
  });

  it('filters by department ids', () => {
    const where = scope.employeeWhere({
      role: 'HR',
      employeeId: null,
      scope: { kind: 'DEPARTMENTS', departmentIds: ['d1', 'd2'] },
    });
    expect(where).toEqual({ departmentId: { in: ['d1', 'd2'] } });
  });

  it('uses team lead for Team Lead and manager for Manager', () => {
    expect(
      scope.employeeWhere({ role: 'TEAM_LEAD', employeeId: 'e1', scope: { kind: 'TEAM' } }),
    ).toEqual({
      teamLeadId: 'e1',
    });
    expect(
      scope.employeeWhere({ role: 'MANAGER', employeeId: 'e1', scope: { kind: 'TEAM' } }),
    ).toEqual({
      managerId: 'e1',
    });
  });

  it('matches nobody for team scope without a linked employee', () => {
    expect(scope.employeeWhere({ role: 'HR', employeeId: null, scope: { kind: 'TEAM' } })).toEqual({
      id: { in: [] },
    });
  });
});
