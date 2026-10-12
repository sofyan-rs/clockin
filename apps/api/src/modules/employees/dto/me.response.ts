import { ApiProperty } from '@nestjs/swagger';
import { DevicePlatform } from '@prisma/client';

export const MOBILE_ROLES = ['STAFF', 'TEAM_LEAD', 'MANAGER', 'HR'] as const;
export type MobileRole = (typeof MOBILE_ROLES)[number];

export class WorkModes {
  @ApiProperty() wfo!: boolean;
  @ApiProperty() wfh!: boolean;
}

export class LinkedDevice {
  @ApiProperty({ enum: DevicePlatform, enumName: 'DevicePlatform' }) platform!: DevicePlatform;
  @ApiProperty({ type: String, nullable: true }) model!: string | null;
  @ApiProperty({ format: 'date-time' }) boundAt!: string;
}

export class ConsentStatusResponse {
  @ApiProperty({ type: Number, nullable: true }) currentVersion!: number | null;
  @ApiProperty({ type: Number, nullable: true }) acceptedVersion!: number | null;
  @ApiProperty() required!: boolean;
  @ApiProperty({ type: String, nullable: true, description: 'Current consent text' }) body!:
    string | null;
}

export class MeResponse {
  @ApiProperty() id!: string;
  @ApiProperty() employeeCode!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty() email!: string;
  @ApiProperty({ type: String, nullable: true }) phone!: string | null;
  @ApiProperty({ format: 'date', example: '2026-01-05' }) joinDate!: string;
  @ApiProperty({ type: WorkModes }) workModes!: WorkModes;
  @ApiProperty({ type: LinkedDevice, nullable: true }) device!: LinkedDevice | null;
  @ApiProperty({ enum: MOBILE_ROLES, isArray: true, description: 'PRD §4.1, computed' })
  roles!: MobileRole[];
  @ApiProperty({ type: ConsentStatusResponse }) consent!: ConsentStatusResponse;
}
