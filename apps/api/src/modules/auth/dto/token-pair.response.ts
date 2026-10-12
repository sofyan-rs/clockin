import { ApiProperty } from '@nestjs/swagger';

export class TokenPairResponse {
  @ApiProperty({ description: 'JWT, 15 minutes' }) accessToken!: string;
  @ApiProperty({ format: 'date-time' }) accessTokenExpiresAt!: string;
  @ApiProperty({ description: 'Opaque, rotated on every refresh' }) refreshToken!: string;
  @ApiProperty({ format: 'date-time' }) refreshTokenExpiresAt!: string;
}

export class MobileSignInResponse extends TokenPairResponse {
  @ApiProperty({ description: 'FR-M4: show the consent screen before Home' })
  consentRequired!: boolean;
}
