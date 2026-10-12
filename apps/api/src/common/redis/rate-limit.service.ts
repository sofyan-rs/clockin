import { Injectable } from '@nestjs/common';

import { RedisService } from './redis.service';

export interface RateLimitRule {
  /** Key namespace, e.g. `sign-in:ip`. */
  name: string;
  limit: number;
  windowSeconds: number;
}

/** Fixed-window counters in Redis (ARCHITECTURE §4.2 rate limiting). */
@Injectable()
export class RateLimitService {
  constructor(private readonly redis: RedisService) {}

  /** Counts one hit and returns whether it is still within the limit. */
  async hit(rule: RateLimitRule, subject: string): Promise<boolean> {
    const key = `rl:${rule.name}:${subject.toLowerCase()}`;
    const [[, count]] = (await this.redis.client
      .multi()
      .incr(key)
      .expire(key, rule.windowSeconds, 'NX')
      .exec()) as [[Error | null, number]];
    return count <= rule.limit;
  }
}

export const RATE_LIMITS = {
  // ARCHITECTURE §4.2. The per-account sign-in limit is the DB lockout (PRD §9.7), not Redis.
  signInPerIp: { name: 'sign-in:ip', limit: 20, windowSeconds: 60 },
  forgotPasswordPerAccount: { name: 'forgot:account', limit: 3, windowSeconds: 3600 },
} satisfies Record<string, RateLimitRule>;
