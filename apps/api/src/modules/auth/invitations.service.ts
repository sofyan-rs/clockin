import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';
import { ENV, type Env } from '../../config/env';
import { CompaniesService } from '../companies/companies.service';
import { MailService } from '../mail/mail.service';
import { invitationMail } from '../mail/mail.templates';

import { randomToken, sha256 } from './secrets';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Set-password links for new employees and admins. Accepted through POST /v1/auth/reset-password. */
@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companies: CompaniesService,
    private readonly mail: MailService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Creates a fresh invitation and emails it. Older open invitations stay valid until they expire. */
  async send(userId: string): Promise<void> {
    const user = await this.prisma.tenant.user.findUniqueOrThrow({ where: { id: userId } });
    const company = await this.companies.getCurrent();
    const token = randomToken();
    await this.prisma.tenant.invitation.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
      },
    });
    const url = `${this.env.APP_PUBLIC_URL}/reset-password?token=${token}`;
    await this.mail.send(invitationMail(user.email, company.appName, company.name, url));
  }
}
