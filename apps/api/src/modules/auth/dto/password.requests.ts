import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class ForgotPasswordRequest {
  @ApiProperty() @IsEmail() @MaxLength(254) email!: string;
}

export class ResetPasswordRequest {
  @ApiProperty({ description: 'Token from the reset or invitation email' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  token!: string;

  @ApiProperty({ description: 'PRD §9.7 rules; violations return PASSWORD_POLICY' })
  @IsString()
  @MaxLength(200)
  password!: string;
}

export class ChangePasswordRequest {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) currentPassword!: string;
  @ApiProperty() @IsString() @MaxLength(200) newPassword!: string;
}
