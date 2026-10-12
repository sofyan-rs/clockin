import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { AppError } from './app-error';
import type { ErrorCode } from './error-codes';

/** Shape of every error body (RFC 7807 + our stable `code`). */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  code: ErrorCode;
  details?: Record<string, unknown>;
  requestId?: string;
}

const STATUS_TO_CODE: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_FAILED',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHENTICATED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'PAYLOAD_TOO_LARGE',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
};

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const problem = this.toProblem(exception);
    problem.requestId = request.id as string | undefined;

    if (problem.status >= 500) {
      this.logger.error({ err: exception, requestId: problem.requestId }, 'Unhandled error');
    }
    response.status(problem.status).type('application/problem+json').json(problem);
  }

  private toProblem(exception: unknown): ProblemDetails {
    if (exception instanceof AppError) {
      return problem(exception.status, exception.code, exception.details);
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return problem(status, STATUS_TO_CODE[status] ?? (status >= 500 ? 'INTERNAL' : 'CONFLICT'));
    }
    return problem(HttpStatus.INTERNAL_SERVER_ERROR, 'INTERNAL');
  }
}

function problem(
  status: number,
  code: ErrorCode,
  details?: Record<string, unknown>,
): ProblemDetails {
  return {
    type: `urn:clockin:error:${code}`,
    title: code,
    status,
    code,
    ...(details ? { details } : {}),
  };
}
