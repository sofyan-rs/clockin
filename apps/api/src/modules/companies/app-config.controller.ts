import { Controller, Get, Headers } from '@nestjs/common';
import { ApiHeader, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { CompaniesService } from './companies.service';
import { parseCompanySettings } from './company-settings';
import { AppConfigResponse } from './dto/app-config.response';

@ApiTags('app')
@Controller('v1/app')
export class AppConfigController {
  constructor(private readonly companies: CompaniesService) {}

  @Get('config')
  @ApiHeader({
    name: 'x-company',
    required: false,
    description: 'Company slug; optional while there is one company',
  })
  @ApiOkResponse({ type: AppConfigResponse })
  async config(@Headers('x-company') slug?: string): Promise<AppConfigResponse> {
    const company = await this.companies.resolvePublic(slug);
    const settings = parseCompanySettings(company.settings);
    return {
      minAppVersion: settings.mobileApp.minVersion,
      biometricUnlock: settings.mobileApp.biometricUnlock,
      features: settings.features,
      company: {
        name: company.name,
        appName: company.appName,
        logoUrl: null,
        defaultTz: company.defaultTz,
      },
      contactHr: {
        whatsapp: company.contactWhatsapp,
        phone: company.contactPhone,
        email: company.contactEmail,
      },
      serverTime: new Date().toISOString(),
    };
  }
}
