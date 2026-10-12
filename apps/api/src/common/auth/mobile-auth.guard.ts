import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { ENV, type Env } from '../../config/env';
import { AppError } from '../errors/app-error';
import { PrismaService } from '../prisma/prisma.service';

import { AccessTokenService } from './access-token.service';
import { DEVICE_ID_HEADER, hashDeviceId } from './device-id';

/** ARCHITECTURE §4.2: aud=mobile, active employee, and the request comes from the bound phone. */
@Injectable()
export class MobileAuthGuard implements CanActivate {
  constructor(
    private readonly accessTokens: AccessTokenService,
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const { claims, ...auth } = await this.accessTokens.authenticate(request, 'MOBILE');

    const employee = await this.prisma.tenant.employee.findFirst({
      where: { id: claims.eid, userId: claims.sub, status: 'ACTIVE' },
      select: {
        id: true,
        devices: { where: { revokedAt: null }, select: { id: true, deviceIdHash: true } },
      },
    });
    if (!employee) {
      throw new AppError('UNAUTHENTICATED');
    }

    const deviceHeader = request.header(DEVICE_ID_HEADER);
    const device = employee.devices[0];
    if (
      !device ||
      !deviceHeader ||
      hashDeviceId(deviceHeader, this.env.DEVICE_ID_PEPPER) !== device.deviceIdHash
    ) {
      // 403 here (not the 409 of sign-in): the token is fine, the phone is not (ARCHITECTURE §7.2).
      throw new AppError('DEVICE_NOT_RECOGNIZED', undefined, 403);
    }

    request.auth = auth;
    request.employee = { ...auth, employeeId: employee.id, deviceId: device.id };
    return true;
  }
}
