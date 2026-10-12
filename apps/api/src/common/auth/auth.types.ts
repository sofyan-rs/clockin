import type { AdminRole, AdminScopeKind, SessionAudience } from '@prisma/client';

import type { Permission } from './permissions';

/** Claims in the access JWT (ARCHITECTURE §12). `sid` is the session family id. */
export interface AccessTokenClaims {
  sub: string;
  cid: string;
  sid: string;
  aud: 'mobile' | 'admin';
  eid?: string;
  aid?: string;
}

/** Any signed-in caller, set on the request by the auth guards. */
export interface AuthSession {
  userId: string;
  companyId: string;
  sessionFamilyId: string;
  audience: SessionAudience;
}

export interface AuthEmployee extends AuthSession {
  employeeId: string;
  deviceId: string;
}

export type AdminScope =
  { kind: 'TEAM' } | { kind: 'DEPARTMENTS'; departmentIds: string[] } | { kind: 'ALL' };

export interface AuthAdmin extends AuthSession {
  adminUserId: string;
  employeeId: string | null;
  role: AdminRole;
  scope: AdminScope;
}

export function toAdminScope(kind: AdminScopeKind, departmentIds: string[]): AdminScope {
  return kind === 'DEPARTMENTS' ? { kind, departmentIds } : { kind };
}

declare module 'express' {
  interface Request {
    auth?: AuthSession;
    employee?: AuthEmployee;
    admin?: AuthAdmin;
  }
}

export type { Permission };
