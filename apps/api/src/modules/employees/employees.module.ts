import { Module } from '@nestjs/common';

import { CompaniesModule } from '../companies/companies.module';

import { MeController } from './me.controller';
import { MeService } from './me.service';

@Module({
  imports: [CompaniesModule],
  controllers: [MeController],
  providers: [MeService],
})
export class EmployeesModule {}
