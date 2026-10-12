import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';

import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

@ApiExcludeController()
@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** Liveness for the Docker HEALTHCHECK (DEPLOYMENT §2). */
  @Get('healthz')
  health(): { status: 'ok' } {
    return { status: 'ok' };
  }

  /** Readiness: dependencies reachable. S3 joins this check with the files module (B3). */
  @Get('readyz')
  async ready(@Res({ passthrough: true }) res: Response): Promise<Record<string, 'ok' | 'down'>> {
    const [db, redis] = await Promise.all([
      this.prisma.system.$queryRaw`SELECT 1`.then(
        () => 'ok' as const,
        () => 'down' as const,
      ),
      this.redis.client.ping().then(
        () => 'ok' as const,
        () => 'down' as const,
      ),
    ]);
    if (db !== 'ok' || redis !== 'ok') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return { db, redis };
  }
}
