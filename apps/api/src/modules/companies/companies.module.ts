import { Module } from '@nestjs/common';

import { AppConfigController } from './app-config.controller';
import { CompaniesService } from './companies.service';
import { ConsentService } from './consent.service';

@Module({
  controllers: [AppConfigController],
  providers: [CompaniesService, ConsentService],
  exports: [CompaniesService, ConsentService],
})
export class CompaniesModule {}
