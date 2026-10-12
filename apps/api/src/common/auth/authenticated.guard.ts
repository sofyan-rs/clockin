import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { AccessTokenService } from './access-token.service';

/** Any signed-in caller, mobile or admin (sign-out, change password). */
@Injectable()
export class AuthenticatedGuard implements CanActivate {
  constructor(private readonly accessTokens: AccessTokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const { claims: _claims, ...auth } = await this.accessTokens.authenticate(request);
    request.auth = auth;
    return true;
  }
}
