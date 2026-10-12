/**
 * Demo data for local dev and staging: company "Sasana", consent v1, admins and a few employees.
 * Idempotent: re-running updates the same rows. All accounts share SEED_PASSWORD.
 * B2 extends this to a realistic org (departments, offices, schedules, 30 employees).
 */
import { type AdminRole, PrismaClient } from '@prisma/client';

import { PasswordHasher } from '../src/modules/auth/password-hasher.service';

const prisma = new PrismaClient();
const SEED_PASSWORD = process.env.SEED_PASSWORD ?? 'Clockin2026';

const CONSENT_V1 = `ClockIn records a selfie and your location only when you clock in or out, to confirm attendance.
Selfies are kept for the retention period set by HR and then deleted automatically. Location is never tracked in the background.
Only HR and your approvers can see this data. You can ask HR for a copy or for correction at any time.`;

interface SeedEmployee {
  code: string;
  fullName: string;
  email: string;
  allowWfh?: boolean;
  teamLeadCode?: string;
  invitedOnly?: boolean;
  admin?: { role: AdminRole };
}

const EMPLOYEES: SeedEmployee[] = [
  {
    code: 'SAS-001',
    fullName: 'Rina Wulandari',
    email: 'rina@sasana.test',
    allowWfh: true,
    admin: { role: 'HR_ADMIN' },
  },
  {
    code: 'SAS-002',
    fullName: 'Budi Santoso',
    email: 'budi@sasana.test',
    admin: { role: 'TEAM_LEAD' },
  },
  {
    code: 'SAS-003',
    fullName: 'Dewi Lestari',
    email: 'dewi@sasana.test',
    allowWfh: true,
    teamLeadCode: 'SAS-002',
  },
  { code: 'SAS-004', fullName: 'Andi Pratama', email: 'andi@sasana.test', teamLeadCode: 'SAS-002' },
  {
    code: 'SAS-005',
    fullName: 'Sari Putri',
    email: 'sari@sasana.test',
    teamLeadCode: 'SAS-002',
    invitedOnly: true,
  },
];

async function main(): Promise<void> {
  const passwordHash = await new PasswordHasher().hash(SEED_PASSWORD);

  const company = await prisma.company.upsert({
    where: { slug: 'sasana' },
    update: {},
    create: {
      slug: 'sasana',
      name: 'Sasana Digital',
      appName: 'ClockIn',
      contactWhatsapp: '+6281200000000',
      contactEmail: 'hr@sasana.test',
    },
  });
  const companyId = company.id;

  await prisma.consentVersion.upsert({
    where: { companyId_version: { companyId, version: 1 } },
    update: {},
    create: { companyId, version: 1, body: CONSENT_V1 },
  });

  // Non-employee Super Admin (PRD §4.3: web only, never clocks in).
  const owner = await prisma.user.upsert({
    where: { companyId_email: { companyId, email: 'owner@sasana.test' } },
    update: { passwordHash, status: 'ACTIVE' },
    create: { companyId, email: 'owner@sasana.test', passwordHash, status: 'ACTIVE' },
  });
  await prisma.adminUser.upsert({
    where: { userId: owner.id },
    update: {},
    create: {
      companyId,
      userId: owner.id,
      displayName: 'Owner',
      role: 'SUPER_ADMIN',
      scopeKind: 'ALL',
    },
  });

  const idsByCode = new Map<string, string>();
  for (const seed of EMPLOYEES) {
    const credentials = seed.invitedOnly
      ? { passwordHash: null, status: 'INVITED' as const }
      : { passwordHash, status: 'ACTIVE' as const };
    const user = await prisma.user.upsert({
      where: { companyId_email: { companyId, email: seed.email } },
      update: credentials,
      create: { companyId, email: seed.email, ...credentials },
    });
    const work = {
      fullName: seed.fullName,
      allowWfo: true,
      allowWfh: seed.allowWfh ?? false,
      teamLeadId: seed.teamLeadCode ? idsByCode.get(seed.teamLeadCode) : null,
    };
    const employee = await prisma.employee.upsert({
      where: { companyId_employeeCode: { companyId, employeeCode: seed.code } },
      update: work,
      create: {
        companyId,
        userId: user.id,
        employeeCode: seed.code,
        joinDate: new Date('2025-01-06'),
        ...work,
      },
    });
    idsByCode.set(seed.code, employee.id);

    if (seed.admin) {
      await prisma.adminUser.upsert({
        where: { userId: user.id },
        update: { role: seed.admin.role },
        create: {
          companyId,
          userId: user.id,
          employeeId: employee.id,
          displayName: seed.fullName,
          role: seed.admin.role,
          scopeKind: seed.admin.role === 'TEAM_LEAD' ? 'TEAM' : 'ALL',
        },
      });
    }
  }

  console.log(
    `Seeded company "${company.name}" (${company.slug}). Password for all active accounts: ${SEED_PASSWORD}`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
