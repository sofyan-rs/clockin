import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

// The document only depends on code, so placeholders are enough; nothing connects (lazy clients).
const PLACEHOLDER_ENV: Record<string, string> = {
  DATABASE_URL: 'postgresql://openapi@localhost:5432/openapi',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'openapi-placeholder-secret',
  DEVICE_ID_PEPPER: 'openapi-placeholder-pepper',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_PUBLIC_ENDPOINT: 'http://localhost:9000',
  S3_BUCKET: 'openapi',
  S3_ACCESS_KEY: 'openapi',
  S3_SECRET_KEY: 'openapi',
  SMTP_URL: 'smtp://localhost:1025',
  MAIL_FROM: 'openapi@localhost',
  APP_PUBLIC_URL: 'http://localhost:3001',
  API_PUBLIC_URL: 'http://localhost:3000',
  LOG_LEVEL: 'error',
  NODE_ENV: 'test',
};
for (const [key, value] of Object.entries(PLACEHOLDER_ENV)) {
  process.env[key] ??= value;
}

async function emit(): Promise<void> {
  const { AppModule } = await import('./app.module');
  const { buildOpenApiDocument, configureApp } = await import('./app.setup');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
  configureApp(app);
  const document = buildOpenApiDocument(app);
  const target = resolve(__dirname, '../../../packages/api-schema/openapi.json');
  writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`);
  await app.close();
  console.log(`OpenAPI written to ${target}`);
}

void emit();
