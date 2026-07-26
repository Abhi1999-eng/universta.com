import 'server-only';

import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';

export type LeadProxyOperation =
  | 'list'
  | 'options'
  | `detail:${string}`
  | `status:${string}`
  | `notes:${string}`;

const MAX_BODY_BYTES = 16 * 1024;
const UPSTREAM_TIMEOUT_MS = 5_000;
const QUERY_FIELDS = [
  'q',
  'status',
  'countryId',
  'courseLevelId',
  'intakeId',
  'sourceType',
  'createdFrom',
  'createdTo',
  'page',
  'limit',
] as const;
const SAFE_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: 'Please check the lead request',
  UNAUTHORIZED: 'Your admin session is invalid',
  INVALID_ACCESS_TOKEN: 'Your admin session is invalid',
  FORBIDDEN: 'Super Admin access is required',
  LEAD_NOT_FOUND: 'Lead not found',
  LEAD_STALE_VERSION:
    'This lead changed in another session. Reload before saving',
  CONFLICT: 'This lead changed in another session',
};

type SafeEnvelope = {
  data: unknown;
  meta: unknown;
  error: { code: string; message: string; details: unknown } | null;
  requestId: string;
  timestamp: string;
};

function requestIdFrom(request: NextRequest): string {
  const incoming = request.headers.get('x-request-id') ?? '';
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(incoming)
    ? incoming
    : randomUUID();
}

function envelope(
  requestId: string,
  data: unknown,
  error: SafeEnvelope['error'],
  meta: unknown = null,
): SafeEnvelope {
  return {
    data,
    meta,
    error,
    requestId,
    timestamp: new Date().toISOString(),
  };
}

function respond(
  status: number,
  body: SafeEnvelope,
): NextResponse<SafeEnvelope> {
  const response = NextResponse.json(body, { status });
  response.headers.set('cache-control', 'no-store');
  response.headers.set('x-request-id', body.requestId);
  return response;
}

function fail(status: number, requestId: string, code: string) {
  return respond(
    status,
    envelope(requestId, null, {
      code,
      message: SAFE_MESSAGES[code] ?? 'Lead request could not be completed',
      details: null,
    }),
  );
}

function operationDetails(operation: LeadProxyOperation): {
  method: 'GET' | 'PATCH' | 'POST';
  path: string;
  bodyFields: string[];
} {
  if (operation === 'list') {
    return { method: 'GET', path: '/api/v1/admin/leads', bodyFields: [] };
  }
  if (operation === 'options') {
    return {
      method: 'GET',
      path: '/api/v1/admin/leads/options',
      bodyFields: [],
    };
  }
  const [action, id] = operation.split(':');
  const safeId = encodeURIComponent(id ?? '');
  if (action === 'detail') {
    return {
      method: 'GET',
      path: `/api/v1/admin/leads/${safeId}`,
      bodyFields: [],
    };
  }
  if (action === 'status') {
    return {
      method: 'PATCH',
      path: `/api/v1/admin/leads/${safeId}/status`,
      bodyFields: ['status', 'expectedUpdatedAt', 'reason'],
    };
  }
  return {
    method: 'POST',
    path: `/api/v1/admin/leads/${safeId}/notes`,
    bodyFields: ['note', 'noteType', 'isPinned'],
  };
}

function safeBody(value: unknown, fields: string[]): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    if (field in source) result[field] = source[field];
  }
  return JSON.stringify(result);
}

function normalize(
  value: unknown,
  fallbackRequestId: string,
  status: number,
): SafeEnvelope {
  if (!value || typeof value !== 'object' || !('data' in value)) {
    return envelope(fallbackRequestId, null, {
      code: 'LEAD_SERVICE_UNAVAILABLE',
      message: 'Lead service is temporarily unavailable',
      details: null,
    });
  }
  const candidate = value as {
    data?: unknown;
    meta?: unknown;
    error?: unknown;
    requestId?: unknown;
  };
  const requestId =
    typeof candidate.requestId === 'string' &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(candidate.requestId)
      ? candidate.requestId
      : fallbackRequestId;
  if (status < 400 && !candidate.error) {
    return envelope(
      requestId,
      candidate.data ?? null,
      null,
      candidate.meta ?? null,
    );
  }
  const raw =
    candidate.error && typeof candidate.error === 'object'
      ? (candidate.error as { code?: unknown; details?: unknown })
      : {};
  const code =
    typeof raw.code === 'string' && SAFE_MESSAGES[raw.code]
      ? raw.code
      : 'LEAD_REQUEST_FAILED';
  return envelope(requestId, null, {
    code,
    message: SAFE_MESSAGES[code] ?? 'Lead request could not be completed',
    details:
      code === 'VALIDATION_ERROR' && Array.isArray(raw.details)
        ? raw.details
        : null,
  });
}

export async function proxyLeadRoute(
  request: NextRequest,
  operation: LeadProxyOperation,
): Promise<NextResponse<SafeEnvelope>> {
  const requestId = requestIdFrom(request);
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ') || authorization.length < 8) {
    return fail(401, requestId, 'UNAUTHORIZED');
  }
  const details = operationDetails(operation);
  const headers = new Headers({
    accept: 'application/json',
    authorization,
    'x-request-id': requestId,
  });
  const url = new URL(
    details.path,
    process.env.API_BASE_URL ?? 'http://127.0.0.1:4000',
  );
  if (operation === 'list') {
    const incoming = new URL(request.url);
    for (const field of QUERY_FIELDS) {
      const values = incoming.searchParams.getAll(field);
      if (values.length > 1) return fail(400, requestId, 'VALIDATION_ERROR');
      if (values[0] !== undefined) url.searchParams.set(field, values[0]);
    }
  }
  let body: string | undefined;
  if (details.method !== 'GET') {
    const declared = Number(request.headers.get('content-length') ?? 0);
    if (declared > MAX_BODY_BYTES) {
      return fail(413, requestId, 'VALIDATION_ERROR');
    }
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
      return fail(413, requestId, 'VALIDATION_ERROR');
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return fail(400, requestId, 'VALIDATION_ERROR');
    }
    body = safeBody(parsed, details.bodyFields) ?? '{}';
    headers.set('content-type', 'application/json');
  }
  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: details.method,
      headers,
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    return fail(502, requestId, 'LEAD_SERVICE_UNAVAILABLE');
  }
  let parsed: unknown;
  try {
    parsed = await upstream.json();
  } catch {
    return fail(502, requestId, 'LEAD_SERVICE_UNAVAILABLE');
  }
  return respond(
    upstream.status,
    normalize(parsed, requestId, upstream.status),
  );
}
