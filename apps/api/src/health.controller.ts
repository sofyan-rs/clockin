import { Controller, Get } from '@nestjs/common';

// Liveness probe used by the Docker HEALTHCHECK (DEPLOYMENT §2). Readiness (DB, Redis) comes in B1.
@Controller()
export class HealthController {
  @Get('healthz')
  health(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
