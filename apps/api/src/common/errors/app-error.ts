import { ERROR_CODES, type ErrorCode } from './error-codes';

/** The one way to fail a request on purpose. The ProblemDetailsFilter turns it into problem+json. */
export class AppError extends Error {
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    readonly details?: Record<string, unknown>,
    // Only for codes that legitimately differ by endpoint (ARCHITECTURE §7.2 vs §6.1).
    status?: number,
  ) {
    super(code);
    this.name = 'AppError';
    this.status = status ?? ERROR_CODES[code];
  }
}
