import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

import { TenantContext } from '../tenancy/tenant-context';

import { tenancyExtension } from './tenancy.extension';

export function createTenantClient(base: PrismaClient) {
  return base.$extends(tenancyExtension(() => TenantContext.companyId()));
}

export type TenantClient = ReturnType<typeof createTenantClient>;

/** Client handed to `tenant.$transaction(async (tx) => …)` callbacks. */
export type TenantTx = Omit<
  TenantClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'
>;

/**
 * Two clients on purpose:
 * - `tenant`: the default. Scoped to TenantContext; throws without one.
 * - `system`: no scoping. Only for lookups before the company is known (sign-in, refresh, public
 *   config) and cross-company jobs. Every use should say why in a comment.
 */
@Injectable()
export class PrismaService implements OnModuleDestroy {
  readonly system = new PrismaClient();
  readonly tenant: TenantClient = createTenantClient(this.system);

  async onModuleDestroy(): Promise<void> {
    await this.system.$disconnect();
  }
}
