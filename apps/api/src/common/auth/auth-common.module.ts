import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AccessTokenService } from './access-token.service';
import { AdminAuthGuard } from './admin-auth.guard';
import { AuthenticatedGuard } from './authenticated.guard';
import { MobileAuthGuard } from './mobile-auth.guard';
import { PermissionGuard } from './permission.guard';
import { ScopeService } from './scope.service';

const providers = [
  AccessTokenService,
  AuthenticatedGuard,
  MobileAuthGuard,
  AdminAuthGuard,
  PermissionGuard,
  ScopeService,
];

@Global()
@Module({
  imports: [JwtModule.register({})],
  providers,
  exports: [...providers, JwtModule],
})
export class AuthCommonModule {}
