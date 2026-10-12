import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import type { AuthAdmin } from './auth.types';

/** ARCHITECTURE §4.3: every admin list, report and export filters employees through this. */
@Injectable()
export class ScopeService {
  employeeWhere(
    admin: Pick<AuthAdmin, 'role' | 'scope' | 'employeeId'>,
  ): Prisma.EmployeeWhereInput {
    switch (admin.scope.kind) {
      case 'ALL':
        return {};
      case 'DEPARTMENTS':
        return { departmentId: { in: admin.scope.departmentIds } };
      case 'TEAM':
        if (!admin.employeeId) {
          return { id: { in: [] } };
        }
        // A Manager's "team" is everyone they manage; anyone else's is the people they lead.
        return admin.role === 'MANAGER'
          ? { managerId: admin.employeeId }
          : { teamLeadId: admin.employeeId };
    }
  }
}
