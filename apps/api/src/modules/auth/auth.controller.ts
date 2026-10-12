import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import type { AuthSession } from '../../common/auth/auth.types';
import { AuthenticatedGuard } from '../../common/auth/authenticated.guard';
import { CurrentSession } from '../../common/auth/current-user.decorators';

import { clientInfo } from './client-info';
import {
  ChangePasswordRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
} from './dto/password.requests';
import { AdminSignInRequest, MobileSignInRequest, RefreshRequest } from './dto/sign-in.request';
import { MobileSignInResponse, TokenPairResponse } from './dto/token-pair.response';
import { PasswordsService } from './passwords.service';
import { SessionsService } from './sessions.service';
import { SignInService } from './sign-in.service';

@ApiTags('auth')
@Controller('v1/auth')
export class AuthController {
  constructor(
    private readonly signIn: SignInService,
    private readonly sessions: SessionsService,
    private readonly passwords: PasswordsService,
  ) {}

  @Post('mobile/sign-in')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: MobileSignInResponse })
  signInMobile(
    @Body() body: MobileSignInRequest,
    @Req() request: Request,
  ): Promise<MobileSignInResponse> {
    return this.signIn.signInMobile(body, clientInfo(request));
  }

  @Post('admin/sign-in')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: TokenPairResponse })
  signInAdmin(
    @Body() body: AdminSignInRequest,
    @Req() request: Request,
  ): Promise<TokenPairResponse> {
    return this.signIn.signInAdmin(body, clientInfo(request));
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: TokenPairResponse })
  refresh(@Body() body: RefreshRequest, @Req() request: Request): Promise<TokenPairResponse> {
    return this.sessions.rotate(body.refreshToken, clientInfo(request));
  }

  @Post('sign-out')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthenticatedGuard)
  @ApiBearerAuth()
  @ApiNoContentResponse()
  async signOut(@CurrentSession() session: AuthSession): Promise<void> {
    await this.sessions.revokeFamily(session.sessionFamilyId, 'SIGN_OUT');
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Always 204, whether or not the email exists' })
  forgotPassword(@Body() body: ForgotPasswordRequest): Promise<void> {
    return this.passwords.forgot(body.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Also accepts invitation tokens' })
  resetPassword(@Body() body: ResetPasswordRequest): Promise<void> {
    return this.passwords.reset(body);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthenticatedGuard)
  @ApiBearerAuth()
  @ApiNoContentResponse()
  changePassword(
    @CurrentSession() session: AuthSession,
    @Body() body: ChangePasswordRequest,
  ): Promise<void> {
    return this.passwords.change(session, body);
  }
}
