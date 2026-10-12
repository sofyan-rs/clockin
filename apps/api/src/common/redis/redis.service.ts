import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

import { ENV, type Env } from '../../config/env';

@Injectable()
export class RedisService implements OnModuleDestroy {
  // lazyConnect so tooling (OpenAPI emit) can build the app without a running Redis.
  readonly client: Redis;

  constructor(@Inject(ENV) env: Env) {
    this.client = new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 3 });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.status !== 'end' && this.client.status !== 'wait') {
      await this.client.quit();
    }
  }
}
