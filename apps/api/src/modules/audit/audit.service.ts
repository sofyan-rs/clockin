import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { TenantTx } from '../../common/prisma/prisma.service';
import { TenantContext } from '../../common/tenancy/tenant-context';

export interface AuditEntry {
  /** Null for system actions (jobs, self-service before sign-in). */
  actorUserId: string | null;
  /** Readable name kept even if the actor is deleted later, e.g. "Rina (HR Admin)" or "system". */
  actorLabel: string;
  /** `<entity>.<verb>`, e.g. `employee.deactivated`, `auth.password_changed`. */
  action: string;
  entityType: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  note?: string;
  ip?: string;
}

/** Append-only audit log. Always call it with the transaction that makes the change. */
@Injectable()
export class AuditService {
  async record(tx: TenantTx, entry: AuditEntry): Promise<void> {
    await tx.auditLog.create({
      data: {
        companyId: TenantContext.require(),
        actorUserId: entry.actorUserId,
        actorLabel: entry.actorLabel,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        before: toJson(entry.before),
        after: toJson(entry.after),
        note: entry.note,
        ip: entry.ip,
      },
    });
  }
}

function toJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return value === undefined || value === null ? Prisma.DbNull : (value as Prisma.InputJsonValue);
}
