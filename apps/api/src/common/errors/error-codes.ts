/**
 * Every error the API returns has a stable `code`; clients map it to translated copy
 * (admin `errors.<CODE>`, mobile strings). Add new codes here with their HTTP status.
 */
export const ERROR_CODES = {
  // Generic
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  RATE_LIMITED: 429,
  INTERNAL: 500,

  // Auth (PRD §9.7, FR-M1, FR-M3)
  INVALID_CREDENTIALS: 401,
  TOKEN_INVALID: 401,
  ACCOUNT_LOCKED: 423,
  ACCOUNT_DEACTIVATED: 403,
  MOBILE_ACCESS_DENIED: 403,
  NO_ADMIN_ACCESS: 403,
  DEVICE_NOT_RECOGNIZED: 409,
  RESET_TOKEN_INVALID: 400,
  PASSWORD_POLICY: 422,
  PASSWORD_REUSED: 422,
  CURRENT_PASSWORD_INVALID: 422,

  // Company / consent (FR-M4)
  COMPANY_NOT_RESOLVED: 400,
  CONSENT_VERSION_STALE: 409,
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;
