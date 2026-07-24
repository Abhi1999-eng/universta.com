import type { Request } from 'express';

export type RequestWithId = Request & { requestId?: string };

export interface ResponseEnvelope<T = unknown> {
  data: T | null;
  meta: unknown;
  error: {
    code: string;
    message: string;
    details: unknown;
  } | null;
  requestId: string;
  timestamp: string;
}
