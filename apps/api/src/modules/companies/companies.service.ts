import { Injectable } from '@nestjs/common';
import type { Company } from '@prisma/client';

import { AppError } from '../../common/errors/app-error';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantContext } from '../../common/tenancy/tenant-context';

import { type CompanySettings, parseCompanySettings } from './company-settings';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrent(): Promise<Company> {
    const companyId = TenantContext.companyId();
    if (!companyId) {
      throw new Error('CompaniesService.getCurrent() needs a tenant context');
    }
    return this.prisma.system.company.findUniqueOrThrow({ where: { id: companyId } });
  }

  async settingsFor(companyId: string): Promise<CompanySettings> {
    const company = await this.prisma.system.company.findUniqueOrThrow({
      where: { id: companyId },
      select: { settings: true },
    });
    return parseCompanySettings(company.settings);
  }

  /**
   * Public endpoints have no token, so the company comes from the `x-company` slug header.
   * While there is a single company (pilot) the header is optional.
   */
  async resolvePublic(slug: string | undefined): Promise<Company> {
    // system client: no tenant is known yet, that's what we're resolving.
    if (slug) {
      const company = await this.prisma.system.company.findUnique({ where: { slug } });
      if (!company) throw new AppError('COMPANY_NOT_RESOLVED');
      return company;
    }
    const companies = await this.prisma.system.company.findMany({ take: 2 });
    if (companies.length !== 1 || !companies[0]) throw new AppError('COMPANY_NOT_RESOLVED');
    return companies[0];
  }
}
