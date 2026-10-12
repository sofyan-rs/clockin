import { randomUUID } from 'node:crypto';

import type { Params } from 'nestjs-pino';

import type { Env } from '../../config/env';

/** ARCHITECTURE §4.2: JSON logs with request id; no PII (tokens, passwords, coordinates, emails). */
export function loggerConfig(env: Env): Params {
  return {
    pinoHttp: {
      level: env.LOG_LEVEL,
      genReqId: (req, res) => {
        const incoming = req.headers['x-request-id'];
        const id = typeof incoming === 'string' && incoming.length <= 100 ? incoming : randomUUID();
        res.setHeader('x-request-id', id);
        return id;
      },
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.headers["x-device-id"]',
          'res.headers["set-cookie"]',
        ],
        censor: '[redacted]',
      },
      autoLogging: { ignore: (req) => req.url === '/healthz' || req.url === '/readyz' },
      transport:
        env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { singleLine: true } }
          : undefined,
    },
  };
}
