import { AsyncLocalStorage } from 'node:async_hooks';

interface TenantStore {
  companyId?: string;
}

const storage = new AsyncLocalStorage<TenantStore>();

/**
 * Current company for this request (ARCHITECTURE §4.2). `TenantMiddleware` opens an empty store per
 * request; auth guards or public services fill it once they know the company.
 */
export const TenantContext = {
  run<T>(fn: () => T, companyId?: string): T {
    return storage.run({ companyId }, fn);
  },

  companyId(): string | undefined {
    return storage.getStore()?.companyId;
  },

  /** For tenant creates: Prisma's types want companyId, the extension guarantees it matches. */
  require(): string {
    const companyId = storage.getStore()?.companyId;
    if (!companyId) {
      throw new Error('Tenant context missing');
    }
    return companyId;
  },

  set(companyId: string): void {
    const store = storage.getStore();
    if (!store) {
      throw new Error('TenantContext.set() called outside a tenant scope');
    }
    store.companyId = companyId;
  },
};
