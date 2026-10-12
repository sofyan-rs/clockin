import { Injectable } from '@nestjs/common';
import type { AdminRole } from '@prisma/client';

import type { AuthEmployee } from '../../common/auth/auth.types';
import { AppError } from '../../common/errors/app-error';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ConsentService } from '../companies/consent.service';

import type { MeResponse, MobileRole } from './dto/me.response';

const HR_ROLES: AdminRole[] = ['SUPER_ADMIN', 'HR_ADMIN', 'HR'];

@Injectable()
export class MeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly consent: ConsentService,
  ) {}

  async profile(me: AuthEmployee): Promise<MeResponse> {
    const employee = await this.prisma.tenant.employee.findUniqueOrThrow({
      where: { id: me.employeeId },
      include: {
        user: { select: { email: true } },
        adminUser: { select: { role: true, status: true } },
        devices: { where: { id: me.deviceId } },
        _count: { select: { teamMembers: true, managedEmployees: true } },
      },
    });
    const device = employee.devices[0];

    // PRD §4.1: computed, not stored. B2 switches lead/manager to department assignments.
    const roles: MobileRole[] = ['STAFF'];
    if (employee._count.teamMembers > 0) roles.push('TEAM_LEAD');
    if (employee._count.managedEmployees > 0) roles.push('MANAGER');
    if (employee.adminUser?.status === 'ACTIVE' && HR_ROLES.includes(employee.adminUser.role))
      roles.push('HR');

    return {
      id: employee.id,
      employeeCode: employee.employeeCode,
      fullName: employee.fullName,
      email: employee.user.email,
      phone: employee.phone,
      joinDate: employee.joinDate.toISOString().slice(0, 10),
      workModes: { wfo: employee.allowWfo, wfh: employee.allowWfh },
      device: device
        ? { platform: device.platform, model: device.model, boundAt: device.boundAt.toISOString() }
        : null,
      roles,
      consent: await this.consent.statusFor(employee.id),
    };
  }

  /** FR-M4: accepting an outdated version (HR published a newer one meanwhile) is refused. */
  async acceptConsent(me: AuthEmployee, version: number): Promise<void> {
    const current = await this.consent.current();
    if (!current || current.version !== version) {
      throw new AppError('CONSENT_VERSION_STALE', { currentVersion: current?.version ?? null });
    }
    await this.prisma.tenant.consentAcceptance.upsert({
      where: {
        employeeId_consentVersionId: { employeeId: me.employeeId, consentVersionId: current.id },
      },
      create: {
        companyId: me.companyId,
        employeeId: me.employeeId,
        consentVersionId: current.id,
        deviceId: me.deviceId,
      },
      update: {},
    });
  }
}
