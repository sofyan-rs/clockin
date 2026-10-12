import { PrismaClient } from '@prisma/client';

import { TenantContext } from '../tenancy/tenant-context';

import { createTenantClient } from './prisma.service';
import { TENANT_MODELS } from './tenancy.extension';

describe('tenancy extension', () => {
  // Never connects: the extension rejects before any query reaches the database.
  const base = new PrismaClient({ datasourceUrl: 'postgresql://nobody@127.0.0.1:1/none' });
  const tenant = createTenantClient(base);

  afterAll(() => base.$disconnect());

  it('treats every model with companyId as a tenant model', () => {
    expect(TENANT_MODELS.has('User')).toBe(true);
    expect(TENANT_MODELS.has('Session')).toBe(true);
    expect(TENANT_MODELS.has('Company')).toBe(false);
  });

  it('throws when a tenant model is queried without a tenant context', async () => {
    await expect(tenant.user.findMany()).rejects.toThrow(
      'Tenant context missing for User.findMany',
    );
  });

  it('throws inside a request scope that never set the company', async () => {
    await TenantContext.run(async () => {
      await expect(tenant.employee.count()).rejects.toThrow('Tenant context missing');
    });
  });

  it('refuses to create a row for another company than the context', async () => {
    await TenantContext.run(async () => {
      await expect(
        tenant.auditLog.create({
          data: { companyId: 'company-b', actorLabel: 'x', action: 'a', entityType: 'e' },
        }),
      ).rejects.toThrow('another company');
    }, 'company-a');
  });
});
