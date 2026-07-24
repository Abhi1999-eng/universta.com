import { randomUUID } from 'node:crypto';
import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { isSafeRequestId } from '../config/environment';
import { RequestContextService } from './request-context.service';
import { StructuredLogger } from './structured-logger.service';

type RequestWithId = Request & { requestId?: string };

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  constructor(
    private readonly context: RequestContextService,
    private readonly logger: StructuredLogger,
  ) {}

  use(request: RequestWithId, response: Response, next: NextFunction): void {
    const incomingRequestId = request.header('x-request-id');
    const requestId = isSafeRequestId(incomingRequestId)
      ? incomingRequestId
      : randomUUID();
    const startedAt = performance.now();

    request.requestId = requestId;
    response.setHeader('x-request-id', requestId);
    response.on('finish', () => {
      this.logger.logRequest({
        requestId,
        method: request.method,
        path: request.originalUrl.split('?')[0],
        statusCode: response.statusCode,
        durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
      });
    });

    this.context.run(requestId, () => next());
  }
}
