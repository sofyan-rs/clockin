import createClient, { type ClientOptions } from 'openapi-fetch';

import type { components, paths } from './schema';

export type { components, paths };

/** Every API error body (application/problem+json); switch on `code`. */
export type ProblemDetails = components['schemas']['ProblemDetailsResponse'];
export type ErrorCode = ProblemDetails['code'];

export function createApiClient(options: ClientOptions) {
  return createClient<paths>(options);
}

export type ApiClient = ReturnType<typeof createApiClient>;
