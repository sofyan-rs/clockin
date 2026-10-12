import { Injectable } from '@nestjs/common';

import type { AuthAdmin } from '../../common/auth/auth.types';
import { ROLE_PERMISSIONS } from '../../common/auth/permissions';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CompaniesService } from '../companies/companies.service';
import { parseCompanySettings } from '../companies/company-settings';

import type { AdminMeResponse } from './dto/admin-me.response';

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companies: CompaniesService,
  ) {}

  async me(admin: AuthAdmin): Promise<AdminMeResponse> {
    const [adminUser, company] = await Promise.all([
      this.prisma.tenant.adminUser.findUniqueOrThrow({
        where: { id: admin.adminUserId },
        include: { user: { select: { email: true } } },
      }),
      this.companies.getCurrent(),
    ]);
    return {
      id: adminUser.id,
      displayName: adminUser.displayName,
      email: adminUser.user.email,
      employeeId: adminUser.employeeId,
      role: adminUser.role,
      scope: { kind: adminUser.scopeKind, departmentIds: adminUser.scopeDepartmentIds },
      permissions: [...ROLE_PERMISSIONS[adminUser.role]],
      features: parseCompanySettings(company.settings).features,
      companyName: company.name,
    };
  }
}
