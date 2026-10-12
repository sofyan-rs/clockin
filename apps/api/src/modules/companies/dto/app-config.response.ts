import { ApiProperty } from '@nestjs/swagger';

export class AppFeatures {
  @ApiProperty() requests!: boolean;
  @ApiProperty() notifications!: boolean;
  @ApiProperty() holidays!: boolean;
}

export class ContactHr {
  @ApiProperty({ type: String, nullable: true }) whatsapp!: string | null;
  @ApiProperty({ type: String, nullable: true }) phone!: string | null;
  @ApiProperty({ type: String, nullable: true }) email!: string | null;
}

export class AppCompany {
  @ApiProperty() name!: string;
  @ApiProperty() appName!: string;
  @ApiProperty({ type: String, nullable: true, description: 'Presigned logo URL (B2)' }) logoUrl!:
    string | null;
  @ApiProperty({ example: 'Asia/Jakarta' }) defaultTz!: string;
}

export class AppConfigResponse {
  @ApiProperty({ example: '1.0.0', description: 'FR-M5: older apps show Update required' })
  minAppVersion!: string;
  @ApiProperty() biometricUnlock!: boolean;
  @ApiProperty({ type: AppFeatures }) features!: AppFeatures;
  @ApiProperty({ type: AppCompany }) company!: AppCompany;
  @ApiProperty({ type: ContactHr }) contactHr!: ContactHr;
  @ApiProperty({ format: 'date-time' }) serverTime!: string;
}
