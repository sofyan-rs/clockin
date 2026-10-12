import { Module } from '@nestjs/common';

import { CompaniesModule } from '../companies/companies.module';

import { AuthController } from './auth.controller';
import { CredentialsService } from './credentials.service';
import { InvitationsService } from './invitations.service';
import { PasswordHasher } from './password-hasher.service';
import { PasswordsService } from './passwords.service';
import { SessionsService } from './sessions.service';
import { SignInService } from './sign-in.service';

@Module({
  imports: [CompaniesModule],
  controllers: [AuthController],
  providers: [
    PasswordHasher,
    CredentialsService,
    SessionsService,
    SignInService,
    PasswordsService,
    InvitationsService,
  ],
  exports: [PasswordHasher, SessionsService, InvitationsService],
})
export class AuthModule {}
