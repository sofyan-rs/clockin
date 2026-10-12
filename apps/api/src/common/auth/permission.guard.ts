import { type CanActivate, type ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { AppError } from '../errors/app-error';

import { hasPermission, type Permission } from './permissions';

const PERMISSION_KEY = 'permission';

/** Marks a route with the permission it needs. Use with `@UseGuards(AdminAuthGuard, PermissionGuard)`. */
export const RequirePermission = (permission: Permission) =>
  SetMetadata(PERMISSION_KEY, permission);

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permission = this.reflector.getAllAndOverride<Permission | undefined>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!permission) {
      return true;
    }
    const admin = context.switchToHttp().getRequest<Request>().admin;
    if (!admin) {
      // Guard order bug, not a user error: PermissionGuard must follow AdminAuthGuard.
      throw new Error('PermissionGuard used without AdminAuthGuard');
    }
    if (!hasPermission(admin.role, permission)) {
      throw new AppError('FORBIDDEN', { permission });
    }
    return true;
  }
}
