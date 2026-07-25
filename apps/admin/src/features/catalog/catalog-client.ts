import { authFetch } from '@/features/auth/auth-client';
import type {
  CatalogEnvelope,
  CatalogListParams,
  CatalogMutationError,
  ContinentRecord,
  CountryRecord,
  CountryProfileBundle,
  IntakeOption,
  DirectoryRecord,
  PageMeta,
  SuggestionRecord,
} from './catalog.types';

function query(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if ((typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') && value !== '') search.set(key, String(value));
  }
  const result = search.toString();
  return result ? `?${result}` : '';
}

function errorFrom<T>(response: Response, body: CatalogEnvelope<T>): CatalogMutationError {
  const error = new Error(body.error?.message ?? 'Catalog request failed') as CatalogMutationError;
  error.name = 'CatalogMutationError';
  error.code = body.error?.code ?? 'CATALOG_REQUEST_FAILED';
  error.status = response.status;
  error.details = body.error?.details ?? null;
  return error;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<{ data: T; meta: PageMeta | null }> {
  const response = await authFetch(path, {
    ...init,
    headers: { ...(init.headers ?? {}), ...(init.body ? { 'content-type': 'application/json' } : {}) },
  });
  let body: CatalogEnvelope<T>;
  try {
    body = (await response.json()) as CatalogEnvelope<T>;
  } catch {
    throw Object.assign(new Error('Catalog service is temporarily unavailable'), { code: 'CATALOG_SERVICE_UNAVAILABLE', status: response.status, details: null });
  }
  if (!response.ok || body.error || body.data === null) throw errorFrom(response, body);
  return { data: body.data, meta: body.meta };
}

export function listContinents(params: CatalogListParams = {}, signal?: AbortSignal) {
  return request<ContinentRecord[]>(`/api/v1/admin/continents${query(params)}`, { signal });
}

export function createContinent(data: Record<string, unknown>) {
  return request<ContinentRecord>('/api/v1/admin/continents', { method: 'POST', body: JSON.stringify(data) });
}

export function updateContinent(id: string, data: Record<string, unknown>) {
  return request<ContinentRecord>(`/api/v1/admin/continents/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export function deleteContinent(id: string, expectedUpdatedAt?: string) {
  return request<{ deleted: true }>(`/api/v1/admin/continents/${id}`, { method: 'DELETE', body: JSON.stringify({ expectedUpdatedAt }) });
}

export function getContinent(id: string) {
  return request<ContinentRecord>(`/api/v1/admin/continents/${id}`);
}

export function listCountries(params: CatalogListParams = {}, signal?: AbortSignal) {
  return request<CountryRecord[]>(`/api/v1/admin/countries${query(params)}`, { signal });
}

export function getCountry(id: string) {
  return request<CountryRecord>(`/api/v1/admin/countries/${id}`);
}

export function createCountry(data: Record<string, unknown>) {
  return request<CountryRecord>('/api/v1/admin/countries', { method: 'POST', body: JSON.stringify(data) });
}

export function updateCountry(id: string, data: Record<string, unknown>) {
  return request<CountryRecord>(`/api/v1/admin/countries/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export function publishCountry(id: string, expectedUpdatedAt?: string) {
  return request<CountryRecord>(`/api/v1/admin/countries/${id}/publish`, { method: 'POST', body: JSON.stringify({ expectedUpdatedAt }) });
}

export function unpublishCountry(id: string, expectedUpdatedAt?: string) {
  return request<CountryRecord>(`/api/v1/admin/countries/${id}/unpublish`, { method: 'POST', body: JSON.stringify({ expectedUpdatedAt }) });
}

export function deleteCountry(id: string, expectedUpdatedAt?: string) {
  return request<{ deleted: true }>(`/api/v1/admin/countries/${id}`, { method: 'DELETE', body: JSON.stringify({ expectedUpdatedAt }) });
}

export function getCountryProfiles(id: string) {
  return request<CountryProfileBundle>(`/api/v1/admin/countries/${id}/profiles`);
}

export function listIntakeOptions() {
  return request<IntakeOption[]>('/api/v1/admin/intakes');
}

export function putCountryProfile(id: string, profile: 'cost' | 'work' | 'language' | 'intakes' | 'statistics', data: Record<string, unknown>) {
  return request<Record<string, unknown> | { intakes: Array<Record<string, unknown>> }>(`/api/v1/admin/countries/${id}/profiles/${profile}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function deleteCountryProfile(id: string, profile: 'cost' | 'work' | 'language' | 'statistics', expectedUpdatedAt?: string) {
  return request<{ deleted: boolean }>(`/api/v1/admin/countries/${id}/profiles/${profile}`, { method: 'DELETE', body: JSON.stringify({ expectedUpdatedAt }) });
}

export function getPublicCountry(slug: string) {
  return request<CountryRecord>(`/api/v1/countries/${encodeURIComponent(slug)}`);
}

export function getDirectory(params: { letter?: string; page?: number; limit?: number } = {}) {
  return request<DirectoryRecord[]>(`/api/v1/countries/directory${query(params)}`);
}

export function getSuggestions(q: string, limit = 5) {
  return request<SuggestionRecord[]>(`/api/v1/countries/suggestions${query({ q, limit })}`);
}
