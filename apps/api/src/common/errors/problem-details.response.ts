import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { ERROR_CODES, type ErrorCode } from './error-codes';

/** OpenAPI shape of ProblemDetails, attached as the default response of every operation. */
export class ProblemDetailsResponse {
  @ApiProperty({ example: 'urn:clockin:error:INVALID_CREDENTIALS' }) type!: string;
  @ApiProperty() title!: string;
  @ApiProperty() status!: number;
  @ApiProperty({ enum: Object.keys(ERROR_CODES), enumName: 'ErrorCode' }) code!: ErrorCode;
  @ApiPropertyOptional({ type: 'object', additionalProperties: true }) details?: Record<
    string,
    unknown
  >;
  @ApiPropertyOptional() requestId?: string;
}
