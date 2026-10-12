import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class AcceptConsentRequest {
  @ApiProperty({ description: 'The version the user read; must be the current one' })
  @IsInt()
  @Min(1)
  version!: number;
}
