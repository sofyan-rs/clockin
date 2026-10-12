import { Injectable } from '@nestjs/common';
import type { ConsentVersion } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';

export interface ConsentStatus {
  currentVersion: number | null;
  acceptedVersion: number | null;
  /** FR-M4: true at first sign-in and whenever HR publishes a new version. */
  required: boolean;
  body: string | null;
}

@Injectable()
export class ConsentService {
  constructor(private readonly prisma: PrismaService) {}

  current(): Promise<ConsentVersion | null> {
    return this.prisma.tenant.consentVersion.findFirst({ orderBy: { version: 'desc' } });
  }

  async statusFor(employeeId: string): Promise<ConsentStatus> {
    const [current, accepted] = await Promise.all([
      this.current(),
      this.prisma.tenant.consentAcceptance.findFirst({
        where: { employeeId },
        orderBy: { consentVersion: { version: 'desc' } },
        select: { consentVersion: { select: { version: true } } },
      }),
    ]);
    const acceptedVersion = accepted?.consentVersion.version ?? null;
    return {
      currentVersion: current?.version ?? null,
      acceptedVersion,
      required: current !== null && acceptedVersion !== current.version,
      body: current?.body ?? null,
    };
  }
}
