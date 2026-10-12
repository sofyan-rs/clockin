// e2e: real Postgres + Redis via Testcontainers (or E2E_DATABASE_URL / E2E_REDIS_URL when set).
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer } from '@testcontainers/redis';
import type { StartedTestContainer } from 'testcontainers';

declare global {
  var __E2E_CONTAINERS__: StartedTestContainer[] | undefined;
}

/** Starts Postgres + Redis once for the whole e2e run and applies migrations. */
export default async function globalSetup(): Promise<void> {
  const containers: StartedTestContainer[] = [];
  let databaseUrl = process.env.E2E_DATABASE_URL;
  let redisUrl = process.env.E2E_REDIS_URL;

  if (!databaseUrl) {
    const postgres = await new PostgreSqlContainer('postgres:16-alpine').start();
    containers.push(postgres);
    databaseUrl = postgres.getConnectionUri();
  }
  if (!redisUrl) {
    const redis = await new RedisContainer('redis:7-alpine').start();
    containers.push(redis);
    redisUrl = redis.getConnectionUrl();
  }

  process.env.DATABASE_URL = databaseUrl;
  process.env.REDIS_URL = redisUrl;
  globalThis.__E2E_CONTAINERS__ = containers;

  execSync('prisma migrate deploy', {
    cwd: resolve(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'ignore',
  });
}
