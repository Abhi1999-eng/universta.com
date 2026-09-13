import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Same-origin proxy for the Study Abroad assessment.
 *
 * It follows the counselling proxy beside it: the browser never learns the API
 * origin, the body is size-capped and field-allowlisted before it travels, and
 * upstream errors are mapped to a small set of safe messages rather than
 * forwarded. That route is left exactly as it is -- it serves other pages, and
 * a shared refactor is not worth the regression risk for the sake of sixty
 * lines.
 */

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://127.0.0.1:4000';
const MAX_BODY_BYTES = 16 * 1024;
const UPSTREAM_TIMEOUT_MS = 6_000;

const BODY_FIELDS = [
  'fullName',
  'email',
  'phoneNumber',
  'consent',
  'answers',
  'countrySlug',
  'companyWebsite',
  'sourcePagePath',
  'utmSource',
  'utmMedium',
  'utmCampaign',
] as const;

const SAFE_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: 'Please check the highlighted fields',
  ASSESSMENT_ANSWERS_INVALID: 'One or more answers are no longer available',
  ORIGIN_NOT_ALLOWED: 'This request could not be accepted',
  RATE_LIMITED: 'Too many requests. Please try again later',
  REQUEST_TOO_LARGE: 'The submitted form is too large',
  ASSESSMENT_SERVICE_UNAVAILABLE: 'The assessment is temporarily unavailable',
};

type SafeError = { code: string; message: string; details: unknown };
type SafeEnvelope = {
  data: unknown;
  meta: unknown;
  error: SafeError | null;
  requestId: string;
  timestamp: string;
};

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;

function envelope(requestId: string, data: unknown, error: SafeError | null): SafeEnvelope {
  return { data, meta: null, error, requestId, timestamp: new Date().toISOString() };
}

function respond(status: number, body: SafeEnvelope, retryAfter?: string | null) {
  const result = NextResponse.json(body, { status });
  result.headers.set('cache-control', 'no-store');
  result.headers.set('x-request-id', body.requestId);
  if (retryAfter) result.headers.set('retry-after', retryAfter);
  return result;
}

function failure(status: number, requestId: string, code: string) {
  return respond(
    status,
    envelope(requestId, null, {
      code,
      message: SAFE_MESSAGES[code] ?? 'The assessment could not be submitted',
      details: null,
    }),
  );
}

/** Only the fields the API expects travel upstream; anything else is dropped. */
function safeBody(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  for (const field of BODY_FIELDS) if (field in input) output[field] = input[field];
  /* Answers is the one nested object. It is flattened to string values here so
   * no structure the API does not expect can travel inside it; the API then
   * checks every value against its own list regardless. */
  if (output.answers && typeof output.answers === 'object' && !Array.isArray(output.answers)) {
    const answers: Record<string, string> = {};
    for (const [key, entry] of Object.entries(output.answers as Record<string, unknown>))
      if (typeof entry === 'string' && key.length <= 40) answers[key] = entry.slice(0, 80);
    output.answers = answers;
  }
  return JSON.stringify(output);
}

export async function POST(request: NextRequest) {
  const header = request.headers.get('x-request-id') ?? '';
  const requestId = ID.test(header) ? header : randomUUID();

  const origin = request.headers.get('origin');
  if (origin) {
    const allowed = [request.nextUrl.origin, process.env.WEB_ORIGIN].filter(Boolean);
    if (!allowed.includes(origin)) return failure(403, requestId, 'ORIGIN_NOT_ALLOWED');
  }

  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES)
    return failure(413, requestId, 'REQUEST_TOO_LARGE');
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES)
    return failure(413, requestId, 'REQUEST_TOO_LARGE');

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return failure(400, requestId, 'VALIDATION_ERROR');
  }

  const headers = new Headers({
    accept: 'application/json',
    'content-type': 'application/json',
    'x-request-id': requestId,
  });
  if (origin) headers.set('origin', origin);

  let upstream: Response;
  try {
    upstream = await fetch(
      new URL('/api/v1/public/counselling-leads/assessment', API_BASE_URL),
      {
        method: 'POST',
        headers,
        body: safeBody(parsed) ?? '{}',
        cache: 'no-store',
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      },
    );
  } catch {
    return failure(502, requestId, 'ASSESSMENT_SERVICE_UNAVAILABLE');
  }

  let value: unknown;
  try {
    value = await upstream.json();
  } catch {
    return failure(502, requestId, 'ASSESSMENT_SERVICE_UNAVAILABLE');
  }

  const candidate =
    value && typeof value === 'object'
      ? (value as { data?: unknown; error?: { code?: unknown } | null })
      : {};
  if (upstream.status < 400 && !candidate.error)
    return respond(upstream.status, envelope(requestId, candidate.data ?? null, null));

  const code =
    typeof candidate.error?.code === 'string' && SAFE_MESSAGES[candidate.error.code]
      ? candidate.error.code
      : 'ASSESSMENT_SERVICE_UNAVAILABLE';
  return respond(
    upstream.status,
    envelope(requestId, null, {
      code,
      message: SAFE_MESSAGES[code],
      details: null,
    }),
    upstream.headers.get('retry-after'),
  );
}
