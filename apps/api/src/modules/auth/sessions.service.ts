import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type { Session, SessionAudience, SessionRevokeReason } from '@prisma/client';

import { AccessTokenService } from '../../common/auth/access-token.service';
import { AppError } from '../../common/errors/app-error';
import { PrismaService, type TenantTx } from '../../common/prisma/prisma.service';
import { TenantContext } from '../../common/tenancy/tenant-context';
import { ENV, type Env } from '../../config/env';

import type { TokenPairResponse } from './dto/token-pair.response';
import { randomToken, sha256 } from './secrets';

export interface SessionSubject {
  userId: string;
  companyId: string;
  audience: SessionAudience;
  employeeId?: string;
  adminUserId?: string;
  deviceId?: string;
}

export interface ClientInfo {
  ip?: string;
  userAgent?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessTokens: AccessTokenService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** New sign-in → new session family. */
  async start(subject: SessionSubject, client: ClientInfo): Promise<TokenPairResponse> {
    return this.issue(this.prisma.tenant, subject, randomUUID(), client);
  }

  /**
   * ARCHITECTURE §12: every refresh rotates the token. Presenting a token that was already rotated
   * means it leaked (or a client bug), so the whole family is revoked.
   */
  async rotate(refreshToken: string, client: ClientInfo): Promise<TokenPairResponse> {
    // system client: the refresh token is the only thing that tells us the company.
    const session = await this.prisma.system.session.findUnique({
      where: { refreshHash: sha256(refreshToken) },
    });
    if (!session) {
      throw new AppError('TOKEN_INVALID');
    }
    TenantContext.set(session.companyId);

    if (session.revokedAt) {
      if (session.revokedReason === 'ROTATED') {
        await this.revokeFamily(session.familyId, 'REFRESH_REUSE');
      }
      throw new AppError('TOKEN_INVALID');
    }
    if (session.expiresAt <= new Date()) {
      throw new AppError('TOKEN_INVALID');
    }

    const subject = await this.subjectFor(session);
    if (!subject) {
      await this.revokeFamily(session.familyId, 'INACTIVE');
      throw new AppError('TOKEN_INVALID');
    }

    return this.prisma.tenant.$transaction(async (tx) => {
      // Conditional update: of two concurrent refreshes with the same token only one wins.
      const { count } = await tx.session.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'ROTATED' },
      });
      if (count === 0) {
        throw new AppError('TOKEN_INVALID');
      }
      return this.issue(tx, subject, session.familyId, client);
    });
  }

  async revokeFamily(familyId: string, reason: SessionRevokeReason): Promise<void> {
    await this.prisma.tenant.session.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  /** Revokes every session of the user, optionally keeping the caller's own session family. */
  async revokeAllForUser(
    tx: TenantTx,
    userId: string,
    reason: SessionRevokeReason,
    keepFamilyId?: string,
  ): Promise<void> {
    await tx.session.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(keepFamilyId ? { familyId: { not: keepFamilyId } } : {}),
      },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  private async issue(
    tx: TenantTx,
    subject: SessionSubject,
    familyId: string,
    client: ClientInfo,
  ): Promise<TokenPairResponse> {
    const refreshToken = randomToken();
    const refreshTokenExpiresAt = new Date(Date.now() + this.env.REFRESH_TTL_DAYS * DAY_MS);
    await tx.session.create({
      data: {
        companyId: subject.companyId,
        userId: subject.userId,
        audience: subject.audience,
        deviceId: subject.deviceId,
        refreshHash: sha256(refreshToken),
        familyId,
        expiresAt: refreshTokenExpiresAt,
        ip: client.ip,
        userAgent: client.userAgent?.slice(0, 500),
      },
    });

    const access = this.accessTokens.sign(
      {
        sub: subject.userId,
        cid: subject.companyId,
        sid: familyId,
        eid: subject.employeeId,
        aid: subject.adminUserId,
      },
      subject.audience,
    );
    return {
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt.toISOString(),
      refreshToken,
      refreshTokenExpiresAt: refreshTokenExpiresAt.toISOString(),
    };
  }

  /** Re-checks that the person may still use this audience; null when not. */
  private async subjectFor(session: Session): Promise<SessionSubject | null> {
    const base = {
      userId: session.userId,
      companyId: session.companyId,
      audience: session.audience,
    };
    if (session.audience === 'ADMIN') {
      const admin = await this.prisma.tenant.adminUser.findFirst({
        where: { userId: session.userId, status: 'ACTIVE' },
        select: { id: true },
      });
      return admin ? { ...base, adminUserId: admin.id } : null;
    }
    const employee = await this.prisma.tenant.employee.findFirst({
      where: {
        userId: session.userId,
        status: 'ACTIVE',
        devices: { some: { id: session.deviceId ?? undefined, revokedAt: null } },
      },
      select: { id: true },
    });
    return employee && session.deviceId
      ? { ...base, employeeId: employee.id, deviceId: session.deviceId }
      : null;
  }
}
