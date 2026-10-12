import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { AdminAuthGuard } from '../../common/auth/admin-auth.guard';
import type { AuthAdmin } from '../../common/auth/auth.types';
import { CurrentAdmin } from '../../common/auth/current-user.decorators';

import { AdminUsersService } from './admin-users.service';
import { AdminMeResponse } from './dto/admin-me.response';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('v1/admin/me')
export class AdminMeController {
  constructor(private readonly adminUsers: AdminUsersService) {}

  @Get()
  @ApiOkResponse({ type: AdminMeResponse })
  me(@CurrentAdmin() admin: AuthAdmin): Promise<AdminMeResponse> {
    return this.adminUsers.me(admin);
  }
}
