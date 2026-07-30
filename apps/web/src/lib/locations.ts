export interface LocationMedia { id: string; url: string; alt: string | null; }
export interface CityState { name: string; slug: string }
export interface CitySummary { id: string; name: string; slug: string; shortDescription: string | null; isFeatured: boolean; state: CityState | null; heroMedia: LocationMedia | null; }
export interface CityDetail extends CitySummary { overview: string | null; country: { id: string; name: string; slug: string }; }
export interface PaginationMeta { page: number; limit: number; total: number; totalPages: number; }
interface Envelope<T> { data: T | null; meta: unknown; error: { code: string; message: string } | null; }

const baseUrl = process.env.API_BASE_URL ?? 'http://127.0.0.1:4000';

async function request<T>(path: string): Promise<{ data: T; meta: unknown }> {
  const response = await fetch(new URL(`/api/v1/phase1${path}`, baseUrl), { cache: 'no-store', headers: { accept: 'application/json' } });
  const body = (await response.json()) as Envelope<T>;
  if (!response.ok || body.error || body.data === null) throw new Error(body.error?.message ?? 'Location service unavailable');
  return { data: body.data, meta: body.meta };
}

export function getCountryStates(countrySlug: string) {
  return request<CityState[]>(`/countries/${encodeURIComponent(countrySlug)}/states`).then((result) => result.data);
}

export async function getCountryCities(countrySlug: string, params: Record<string, string> = {}) {
  const query = new URLSearchParams(params).toString();
  const result = await request<CitySummary[]>(`/countries/${encodeURIComponent(countrySlug)}/cities${query ? `?${query}` : ''}`);
  return { data: result.data, meta: result.meta as PaginationMeta };
}

/** Every published city, across every published country. Backs the global
 * /cities index that makes city detail pages reachable from the header
 * without first having to choose a country. */
export async function getAllCities(params: Record<string, string> = {}) {
  const query = new URLSearchParams(params).toString();
  const result = await request<Array<CitySummary & { country: CityState }>>(`/cities${query ? `?${query}` : ''}`);
  return { data: result.data, meta: result.meta as PaginationMeta };
}

export function getCityDetail(countrySlug: string, citySlug: string) {
  return request<CityDetail>(`/countries/${encodeURIComponent(countrySlug)}/cities/${encodeURIComponent(citySlug)}`).then((result) => result.data);
}
