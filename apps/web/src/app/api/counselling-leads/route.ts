import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';

const MAX_BODY_BYTES = 16 * 1024;
const UPSTREAM_TIMEOUT_MS = 6_000;
const BODY_FIELDS = [
  'fullName',
  'email',
  'phoneNumber',
  'countrySlug',
  'studyLevelCode',
  'intakeSlug',
  'consent',
  'message',
  'companyWebsite',
  'sourceType',
  'sourceCountrySlug',
  'sourceSubjectSlug',
  'sourceSpecializationSlug',
  'sourceCourseSlug',
  'sourcePagePath',
  'referringPath',
  'landingPagePath',
  'utmSource',
  'utmMedium',
  'utmCampaign',
] as const;

type SafeError = { code: string; message: string; details: unknown };
type SafeEnvelope = {
  data: unknown;
  meta: unknown;
  error: SafeError | null;
  requestId: string;
  timestamp: string;
};

const SAFE_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: 'Please check the highlighted fields',
  LEAD_OPTIONS_INVALID: 'One or more selected options are no longer available',
  ORIGIN_NOT_ALLOWED: 'This request could not be accepted',
  RATE_LIMITED: 'Too many requests. Please try again later',
  REQUEST_TOO_LARGE: 'The submitted form is too large',
};

function requestIdFrom(request: NextRequest): string {
  const value = request.headers.get('x-request-id') ?? '';
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(value)
    ? value
    : randomUUID();
}

function envelope(
  requestId: string,
  data: unknown,
  error: SafeError | null,
): SafeEnvelope {
  return {
    data,
    meta: null,
    error,
    requestId,
    timestamp: new Date().toISOString(),
  };
}

function response(
  status: number,
  body: SafeEnvelope,
  retryAfter?: string | null,
): NextResponse<SafeEnvelope> {
  const result = NextResponse.json(body, { status });
  result.headers.set('cache-control', 'no-store');
  result.headers.set('x-request-id', body.requestId);
  if (retryAfter) result.headers.set('retry-after', retryAfter);
  return result;
}

function failure(
  status: number,
  requestId: string,
  code: string,
): NextResponse<SafeEnvelope> {
  return response(
    status,
    envelope(requestId, null, {
      code,
      message: SAFE_MESSAGES[code] ?? 'Counselling request could not be completed',
      details: null,
    }),
  );
}

function originAllowed(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  const configured = process.env.WEB_ORIGIN;
  return [request.nextUrl.origin, configured].filter(Boolean).includes(origin);
}

function safeBody(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  for (const field of BODY_FIELDS) {
    if (field in input) output[field] = input[field];
  }
  return JSON.stringify(output);
}

function safeUpstreamEnvelope(
  value: unknown,
  fallbackRequestId: string,
  status: number,
): SafeEnvelope {
  if (!value || typeof value !== 'object' || !('data' in value)) {
    return envelope(fallbackRequestId, null, {
      code: 'COUNSELLING_SERVICE_UNAVAILABLE',
      message: 'Counselling service is temporarily unavailable',
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
    return { ...envelope(requestId, candidate.data ?? null, null), meta: candidate.meta ?? null };
  }
  const error =
    candidate.error && typeof candidate.error === 'object'
      ? (candidate.error as { code?: unknown; details?: unknown })
      : {};
  const code =
    typeof error.code === 'string' && SAFE_MESSAGES[error.code]
      ? error.code
      : 'COUNSELLING_REQUEST_FAILED';
  const details =
    (code === 'VALIDATION_ERROR' || code === 'LEAD_OPTIONS_INVALID') &&
    Array.isArray(error.details)
      ? error.details
      : null;
  return envelope(requestId, null, {
    code,
    message: SAFE_MESSAGES[code] ?? 'Counselling request could not be completed',
    details,
  });
}

async function proxy(
  request: NextRequest,
  method: 'GET' | 'POST',
): Promise<NextResponse<SafeEnvelope>> {
  const requestId = requestIdFrom(request);
  if (!originAllowed(request)) {
    return failure(403, requestId, 'ORIGIN_NOT_ALLOWED');
  }
  const headers = new Headers({
    accept: 'application/json',
    'x-request-id': requestId,
  });
  const origin = request.headers.get('origin');
  if (origin) headers.set('origin', origin);
  let body: string | undefined;
  if (method === 'POST') {
    const declared = Number(request.headers.get('content-length') ?? 0);
    if (declared > MAX_BODY_BYTES) {
      return failure(413, requestId, 'REQUEST_TOO_LARGE');
    }
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
      return failure(413, requestId, 'REQUEST_TOO_LARGE');
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return failure(400, requestId, 'VALIDATION_ERROR');
    }
    body = safeBody(parsed) ?? '{}';
    headers.set('content-type', 'application/json');
  }
  const path =
    method === 'GET'
      ? '/api/v1/public/counselling-leads/options'
      : '/api/v1/public/counselling-leads';
  const url = new URL(
    path,
    process.env.API_BASE_URL ?? 'http://127.0.0.1:4000',
  );
  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method,
      headers,
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    return failure(502, requestId, 'COUNSELLING_SERVICE_UNAVAILABLE');
  }
  let value: unknown;
  try {
    value = await upstream.json();
  } catch {
    return failure(502, requestId, 'COUNSELLING_SERVICE_UNAVAILABLE');
  }
  return response(
    upstream.status,
    safeUpstreamEnvelope(value, requestId, upstream.status),
    upstream.headers.get('retry-after'),
  );
}

export function GET(request: NextRequest) {
  return proxy(request, 'GET');
}

export function POST(request: NextRequest) {
  return proxy(request, 'POST');
}
