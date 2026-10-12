import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

import { AuthCommonModule } from './common/auth/auth-common.module';
import { loggerConfig } from './common/http/logger.config';
import { ServerTimeMiddleware } from './common/http/server-time.middleware';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { TenantMiddleware } from './common/tenancy/tenant.middleware';
import { ConfigModule } from './config/config.module';
import { ENV, type Env } from './config/env';
import { AdminUsersModule } from './modules/admin-users/admin-users.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { HealthModule } from './modules/health/health.module';
import { MailModule } from './modules/mail/mail.module';

@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRootAsync({ inject: [ENV], useFactory: (env: Env) => loggerConfig(env) }),
    PrismaModule,
    RedisModule,
    AuthCommonModule,
    AuditModule,
    MailModule,
    HealthModule,
    CompaniesModule,
    AuthModule,
    EmployeesModule,
    AdminUsersModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantMiddleware, ServerTimeMiddleware).forRoutes('*path');
  }
}
