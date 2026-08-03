import {
  ArgumentsHost,
  Catch,
  HttpException,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { RequestContextService } from './request-context.service';
import type { ResponseEnvelope } from './http.types';
import {
  redactSensitiveFields,
  StructuredLogger,
} from './structured-logger.service';

type ErrorResponse = { code?: unknown; message?: unknown; details?: unknown };

function isErrorResponse(value: unknown): value is ErrorResponse {
  return Boolean(value && typeof value === 'object');
}

function statusCodeFor(status: number): string {
  switch (status) {
    case 404:
      return 'NOT_FOUND';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 409:
      return 'CONFLICT';
    case 429:
      return 'RATE_LIMITED';
    case 413:
      return 'REQUEST_TOO_LARGE';
    case 503:
      return 'SERVICE_UNAVAILABLE';
    case 400:
      return 'BAD_REQUEST';
    default:
      return 'INTERNAL_ERROR';
  }
}

function isPayloadTooLarge(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as {
    status?: unknown;
    statusCode?: unknown;
    type?: unknown;
  };
  return (
    candidate.status === 413 ||
    candidate.statusCode === 413 ||
    candidate.type === 'entity.too.large'
  );
}

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly context: RequestContextService,
    private readonly logger: StructuredLogger,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request & { requestId?: string }>();
    const requestId =
      request.requestId ?? this.context.getRequestId() ?? 'unknown-request';
    const timestamp = new Date().toISOString();

    let status = 500;
    let code = 'INTERNAL_ERROR';
    let message = 'Internal server error';
    let details: unknown = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = statusCodeFor(status);
      const exceptionResponse = exception.getResponse();

      // A real unmatched-route 404 (Nest's own default, e.g. "Cannot GET
      // /foo") never carries an application `code` -- every deliberate
      // domain-level NotFoundException thrown by a service does (see
      // catalog.errors.ts and the ~30 services that follow its shape). That
      // `code` is the signal this filter needs: without it, the line below
      // used to overwrite EVERY 404's message with the generic "Route not
      // found", silently discarding messages like "None of the selected
      // records could be archived" or "Country not found" on every
      // intentional 404 in the API, not just genuinely unmatched routes.
      let hasApplicationErrorCode = false;
      if (isErrorResponse(exceptionResponse)) {
        if (typeof exceptionResponse.code === 'string') {
          code = exceptionResponse.code;
          hasApplicationErrorCode = true;
        }
        if (typeof exceptionResponse.message === 'string') {
          message = exceptionResponse.message;
        }
        if (exceptionResponse.details !== undefined) {
          details = redactSensitiveFields(exceptionResponse.details);
        }
      }
      if (status === 404 && !hasApplicationErrorCode) {
        message = 'Route not found';
      }

      if (status >= 500) {
        message =
          status === 503 ? 'Service unavailable' : 'Internal server error';
      }
    } else if (isPayloadTooLarge(exception)) {
      status = 413;
      code = 'REQUEST_TOO_LARGE';
      message = 'Request body is too large';
    } else {
      this.logger.logError('unhandled request exception', {
        requestId,
        method: request.method,
        path: request.originalUrl.split('?')[0],
        exceptionType:
          exception instanceof Error ? exception.name : 'UnknownError',
      });
    }

    const envelope: ResponseEnvelope<null> = {
      data: null,
      meta: null,
      error: { code, message, details },
      requestId,
      timestamp,
    };

    response.setHeader('x-request-id', requestId);
    response.setHeader('Cache-Control', 'no-store');
    response.status(status).json(envelope);
  }
}
