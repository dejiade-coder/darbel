import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Stamps every request with a UUID for log correlation, audit trail, and
 * client-side debugging.
 *
 * The id is read from incoming `X-Request-Id` header if present (so callers
 * can correlate across systems), otherwise generated.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.header('x-request-id');
    const id = incoming && isValidUuid(incoming) ? incoming : uuidv4();
    (req as Request & { requestId: string }).requestId = id;
    res.setHeader('x-request-id', id);
    next();
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUuid(s: string): boolean {
  return UUID_RE.test(s);
}
