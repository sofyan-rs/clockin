import { ApiProperty } from '@nestjs/swagger';
import { AdminRole, AdminScopeKind } from '@prisma/client';

import { PERMISSIONS, type Permission } from '../../../common/auth/permissions';
import { AppFeatures } from '../../companies/dto/app-config.response';

export class AdminScopeResponse {
  @ApiProperty({ enum: AdminScopeKind, enumName: 'AdminScopeKind' }) kind!: AdminScopeKind;
  @ApiProperty({ type: [String], description: 'Only for DEPARTMENTS' }) departmentIds!: string[];
}

export class AdminMeResponse {
  @ApiProperty() id!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty() email!: string;
  @ApiProperty({ type: String, nullable: true }) employeeId!: string | null;
  @ApiProperty({ enum: AdminRole, enumName: 'AdminRole' }) role!: AdminRole;
  @ApiProperty({ type: AdminScopeResponse }) scope!: AdminScopeResponse;
  @ApiProperty({ enum: PERMISSIONS, isArray: true }) permissions!: Permission[];
  @ApiProperty({ type: AppFeatures }) features!: AppFeatures;
  @ApiProperty() companyName!: string;
}
