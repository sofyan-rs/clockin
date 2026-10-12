import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/** ARCHITECTURE §7.3: the app keeps an offset to server time from this header on every response. */
@Injectable()
export class ServerTimeMiddleware implements NestMiddleware {
  use(_req: Request, res: Response, next: NextFunction): void {
    res.setHeader('x-server-time', new Date().toISOString());
    next();
  }
}
