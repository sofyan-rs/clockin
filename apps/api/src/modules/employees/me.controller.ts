import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';

import type { AuthEmployee } from '../../common/auth/auth.types';
import { CurrentEmployee } from '../../common/auth/current-user.decorators';
import { DEVICE_ID_HEADER } from '../../common/auth/device-id';
import { MobileAuthGuard } from '../../common/auth/mobile-auth.guard';

import { AcceptConsentRequest } from './dto/accept-consent.request';
import { MeResponse } from './dto/me.response';
import { MeService } from './me.service';

@ApiTags('me')
@ApiBearerAuth()
@ApiHeader({ name: DEVICE_ID_HEADER, required: true })
@UseGuards(MobileAuthGuard)
@Controller('v1/me')
export class MeController {
  constructor(private readonly me: MeService) {}

  @Get()
  @ApiOkResponse({ type: MeResponse })
  profile(@CurrentEmployee() employee: AuthEmployee): Promise<MeResponse> {
    return this.me.profile(employee);
  }

  @Post('consent')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  acceptConsent(
    @CurrentEmployee() employee: AuthEmployee,
    @Body() body: AcceptConsentRequest,
  ): Promise<void> {
    return this.me.acceptConsent(employee, body.version);
  }
}
