import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxyCatalogRoute } from './catalog-proxy';

describe('structured profile BFF allowlist', () => {
  beforeEach(() => { process.env.API_BASE_URL = 'http://127.0.0.1:4000'; vi.restoreAllMocks(); });

  it('forwards profile writes only to the exact profile endpoint', async () => {
    const upstream = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { updatedAt: 'now' }, meta: null, error: null, requestId: 'r', timestamp: new Date().toISOString() }), { status: 200 }));
    vi.stubGlobal('fetch', upstream);
    const request = new NextRequest('http://localhost:3001/api/v1/admin/countries/country-1/profiles/cost', { method: 'PUT', headers: { authorization: 'Bearer access-token', 'content-type': 'application/json' }, body: JSON.stringify({ currencyCode: 'CAD', password: 'do-not-forward' }) });
    expect((await proxyCatalogRoute(request, 'country-profiles:put:country-1:cost')).status).toBe(200);
    const [url, init] = upstream.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe('http://127.0.0.1:4000/api/v1/admin/countries/country-1/profiles/cost');
    expect(JSON.parse(init.body as string)).toEqual({ currencyCode: 'CAD' });
  });
});
