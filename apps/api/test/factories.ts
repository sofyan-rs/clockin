import { randomUUID } from 'node:crypto';

import type { AdminRole, AdminScopeKind, EmployeeStatus, UserStatus } from '@prisma/client';

import type { PrismaService } from '../src/common/prisma/prisma.service';
import { PasswordHasher } from '../src/modules/auth/password-hasher.service';

export const PASSWORD = 'Clockin2026';
const hasher = new PasswordHasher();
let sequence = 0;
const next = () => ++sequence;

// Factories write with the system client and explicit companyId: tests are not inside a request.

export async function createCompany(
  prisma: PrismaService,
  overrides: { slug?: string; name?: string } = {},
) {
  const n = next();
  return prisma.system.company.create({
    data: {
      slug: overrides.slug ?? `company-${n}`,
      name: overrides.name ?? `Company ${n}`,
      appName: 'ClockIn',
    },
  });
}

export async function createConsent(prisma: PrismaService, companyId: string, version = 1) {
  return prisma.system.consentVersion.create({
    data: { companyId, version, body: `Consent v${version}` },
  });
}

interface EmployeeOptions {
  email?: string;
  code?: string;
  password?: string | null;
  userStatus?: UserStatus;
  status?: EmployeeStatus;
}

export async function createEmployee(
  prisma: PrismaService,
  companyId: string,
  options: EmployeeOptions = {},
) {
  const n = next();
  const password = options.password === undefined ? PASSWORD : options.password;
  const user = await prisma.system.user.create({
    data: {
      companyId,
      email: options.email ?? `employee${n}@clockin.test`,
      passwordHash: password ? await hasher.hash(password) : null,
      status: options.userStatus ?? (password ? 'ACTIVE' : 'INVITED'),
    },
  });
  const employee = await prisma.system.employee.create({
    data: {
      companyId,
      userId: user.id,
      employeeCode: options.code ?? `EMP-${n}`,
      fullName: `Employee ${n}`,
      joinDate: new Date('2026-01-05'),
      status: options.status ?? 'ACTIVE',
    },
  });
  return { user, employee };
}

interface AdminOptions {
  role?: AdminRole;
  scopeKind?: AdminScopeKind;
  email?: string;
  /** Link to an existing employee's user instead of creating a non-employee admin. */
  employee?: { userId: string; employeeId: string };
}

export async function createAdmin(
  prisma: PrismaService,
  companyId: string,
  options: AdminOptions = {},
) {
  const n = next();
  const userId =
    options.employee?.userId ??
    (
      await prisma.system.user.create({
        data: {
          companyId,
          email: options.email ?? `admin${n}@clockin.test`,
          passwordHash: await hasher.hash(PASSWORD),
          status: 'ACTIVE',
        },
      })
    ).id;
  const adminUser = await prisma.system.adminUser.create({
    data: {
      companyId,
      userId,
      employeeId: options.employee?.employeeId,
      displayName: `Admin ${n}`,
      role: options.role ?? 'HR_ADMIN',
      scopeKind: options.scopeKind ?? 'ALL',
    },
    include: { user: true },
  });
  return adminUser;
}

export function newDevice(overrides: Partial<{ id: string; platform: 'ANDROID' | 'IOS' }> = {}) {
  return {
    id: overrides.id ?? randomUUID(),
    platform: overrides.platform ?? 'ANDROID',
    model: 'Pixel 8',
    appVersion: '1.0.0',
  };
}
