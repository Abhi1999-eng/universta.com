import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxyCatalogRoute } from './catalog-proxy';

function request(path: string, init: RequestInit = {}) { return new NextRequest(`http://localhost:3001${path}`, init); }
function upstream(status = 200, body: unknown = { data: [], meta: { page: 1, limit: 12, total: 0, totalPages: 0 }, error: null, requestId: 'catalog-upstream', timestamp: new Date().toISOString() }) { return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'x-request-id': 'catalog-upstream' } }); }

describe('same-origin catalog BFF', () => {
  beforeEach(() => { process.env.API_BASE_URL = 'http://127.0.0.1:4000'; vi.restoreAllMocks(); });

  it('forwards only allowlisted list query fields, bearer auth, request ID and no-store', async () => {
    const fetchMock = vi.fn().mockResolvedValue(upstream()); vi.stubGlobal('fetch', fetchMock);
    const response = await proxyCatalogRoute(request('/api/v1/admin/countries?q=canada&sort=name&bad=ignore', { headers: { authorization: 'Bearer access-token', 'x-request-id': 'catalog-1' } }), 'countries:list');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe('http://127.0.0.1:4000/api/v1/admin/countries?q=canada&sort=name');
    expect((init.headers as Headers).get('authorization')).toBe('Bearer access-token');
    expect((init.headers as Headers).get('x-request-id')).toBe('catalog-1');
  });

  it('strips unsupported body fields and rejects requests without bearer auth', async () => {
    const fetchMock = vi.fn().mockResolvedValue(upstream()); vi.stubGlobal('fetch', fetchMock);
    await proxyCatalogRoute(request('/api/v1/admin/continents', { method: 'POST', headers: { authorization: 'Bearer access-token', 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Europe', createdByUserId: 'secret', password: 'secret' }) }), 'continents:create');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;
    expect(body).toEqual({ name: 'Europe' });
    expect(JSON.stringify(body)).not.toContain('createdByUserId');
    const rejected = await proxyCatalogRoute(request('/api/v1/admin/continents'), 'continents:list');
    expect(rejected.status).toBe(401);
  });

  it('returns safe upstream failure and preserves publish readiness details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('mysql://secret')));
    const failed = await proxyCatalogRoute(request('/api/v1/admin/countries', { headers: { authorization: 'Bearer access-token' } }), 'countries:list');
    expect(failed.status).toBe(502);
    expect(JSON.stringify(await failed.json())).not.toContain('mysql');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream(422, { data: null, meta: null, error: { code: 'COUNTRY_NOT_READY', message: 'raw', details: [{ field: 'iso2Code', message: 'required' }] }, requestId: 'ready-1' })));
    const ready = await proxyCatalogRoute(request('/api/v1/admin/countries/id/publish', { method: 'POST', headers: { authorization: 'Bearer access-token', 'content-type': 'application/json' }, body: '{}' }), 'countries:publish:id');
    expect(ready.status).toBe(422);
    expect((await ready.json()).error.details).toEqual([{ field: 'iso2Code', message: 'required' }]);
  });

  it('rebuilds continent dependency details and drops everything else upstream sends', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream(409, { data: null, meta: null, error: { code: 'CONTINENT_IN_USE', message: 'raw', details: { countriesCount: 2.9, secret: 'mysql://secret', countries: [{ id: 'c1', name: 'Canada', slug: 'canada', status: 'PUBLISHED', internalNote: 'leak' }] } }, requestId: 'dep-1' })));
    const blocked = await proxyCatalogRoute(request('/api/v1/admin/continents/id', { method: 'DELETE', headers: { authorization: 'Bearer access-token', 'content-type': 'application/json' }, body: '{}' }), 'continents:delete:id');
    expect(blocked.status).toBe(409);
    const payload = (await blocked.json()) as { error: { message: string; details: unknown } };
    expect(payload.error.message).toBe('This continent still has countries assigned to it');
    expect(payload.error.details).toEqual({ countriesCount: 2, countries: [{ id: 'c1', name: 'Canada', slug: 'canada', status: 'PUBLISHED' }] });
    expect(JSON.stringify(payload)).not.toContain('mysql');
    expect(JSON.stringify(payload)).not.toContain('leak');
  });

  it('degrades a malformed dependency payload to null rather than rendering junk', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream(409, { data: null, meta: null, error: { code: 'CONTINENT_IN_USE', message: 'raw', details: 'not-an-object' }, requestId: 'dep-2' })));
    const blocked = await proxyCatalogRoute(request('/api/v1/admin/continents/id', { method: 'DELETE', headers: { authorization: 'Bearer access-token', 'content-type': 'application/json' }, body: '{}' }), 'continents:delete:id');
    expect(((await blocked.json()) as { error: { details: unknown } }).error.details).toBeNull();
  });
});
