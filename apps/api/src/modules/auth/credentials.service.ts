import { Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';

import { AppError } from '../../common/errors/app-error';
import { PrismaService } from '../../common/prisma/prisma.service';

import { PasswordHasher } from './password-hasher.service';
import { afterFailedSignIn, CLEARED_LOCKOUT, isLocked } from './rules/sign-in-lockout';

/**
 * Password check shared by mobile and admin sign-in. Callers must have set the tenant context.
 * Errors stay generic (INVALID_CREDENTIALS) so they never reveal whether an account exists.
 */
@Injectable()
export class CredentialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hasher: PasswordHasher,
  ) {}

  /** Same cost as a real check, for logins that match no account. */
  async rejectUnknown(password: string): Promise<never> {
    await this.hasher.verify(null, password);
    throw new AppError('INVALID_CREDENTIALS');
  }

  async verify(user: User, password: string): Promise<void> {
    const now = new Date();
    if (user.status === 'LOCKED' || isLocked(user, now)) {
      throw new AppError('ACCOUNT_LOCKED', {
        lockedUntil: user.lockedUntil?.toISOString() ?? null,
      });
    }

    // Invited users have no password until they accept the invitation.
    const isValid = await this.hasher.verify(user.passwordHash, password);
    if (!isValid) {
      const next = afterFailedSignIn(user, now);
      await this.prisma.tenant.user.update({ where: { id: user.id }, data: next });
      if (next.lockedUntil) {
        throw new AppError('ACCOUNT_LOCKED', { lockedUntil: next.lockedUntil.toISOString() });
      }
      throw new AppError('INVALID_CREDENTIALS');
    }

    if (user.failedAttempts > 0 || user.lockedUntil) {
      await this.prisma.tenant.user.update({ where: { id: user.id }, data: CLEARED_LOCKOUT });
    }
  }
}
