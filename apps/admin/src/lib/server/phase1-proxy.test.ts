import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxyPhase1Admin } from './phase1-proxy';

/** ISS-020. The API side of ISS-019's navigation-items fix (PR #43) worked
 * from day one -- 191 API tests and a dedicated 29-case spec proved the
 * NestJS routes and validation directly. But nothing in the admin ever
 * reached those routes: every request to `/navigation-menus/:id/items*` 404'd
 * inside this proxy before it ever left the admin server, because "items"
 * fell into the generic action allow-list (publish/unpublish/convert) and any
 * 4-segment path was rejected outright -- exactly the shape PATCH/DELETE
 * .../items/:itemId and POST .../items/reorder need.
 *
 * Verified against production before this fix: the deployed ISS-019 UI called
 * these paths and got 404 from *this* origin, while the API's own routes
 * answered correctly when called directly.
 *
 * These pin every shape the navigation item editor sends, the same way
 * pageSectionShapeIsValid already pins the sibling pages/:id/sections shapes
 * this proxy has supported since before ISS-019. */

function request(path: string, init: RequestInit = {}) {
  return new NextRequest(`http://localhost:3001${path}`, init);
}
function upstream(status = 200, body: unknown = { data: [], meta: null, error: null, requestId: 'nav-upstream', timestamp: new Date().toISOString() }) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'x-request-id': 'nav-upstream' },
  });
}
const AUTH = { authorization: 'Bearer access-token' };

async function proxy(path: string, segments: string[], init: RequestInit = {}) {
  return proxyPhase1Admin(request(path, { headers: AUTH, ...init }), segments);
}

describe('navigation-items shapes through the phase1 admin proxy', () => {
  beforeEach(() => {
    process.env.API_BASE_URL = 'http://127.0.0.1:4000';
    vi.restoreAllMocks();
  });

  it('forwards GET .../items to the API rather than answering 404 itself', async () => {
    const fetchMock = vi.fn().mockResolvedValue(upstream());
    vi.stubGlobal('fetch', fetchMock);
    const response = await proxy(
      '/api/v1/admin/phase1/navigation-menus/menu-1/items',
      ['navigation-menus', 'menu-1', 'items'],
    );
    expect(response.status).toBe(200);
    const [url] = fetchMock.mock.calls[0] as [URL];
    expect(url.pathname).toBe('/api/v1/admin/phase1/navigation-menus/menu-1/items');
  });

  it('forwards POST .../items (create) to the API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(upstream(201, { data: { id: 'item-1' }, meta: null, error: null, requestId: 'r' }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await proxy(
      '/api/v1/admin/phase1/navigation-menus/menu-1/items',
      ['navigation-menus', 'menu-1', 'items'],
      { method: 'POST', headers: { ...AUTH, 'content-type': 'application/json' }, body: JSON.stringify({ label: 'Contact', linkType: 'CUSTOM', customUrl: '/contact' }) },
    );
    expect(response.status).toBe(201);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('forwards PATCH .../items/:itemId (edit) -- the 4-segment shape that previously 404\'d', async () => {
    const fetchMock = vi.fn().mockResolvedValue(upstream(200, { data: { id: 'item-1' }, meta: null, error: null, requestId: 'r' }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await proxy(
      '/api/v1/admin/phase1/navigation-menus/menu-1/items/item-1',
      ['navigation-menus', 'menu-1', 'items', 'item-1'],
      { method: 'PATCH', headers: { ...AUTH, 'content-type': 'application/json' }, body: JSON.stringify({ label: 'Renamed' }) },
    );
    expect(response.status).toBe(200);
    const [url] = fetchMock.mock.calls[0] as [URL];
    expect(url.pathname).toBe('/api/v1/admin/phase1/navigation-menus/menu-1/items/item-1');
  });

  it('forwards DELETE .../items/:itemId (remove)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(upstream(200, { data: { deleted: true }, meta: null, error: null, requestId: 'r' }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await proxy(
      '/api/v1/admin/phase1/navigation-menus/menu-1/items/item-1',
      ['navigation-menus', 'menu-1', 'items', 'item-1'],
      { method: 'DELETE' },
    );
    expect(response.status).toBe(200);
  });

  it('forwards POST .../items/reorder -- the other 4-segment shape', async () => {
    const fetchMock = vi.fn().mockResolvedValue(upstream(200, { data: [], meta: null, error: null, requestId: 'r' }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await proxy(
      '/api/v1/admin/phase1/navigation-menus/menu-1/items/reorder',
      ['navigation-menus', 'menu-1', 'items', 'reorder'],
      { method: 'POST', headers: { ...AUTH, 'content-type': 'application/json' }, body: JSON.stringify({ parentItemId: null, orderedIds: ['item-1', 'item-2'] }) },
    );
    expect(response.status).toBe(200);
    const [url] = fetchMock.mock.calls[0] as [URL];
    expect(url.pathname).toBe('/api/v1/admin/phase1/navigation-menus/menu-1/items/reorder');
  });

  it('still rejects a 4-segment path under navigation-menus that is not the items sub-resource', async () => {
    const fetchMock = vi.fn().mockResolvedValue(upstream());
    vi.stubGlobal('fetch', fetchMock);
    const response = await proxy(
      '/api/v1/admin/phase1/navigation-menus/menu-1/something/else',
      ['navigation-menus', 'menu-1', 'something', 'else'],
    );
    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('still rejects an items path with a 5th segment', async () => {
    const fetchMock = vi.fn().mockResolvedValue(upstream());
    vi.stubGlobal('fetch', fetchMock);
    const response = await proxy(
      '/api/v1/admin/phase1/navigation-menus/menu-1/items/item-1/extra',
      ['navigation-menus', 'menu-1', 'items', 'item-1', 'extra'],
    );
    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('menu-level publish/unpublish -- the path that already worked -- is unaffected', async () => {
    const fetchMock = vi.fn().mockResolvedValue(upstream(200, { data: { status: 'ACTIVE' }, meta: null, error: null, requestId: 'r' }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await proxy(
      '/api/v1/admin/phase1/navigation-menus/menu-1/publish',
      ['navigation-menus', 'menu-1', 'publish'],
      { method: 'POST' },
    );
    expect(response.status).toBe(200);
  });

  it('still requires bearer auth for the items sub-resource', async () => {
    const fetchMock = vi.fn().mockResolvedValue(upstream());
    vi.stubGlobal('fetch', fetchMock);
    const response = await proxyPhase1Admin(
      request('/api/v1/admin/phase1/navigation-menus/menu-1/items'),
      ['navigation-menus', 'menu-1', 'items'],
    );
    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('the sibling pages/:id/sections/reorder shape remains valid alongside the new navigation-items shapes', async () => {
    // A single mocked Response can only have its body read once, so each call
    // through the proxy gets its own -- reusing one across two proxy() calls
    // in the same test is what silently turned a real 200 into a 502 here.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream(200, { data: [], meta: null, error: null, requestId: 'r' })));
    const reorder = await proxy(
      '/api/v1/admin/phase1/pages/page-1/sections/reorder',
      ['pages', 'page-1', 'sections', 'reorder'],
      { method: 'POST', headers: { ...AUTH, 'content-type': 'application/json' }, body: JSON.stringify({ orderedIds: [] }) },
    );
    expect(reorder.status).toBe(200);
  });

  it('the sibling pages/:id/sections/:sectionId/duplicate shape remains valid too', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream(200, { data: {}, meta: null, error: null, requestId: 'r' })));
    const duplicate = await proxy(
      '/api/v1/admin/phase1/pages/page-1/sections/section-1/duplicate',
      ['pages', 'page-1', 'sections', 'section-1', 'duplicate'],
      { method: 'POST' },
    );
    expect(duplicate.status).toBe(200);
  });
});
