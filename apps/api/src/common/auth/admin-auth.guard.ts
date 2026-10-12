import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { AppError } from '../errors/app-error';
import { PrismaService } from '../prisma/prisma.service';

import { AccessTokenService } from './access-token.service';
import { toAdminScope } from './auth.types';

/** ARCHITECTURE §4.2: aud=admin and the admin access is still active. */
@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly accessTokens: AccessTokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const { claims, ...auth } = await this.accessTokens.authenticate(request, 'ADMIN');

    const admin = await this.prisma.tenant.adminUser.findFirst({
      where: { id: claims.aid, userId: claims.sub, status: 'ACTIVE' },
    });
    if (!admin) {
      throw new AppError('UNAUTHENTICATED');
    }

    request.auth = auth;
    request.admin = {
      ...auth,
      adminUserId: admin.id,
      employeeId: admin.employeeId,
      role: admin.role,
      scope: toAdminScope(admin.scopeKind, admin.scopeDepartmentIds),
    };
    return true;
  }
}
