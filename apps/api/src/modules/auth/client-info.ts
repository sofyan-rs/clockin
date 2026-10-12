import type { Request } from 'express';

import type { ClientInfo } from './sessions.service';

export function clientInfo(request: Request): ClientInfo {
  return { ip: request.ip, userAgent: request.header('user-agent') };
}
