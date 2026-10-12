import { Inject, Injectable } from '@nestjs/common';
import type { Employee, User } from '@prisma/client';

import { hashDeviceId } from '../../common/auth/device-id';
import { AppError } from '../../common/errors/app-error';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RATE_LIMITS, RateLimitService } from '../../common/redis/rate-limit.service';
import { TenantContext } from '../../common/tenancy/tenant-context';
import { ENV, type Env } from '../../config/env';
import { AuditService } from '../audit/audit.service';
import { ConsentService } from '../companies/consent.service';

import { CredentialsService } from './credentials.service';
import type { AdminSignInRequest, DeviceInfo, MobileSignInRequest } from './dto/sign-in.request';
import type { MobileSignInResponse, TokenPairResponse } from './dto/token-pair.response';
import { type ClientInfo, SessionsService } from './sessions.service';

type UserWithEmployee = User & { employee: Employee | null };

@Injectable()
export class SignInService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credentials: CredentialsService,
    private readonly sessions: SessionsService,
    private readonly rateLimit: RateLimitService,
    private readonly consent: ConsentService,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** FR-M1 + FR-M3: email or Employee ID, then device binding. */
  async signInMobile(
    input: MobileSignInRequest,
    client: ClientInfo,
  ): Promise<MobileSignInResponse> {
    await this.checkIpLimit(client);
    const user = await this.findMobileUser(input.login.trim());
    if (!user) {
      return this.credentials.rejectUnknown(input.password);
    }
    TenantContext.set(user.companyId);
    await this.credentials.verify(user, input.password);

    const employee = user.employee;
    if (!employee) {
      throw new AppError('MOBILE_ACCESS_DENIED'); // PRD §4.3: non-employee admins are web only
    }
    if (employee.status !== 'ACTIVE') {
      throw new AppError('ACCOUNT_DEACTIVATED');
    }

    const deviceId = await this.bindOrMatchDevice(user, employee, input.device);
    const tokens = await this.sessions.start(
      {
        userId: user.id,
        companyId: user.companyId,
        audience: 'MOBILE',
        employeeId: employee.id,
        deviceId,
      },
      client,
    );
    const consent = await this.consent.statusFor(employee.id);
    return { ...tokens, consentRequired: consent.required };
  }

  async signInAdmin(input: AdminSignInRequest, client: ClientInfo): Promise<TokenPairResponse> {
    await this.checkIpLimit(client);
    // system client: the company is unknown until the email matches.
    const users = await this.prisma.system.user.findMany({
      where: { email: input.email },
      include: { adminUser: true },
      take: 2,
    });
    // Same email in two companies can't be told apart without a company hint: treat as unknown.
    const user = users.length === 1 ? users[0] : undefined;
    if (!user) {
      return this.credentials.rejectUnknown(input.password);
    }
    TenantContext.set(user.companyId);
    await this.credentials.verify(user, input.password);

    if (!user.adminUser || user.adminUser.status !== 'ACTIVE') {
      throw new AppError('NO_ADMIN_ACCESS');
    }
    return this.sessions.start(
      {
        userId: user.id,
        companyId: user.companyId,
        audience: 'ADMIN',
        adminUserId: user.adminUser.id,
      },
      client,
    );
  }

  private async checkIpLimit(client: ClientInfo): Promise<void> {
    if (client.ip && !(await this.rateLimit.hit(RATE_LIMITS.signInPerIp, client.ip))) {
      throw new AppError('RATE_LIMITED');
    }
  }

  private async findMobileUser(login: string): Promise<UserWithEmployee | undefined> {
    // system client: the company is unknown until the login matches.
    if (login.includes('@')) {
      const users = await this.prisma.system.user.findMany({
        where: { email: login },
        include: { employee: true },
        take: 2,
      });
      return users.length === 1 ? users[0] : undefined;
    }
    const employees = await this.prisma.system.employee.findMany({
      where: { employeeCode: login },
      include: { user: true },
      take: 2,
    });
    const match = employees.length === 1 ? employees[0] : undefined;
    return match ? { ...match.user, employee: match } : undefined;
  }

  /**
   * FR-M3: the first phone is bound automatically; a different phone gets a new phone request for
   * HR and the sign-in fails with DEVICE_NOT_RECOGNIZED.
   */
  private async bindOrMatchDevice(
    user: User,
    employee: Employee,
    device: DeviceInfo,
  ): Promise<string> {
    const deviceIdHash = hashDeviceId(device.id, this.env.DEVICE_ID_PEPPER);
    const details = {
      platform: device.platform,
      model: device.model,
      osVersion: device.osVersion,
      appVersion: device.appVersion,
    };
    const active = await this.prisma.tenant.device.findFirst({
      where: { employeeId: employee.id, revokedAt: null },
    });

    if (active?.deviceIdHash === deviceIdHash) {
      await this.prisma.tenant.device.update({ where: { id: active.id }, data: details });
      return active.id;
    }
    if (active) {
      const request = await this.requestDeviceChange(employee, deviceIdHash, details);
      throw new AppError('DEVICE_NOT_RECOGNIZED', { deviceChangeRequestId: request.id });
    }

    return this.prisma.tenant.$transaction(async (tx) => {
      const bound = await tx.device.create({
        data: { companyId: employee.companyId, employeeId: employee.id, deviceIdHash, ...details },
      });
      await this.audit.record(tx, {
        actorUserId: user.id,
        actorLabel: user.email,
        action: 'device.bound',
        entityType: 'employee',
        entityId: employee.id,
        after: { deviceId: bound.id, ...details },
      });
      return bound.id;
    });
  }

  private async requestDeviceChange(
    employee: Employee,
    deviceIdHash: string,
    details: Omit<DeviceInfo, 'id'>,
  ) {
    const pending = await this.prisma.tenant.deviceChangeRequest.findFirst({
      where: { employeeId: employee.id, status: 'PENDING' },
    });
    if (pending) {
      // Keep one pending request per employee, describing the latest phone that tried.
      return this.prisma.tenant.deviceChangeRequest.update({
        where: { id: pending.id },
        data: { deviceIdHash, ...details },
      });
    }
    return this.prisma.tenant.deviceChangeRequest.create({
      data: { companyId: employee.companyId, employeeId: employee.id, deviceIdHash, ...details },
    });
  }
}
