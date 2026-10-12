import { Module } from '@nestjs/common';

import { CompaniesModule } from '../companies/companies.module';

import { AdminMeController } from './admin-me.controller';
import { AdminUsersService } from './admin-users.service';

@Module({
  imports: [CompaniesModule],
  controllers: [AdminMeController],
  providers: [AdminUsersService],
})
export class AdminUsersModule {}
