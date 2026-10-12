import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { SessionAudience } from '@prisma/client';
import type { Request } from 'express';

import { ENV, type Env } from '../../config/env';
import { AppError } from '../errors/app-error';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenancy/tenant-context';

import type { AccessTokenClaims, AuthSession } from './auth.types';

const AUDIENCE_CLAIM: Record<SessionAudience, AccessTokenClaims['aud']> = {
  MOBILE: 'mobile',
  ADMIN: 'admin',
};

@Injectable()
export class AccessTokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  sign(
    claims: Omit<AccessTokenClaims, 'aud'>,
    audience: SessionAudience,
  ): { token: string; expiresAt: Date } {
    const token = this.jwt.sign(claims, {
      secret: this.env.JWT_ACCESS_SECRET,
      audience: AUDIENCE_CLAIM[audience],
      expiresIn: this.env.JWT_ACCESS_TTL as `${number}m`,
    });
    const { exp } = this.jwt.decode<{ exp: number }>(token);
    return { token, expiresAt: new Date(exp * 1000) };
  }

  /**
   * Verifies the bearer token, checks the session family is still alive (sign-out, password change
   * and access removal take effect immediately) and sets the tenant for the rest of the request.
   */
  async authenticate(
    request: Request,
    audience?: SessionAudience,
  ): Promise<AuthSession & { claims: AccessTokenClaims }> {
    const claims = this.verify(request, audience);
    TenantContext.set(claims.cid);

    const session = await this.prisma.tenant.session.findFirst({
      where: {
        familyId: claims.sid,
        userId: claims.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (!session) {
      throw new AppError('UNAUTHENTICATED');
    }
    return {
      claims,
      userId: claims.sub,
      companyId: claims.cid,
      sessionFamilyId: claims.sid,
      audience: claims.aud === 'mobile' ? 'MOBILE' : 'ADMIN',
    };
  }

  private verify(request: Request, audience?: SessionAudience): AccessTokenClaims {
    const [scheme, token] = (request.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new AppError('UNAUTHENTICATED');
    }
    try {
      return this.jwt.verify<AccessTokenClaims>(token, {
        secret: this.env.JWT_ACCESS_SECRET,
        audience: audience ? AUDIENCE_CLAIM[audience] : ['mobile', 'admin'],
      });
    } catch {
      throw new AppError('UNAUTHENTICATED');
    }
  }
}
