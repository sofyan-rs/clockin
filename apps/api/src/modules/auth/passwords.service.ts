import { Inject, Injectable, Logger } from '@nestjs/common';
import type { User } from '@prisma/client';

import type { AuthSession } from '../../common/auth/auth.types';
import { AppError } from '../../common/errors/app-error';
import { PrismaService, type TenantTx } from '../../common/prisma/prisma.service';
import { RATE_LIMITS, RateLimitService } from '../../common/redis/rate-limit.service';
import { TenantContext } from '../../common/tenancy/tenant-context';
import { ENV, type Env } from '../../config/env';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { passwordResetMail } from '../mail/mail.templates';

import type { ChangePasswordRequest, ResetPasswordRequest } from './dto/password.requests';
import { PasswordHasher } from './password-hasher.service';
import { findPasswordPolicyViolations } from './rules/password-policy';
import { CLEARED_LOCKOUT } from './rules/sign-in-lockout';
import { randomToken, sha256 } from './secrets';
import { SessionsService } from './sessions.service';

const RESET_TTL_MS = 60 * 60 * 1000; // PRD §9.7: 60 minutes, single use

@Injectable()
export class PasswordsService {
  private readonly logger = new Logger(PasswordsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly hasher: PasswordHasher,
    private readonly sessions: SessionsService,
    private readonly rateLimit: RateLimitService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Always succeeds from the caller's view: no account enumeration (ARCHITECTURE §6.1). */
  async forgot(email: string): Promise<void> {
    if (!(await this.rateLimit.hit(RATE_LIMITS.forgotPasswordPerAccount, email))) {
      return;
    }
    // system client: the email may belong to any company.
    const users = await this.prisma.system.user.findMany({
      where: { email },
      include: { company: { select: { appName: true } } },
    });
    // Not awaited: response time must not reveal whether the account exists. Moves to a job in B5.
    void this.sendResetLinks(users);
  }

  private async sendResetLinks(users: (User & { company: { appName: string } })[]): Promise<void> {
    for (const user of users) {
      await TenantContext.run(async () => {
        const token = randomToken();
        await this.prisma.tenant.passwordReset.create({
          data: {
            companyId: user.companyId,
            userId: user.id,
            tokenHash: sha256(token),
            expiresAt: new Date(Date.now() + RESET_TTL_MS),
          },
        });
        const url = `${this.env.APP_PUBLIC_URL}/reset-password?token=${token}`;
        await this.mail.send(passwordResetMail(user.email, user.company.appName, url));
      }, user.companyId).catch((err: unknown) =>
        this.logger.error({ err }, 'Password reset mail failed'),
      );
    }
  }

  /** Reset link or invitation link → new password, unlocked account, every session signed out. */
  async reset(input: ResetPasswordRequest): Promise<void> {
    const tokenHash = sha256(input.token);
    const now = new Date();
    // system client: the token is the only thing that tells us the company.
    const [reset, invitation] = await Promise.all([
      this.prisma.system.passwordReset.findUnique({
        where: { tokenHash },
        include: { user: true },
      }),
      this.prisma.system.invitation.findUnique({ where: { tokenHash }, include: { user: true } }),
    ]);
    const resetIsValid = reset && !reset.usedAt && reset.expiresAt > now;
    const invitationIsValid = invitation && !invitation.acceptedAt && invitation.expiresAt > now;
    const user = resetIsValid ? reset.user : invitationIsValid ? invitation.user : null;
    if (!user) {
      throw new AppError('RESET_TOKEN_INVALID');
    }
    TenantContext.set(user.companyId);
    await this.assertAcceptable(user, input.password);
    const passwordHash = await this.hasher.hash(input.password);

    await this.prisma.tenant.$transaction(async (tx) => {
      if (resetIsValid) {
        await tx.passwordReset.update({ where: { id: reset.id }, data: { usedAt: now } });
      } else if (invitation) {
        await tx.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: now } });
      }
      await this.savePassword(tx, user, passwordHash);
      await this.sessions.revokeAllForUser(tx, user.id, 'PASSWORD_RESET');
      await this.audit.record(tx, {
        actorUserId: user.id,
        actorLabel: user.email,
        action: resetIsValid ? 'auth.password_reset' : 'auth.invitation_accepted',
        entityType: 'user',
        entityId: user.id,
      });
    });
  }

  /** PRD §9.7: keeps the caller's own session, signs out everywhere else. */
  async change(session: AuthSession, input: ChangePasswordRequest): Promise<void> {
    const user = await this.prisma.tenant.user.findUniqueOrThrow({ where: { id: session.userId } });
    if (!(await this.hasher.verify(user.passwordHash, input.currentPassword))) {
      throw new AppError('CURRENT_PASSWORD_INVALID');
    }
    await this.assertAcceptable(user, input.newPassword);
    const passwordHash = await this.hasher.hash(input.newPassword);

    await this.prisma.tenant.$transaction(async (tx) => {
      await this.savePassword(tx, user, passwordHash);
      await this.sessions.revokeAllForUser(tx, user.id, 'PASSWORD_CHANGE', session.sessionFamilyId);
      await this.audit.record(tx, {
        actorUserId: user.id,
        actorLabel: user.email,
        action: 'auth.password_changed',
        entityType: 'user',
        entityId: user.id,
      });
    });
  }

  private async assertAcceptable(user: User, password: string): Promise<void> {
    const violations = findPasswordPolicyViolations(password);
    if (violations.length > 0) {
      throw new AppError('PASSWORD_POLICY', { violations });
    }
    if (user.passwordHash && (await this.hasher.verify(user.passwordHash, password))) {
      throw new AppError('PASSWORD_REUSED');
    }
  }

  private async savePassword(tx: TenantTx, user: User, passwordHash: string): Promise<void> {
    await tx.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordChangedAt: new Date(),
        // Accepting an invitation activates the account; a manual LOCKED status stays.
        status: user.status === 'INVITED' ? 'ACTIVE' : user.status,
        ...CLEARED_LOCKOUT,
      },
    });
  }
}
