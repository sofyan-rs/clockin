import { Injectable, type NestMiddleware } from '@nestjs/common';

import { TenantContext } from './tenant-context';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(_req: unknown, _res: unknown, next: () => void): void {
    TenantContext.run(next);
  }
}
