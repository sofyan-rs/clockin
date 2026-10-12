import { Prisma } from '@prisma/client';

// Every model with a companyId column is tenant-scoped (ARCHITECTURE §5: all tables but companies).
export const TENANT_MODELS: ReadonlySet<string> = new Set(
  Prisma.dmmf.datamodel.models
    .filter((model) => model.fields.some((field) => field.name === 'companyId'))
    .map((model) => model.name),
);

const CREATE_OPERATIONS = new Set(['create', 'createMany', 'createManyAndReturn']);

type Args = Record<string, unknown>;

function withCompany(data: unknown, companyId: string): unknown {
  const rows = Array.isArray(data) ? (data as Args[]) : [data as Args];
  if (rows.some((row) => row.companyId !== undefined && row.companyId !== companyId)) {
    throw new Error('Refusing to create a row for another company than the tenant context');
  }
  const scoped = rows.map((row) => ({ ...row, companyId }));
  return Array.isArray(data) ? scoped : scoped[0];
}

/**
 * Injects `companyId` into top-level where/data of tenant models and refuses to run without a
 * tenant. Limits (keep them in mind):
 * - create data must use scalar foreign keys (`userId`), not `connect`; pass
 *   `companyId: TenantContext.require()` (Prisma's types need it, the extension checks it matches);
 * - nested writes are not rewritten: pass companyId yourself in nested `create` blocks;
 * - raw SQL bypasses this, so filter by company_id explicitly.
 */
export function tenancyExtension(getCompanyId: () => string | undefined) {
  return Prisma.defineExtension({
    name: 'tenancy',
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          if (!TENANT_MODELS.has(model)) {
            return query(args);
          }
          const companyId = getCompanyId();
          if (!companyId) {
            throw new Error(`Tenant context missing for ${model}.${operation}`);
          }
          const scoped = { ...(args as Args) };
          if (CREATE_OPERATIONS.has(operation)) {
            scoped.data = withCompany(scoped.data, companyId);
          } else if (operation === 'upsert') {
            scoped.where = { ...(scoped.where as Args), companyId };
            scoped.create = withCompany(scoped.create, companyId);
          } else {
            scoped.where = { ...(scoped.where as Args), companyId };
          }
          return query(scoped as typeof args);
        },
      },
    },
  });
}
