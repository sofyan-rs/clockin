import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { RedisService } from '../src/common/redis/redis.service';
import { MailService } from '../src/modules/mail/mail.service';
import type { MailMessage } from '../src/modules/mail/mail.templates';

/** Captures mail instead of sending it. */
export class FakeMailService {
  readonly sent: MailMessage[] = [];

  send(message: MailMessage): Promise<void> {
    this.sent.push(message);
    return Promise.resolve();
  }

  /** Waits for a mail to `to` (some mails are sent after the response, e.g. forgot password). */
  async waitFor(to: string, timeoutMs = 3000): Promise<MailMessage> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const found = this.sent.find((m) => m.to === to);
      if (found) return found;
      await new Promise((r) => setTimeout(r, 25));
    }
    throw new Error(`No mail to ${to} within ${timeoutMs} ms`);
  }

  tokenFrom(message: MailMessage): string {
    const match = /token=([\w-]+)/.exec(message.text);
    if (!match?.[1]) throw new Error('No token in mail');
    return match[1];
  }
}

export interface TestApp {
  app: NestExpressApplication;
  http: TestAgent;
  prisma: PrismaService;
  mail: FakeMailService;
  reset(): Promise<void>;
  close(): Promise<void>;
}

export async function createTestApp(): Promise<TestApp> {
  const mail = new FakeMailService();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MailService)
    .useValue(mail)
    .compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ bufferLogs: true });
  configureApp(app);
  await app.init();

  const prisma = app.get(PrismaService);
  const redis = app.get(RedisService);

  return {
    app,
    http: request(app.getHttpServer()),
    prisma,
    mail,
    async reset() {
      const tables = await prisma.system.$queryRaw<{ tablename: string }[]>`
        SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
      const list = tables.map((t) => `"${t.tablename}"`).join(', ');
      await prisma.system.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
      await redis.client.flushdb();
      mail.sent.length = 0;
    },
    close: () => app.close(),
  };
}
