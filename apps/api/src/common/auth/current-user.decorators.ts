import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import type { AuthAdmin, AuthEmployee, AuthSession } from './auth.types';

function fromRequest<T>(pick: (request: Request) => T | undefined, name: string) {
  return createParamDecorator((_data: unknown, context: ExecutionContext): T => {
    const value = pick(context.switchToHttp().getRequest<Request>());
    if (!value) {
      throw new Error(`${name} used on a route without the matching auth guard`);
    }
    return value;
  });
}

export const CurrentSession = fromRequest<AuthSession>((r) => r.auth, '@CurrentSession()');
export const CurrentEmployee = fromRequest<AuthEmployee>((r) => r.employee, '@CurrentEmployee()');
export const CurrentAdmin = fromRequest<AuthAdmin>((r) => r.admin, '@CurrentAdmin()');
