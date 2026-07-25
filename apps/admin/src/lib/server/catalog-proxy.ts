import 'server-only';

import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';

export type CatalogProxyOperation =
  | 'continents:list'
  | 'continents:create'
  | `continents:get:${string}`
  | `continents:update:${string}`
  | `continents:delete:${string}`
  | 'countries:list'
  | 'countries:create'
  | `countries:get:${string}`
  | `countries:update:${string}`
  | `countries:publish:${string}`
  | `countries:unpublish:${string}`
  | `countries:delete:${string}`
  | `country-profiles:all:${string}`
  | `country-profiles:get:${string}:${'cost' | 'work' | 'language' | 'intakes' | 'statistics'}`
  | `country-profiles:put:${string}:${'cost' | 'work' | 'language' | 'intakes' | 'statistics'}`
  | `country-profiles:delete:${string}:${'cost' | 'work' | 'language' | 'statistics'}`
  | 'intakes:list';

const MAX_BODY_BYTES = 64 * 1024;
const UPSTREAM_TIMEOUT_MS = 5_000;
const SAFE_ERROR_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: 'Invalid catalog request',
  UNAUTHORIZED: 'Your admin session is invalid',
  FORBIDDEN: 'Super Admin access is required',
  NOT_FOUND: 'Catalog record not found',
  CONTINENT_NOT_FOUND: 'Continent not found',
  CONTINENT_CONFLICT: 'Continent details conflict with an existing record',
  CONTINENT_NAME_CONFLICT: 'Continent name already exists',
  CONTINENT_SLUG_CONFLICT: 'Continent slug already exists',
  CONTINENT_CODE_CONFLICT: 'Continent code already exists',
  CONTINENT_IN_USE: 'A continent containing countries cannot be deleted',
  CONTINENT_STALE_VERSION: 'The continent changed in another session. Reload before saving',
  COUNTRY_NOT_FOUND: 'Country not found',
  COUNTRY_CONTINENT_INVALID: 'The selected continent is not available',
  COUNTRY_NAME_CONFLICT: 'Country name already exists',
  COUNTRY_SLUG_CONFLICT: 'Country slug already exists',
  COUNTRY_CODE_CONFLICT: 'Country ISO code already exists',
  COUNTRY_STALE_VERSION: 'The country changed in another session. Reload before saving',
  COUNTRY_NOT_READY: 'Complete the required fields before publishing',
  COUNTRY_COST_PROFILE_STALE_VERSION: 'The cost profile changed in another session. Reload before saving',
  COUNTRY_WORK_PROFILE_STALE_VERSION: 'The work profile changed in another session. Reload before saving',
  COUNTRY_LANGUAGE_PROFILE_STALE_VERSION: 'The language profile changed in another session. Reload before saving',
  COUNTRY_INTAKES_STALE_VERSION: 'The country intakes changed in another session. Reload before saving',
  COUNTRY_STATISTICS_STALE_VERSION: 'The statistics changed in another session. Reload before saving',
  PROFILE_DECIMAL_INVALID: 'Profile decimal values are invalid',
  PROFILE_DECIMAL_PRECISION: 'Profile decimal precision is invalid',
  PROFILE_RANGE_INVALID: 'Profile minimum and maximum values are invalid',
  PROFILE_SOURCE_REQUIRED: 'A published profile value requires a source and verification timestamp',
  PROFILE_SOURCE_INVALID: 'Profile source reference is invalid',
  PROFILE_VERIFICATION_INVALID: 'Profile verification timestamp is invalid',
  COUNTRY_INTAKE_INVALID: 'One or more intake options are unavailable',
  COUNTRY_INTAKES_DUPLICATE: 'An intake can only be selected once',
};

interface SafeEnvelope {
  data: unknown;
  meta: unknown;
  error: { code: string; message: string; details: unknown } | null;
  requestId: string;
  timestamp: string;
}

function requestIdFrom(request: NextRequest): string {
  const incoming = request.headers.get('x-request-id') ?? '';
  return /^[a-zA-Z0-9._:-]{1,100}$/.test(incoming) ? incoming : randomUUID();
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

function errorResponse(status: number, requestId: string, code: string): NextResponse<SafeEnvelope> {
  const response = NextResponse.json(
    envelope(requestId, null, {
      code,
      message: SAFE_ERROR_MESSAGES[code] ?? 'Catalog request failed',
      details: null,
    }),
    { status },
  );
  response.headers.set('cache-control', 'no-store');
  response.headers.set('x-request-id', requestId);
  return response;
}

function operationDetails(operation: CatalogProxyOperation): { method: string; path: string; query: string[]; body: string[] } {
  if (operation === 'intakes:list') return { method: 'GET', path: '/api/v1/admin/intakes', query: [], body: [] };
  if (operation.startsWith('country-profiles:')) {
    const parts = operation.split(':');
    const action = parts[1];
    const countryId = encodeURIComponent(parts[2] ?? '');
    const profile = parts[3];
    const path = `/api/v1/admin/countries/${countryId}/profiles${profile ? `/${profile}` : ''}`;
    if (action === 'all') return { method: 'GET', path, query: [], body: [] };
    if (action === 'get') return { method: 'GET', path, query: [], body: [] };
    if (action === 'delete') return { method: 'DELETE', path, query: [], body: ['expectedUpdatedAt'] };
    const common = ['expectedUpdatedAt', 'sourceReference', 'verifiedAt', 'disclaimer'];
    const profileFields: Record<string, string[]> = {
      cost: ['currencyCode', 'currencySymbol', 'tuitionMin', 'tuitionMax', 'tuitionPeriod', 'tuitionNotes', 'livingCostMin', 'livingCostMax', 'livingCostPeriod', 'livingCostNotes', 'accommodationMin', 'accommodationMax', 'foodCostMin', 'foodCostMax', 'transportCostMin', 'transportCostMax', 'healthInsuranceCost', 'applicationFeeMin', 'applicationFeeMax', 'budgetBand', 'applicableYear'],
      work: ['partTimeAllowed', 'partTimeHoursPerWeek', 'partTimeHoursDuringBreaks', 'partTimeSummary', 'postStudyWorkAvailable', 'postStudyWorkMinMonths', 'postStudyWorkMaxMonths', 'postStudyWorkSummary', 'immigrationPathwayStrength', 'immigrationPathwaySummary', 'visaSuccessBand', 'visaSuccessPercentage', 'visaInformation', 'visaProcessingTime', 'proofOfFundsSummary'],
      language: ['ieltsRequirement', 'ieltsMinScore', 'ieltsNotes', 'pteRequirement', 'pteMinScore', 'pteNotes', 'toeflRequirement', 'toeflMinScore', 'toeflNotes', 'duolingoRequirement', 'duolingoMinScore', 'duolingoNotes', 'languageWaiverAvailable', 'waiverNotes', 'generalNotes'],
      intakes: ['intakes'],
      statistics: ['universitiesCount', 'publicUniversitiesCount', 'privateUniversitiesCount', 'coursesCount', 'ugCoursesCount', 'pgCoursesCount', 'pgdmCoursesCount', 'mbaCoursesCount', 'phdCoursesCount', 'scholarshipsCount', 'citiesCount', 'topRankedUniversitiesCount', 'internationalStudentsCount', 'studentSatisfactionPercentage', 'sourceMode'],
    };
    return { method: 'PUT', path, query: [], body: [...common, ...(profileFields[profile ?? ''] ?? [])] };
  }
  const [resource, action, id] = operation.split(':');
  if (resource === 'continents') {
    if (action === 'list') return { method: 'GET', path: '/api/v1/admin/continents', query: ['q', 'status', 'sort', 'page', 'limit'], body: [] };
    if (action === 'create') return { method: 'POST', path: '/api/v1/admin/continents', query: [], body: ['name', 'slug', 'code', 'shortDescription', 'isFeatured', 'displayOrder', 'status'] };
    const safeId = encodeURIComponent(id ?? '');
    if (action === 'get') return { method: 'GET', path: `/api/v1/admin/continents/${safeId}`, query: [], body: [] };
    if (action === 'update') return { method: 'PATCH', path: `/api/v1/admin/continents/${safeId}`, query: [], body: ['name', 'slug', 'code', 'shortDescription', 'isFeatured', 'displayOrder', 'status', 'iconMediaId', 'heroMediaId', 'expectedUpdatedAt'] };
    return { method: 'DELETE', path: `/api/v1/admin/continents/${safeId}`, query: [], body: ['expectedUpdatedAt'] };
  }
  if (action === 'list') return { method: 'GET', path: '/api/v1/admin/countries', query: ['q', 'continentId', 'status', 'featured', 'sort', 'page', 'limit'], body: [] };
  if (action === 'create') return { method: 'POST', path: '/api/v1/admin/countries', query: [], body: ['continentId', 'name', 'slug', 'iso2Code', 'iso3Code', 'pageHeading', 'shortDescription', 'isFeatured', 'displayOrder', 'flagMediaId'] };
  const safeId = encodeURIComponent(id ?? '');
  if (action === 'get') return { method: 'GET', path: `/api/v1/admin/countries/${safeId}`, query: [], body: [] };
  if (action === 'update') return { method: 'PATCH', path: `/api/v1/admin/countries/${safeId}`, query: [], body: ['continentId', 'name', 'slug', 'iso2Code', 'iso3Code', 'pageHeading', 'shortDescription', 'isFeatured', 'displayOrder', 'flagMediaId', 'expectedUpdatedAt'] };
  if (action === 'publish') return { method: 'POST', path: `/api/v1/admin/countries/${safeId}/publish`, query: [], body: ['expectedUpdatedAt'] };
  if (action === 'unpublish') return { method: 'POST', path: `/api/v1/admin/countries/${safeId}/unpublish`, query: [], body: ['expectedUpdatedAt'] };
  return { method: 'DELETE', path: `/api/v1/admin/countries/${safeId}`, query: [], body: ['expectedUpdatedAt'] };
}

function safeBody(value: unknown, allowed: string[]): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in record) result[key] = record[key];
  }
  return JSON.stringify(result);
}

function safeDetails(code: string, details: unknown): unknown {
  if (code === 'COUNTRY_NOT_READY' || code === 'VALIDATION_ERROR') return details;
  return null;
}

function normalizeBody(value: unknown, requestId: string, status: number): SafeEnvelope {
  if (!value || typeof value !== 'object' || !('data' in value)) {
    return envelope(requestId, null, {
      code: 'CATALOG_SERVICE_UNAVAILABLE',
      message: 'Catalog service is temporarily unavailable',
      details: null,
    });
  }
  const candidate = value as { data?: unknown; meta?: unknown; error?: unknown; requestId?: unknown };
  const upstreamRequestId = typeof candidate.requestId === 'string' && candidate.requestId.length <= 100 ? candidate.requestId : requestId;
  if (status >= 400 || candidate.error) {
    const rawError = candidate.error && typeof candidate.error === 'object' ? candidate.error as { code?: unknown; details?: unknown } : {};
    const code = typeof rawError.code === 'string' && SAFE_ERROR_MESSAGES[rawError.code] ? rawError.code : 'CATALOG_REQUEST_FAILED';
    return envelope(upstreamRequestId, null, {
      code,
      message: SAFE_ERROR_MESSAGES[code] ?? 'Catalog request failed',
      details: safeDetails(code, rawError.details),
    });
  }
  return envelope(upstreamRequestId, candidate.data ?? null, null, candidate.meta ?? null);
}

export async function proxyCatalogRoute(request: NextRequest, operation: CatalogProxyOperation): Promise<NextResponse<SafeEnvelope>> {
  const requestId = requestIdFrom(request);
  const details = operationDetails(operation);
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ') || authorization.trim().length < 8) {
    return errorResponse(401, requestId, 'UNAUTHORIZED');
  }
  const headers = new Headers({ accept: 'application/json', authorization, 'x-request-id': requestId });
  let body: string | undefined;
  if (details.method !== 'GET') {
    const declaredLength = Number(request.headers.get('content-length') ?? 0);
    if (declaredLength > MAX_BODY_BYTES) return errorResponse(413, requestId, 'VALIDATION_ERROR');
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return errorResponse(413, requestId, 'VALIDATION_ERROR');
    let parsed: unknown = {};
    if (raw.trim()) {
      try { parsed = JSON.parse(raw); } catch { return errorResponse(400, requestId, 'VALIDATION_ERROR'); }
    }
    body = safeBody(parsed, details.body) ?? '{}';
    headers.set('content-type', 'application/json');
  }
  const upstreamUrl = new URL(details.path, process.env.API_BASE_URL ?? 'http://127.0.0.1:4000');
  const incomingUrl = new URL(request.url);
  for (const key of details.query) {
    const values = incomingUrl.searchParams.getAll(key);
    if (values.length > 1) return errorResponse(400, requestId, 'VALIDATION_ERROR');
    if (values[0] !== undefined) upstreamUrl.searchParams.set(key, values[0]);
  }
  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: details.method,
      headers,
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    return errorResponse(502, requestId, 'CATALOG_SERVICE_UNAVAILABLE');
  }
  let parsed: unknown;
  try { parsed = await upstream.json(); } catch { return errorResponse(502, requestId, 'CATALOG_SERVICE_UNAVAILABLE'); }
  const responseBody = normalizeBody(parsed, requestId, upstream.status);
  const response = NextResponse.json(responseBody, { status: upstream.status });
  response.headers.set('cache-control', 'no-store');
  response.headers.set('x-request-id', responseBody.requestId);
  return response;
}
