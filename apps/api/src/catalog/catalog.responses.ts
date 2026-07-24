import type { ResponseEnvelope, RequestWithId } from '../common/http.types';

export function successEnvelope<T>(
  request: RequestWithId,
  data: T,
  meta: unknown = null,
): ResponseEnvelope<T> {
  return {
    data,
    meta,
    error: null,
    requestId: request.requestId ?? 'unknown-request',
    timestamp: new Date().toISOString(),
  };
}
