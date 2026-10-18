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

  /* The country body allowlist is the one place an editor's field can vanish
     without an error: anything missing from it is dropped here and the save
     still reports success. The budget calculator was added to the editor and
     to the API before it was added here, and silently saved nothing. */
  it('forwards every field the country editor can write, including the calculator', async () => {
    const fetchMock = vi.fn().mockResolvedValue(upstream()); vi.stubGlobal('fetch', fetchMock);
    const calculatorConfig = { base: { livingMin: 900, livingMax: 1100, insurance: 100, semesterFee: 200 }, factors: [{ id: 'city', label: 'City', options: [{ value: 'small', label: 'Small', mult: 1 }] }] };
    await proxyCatalogRoute(request('/api/v1/admin/countries/id', { method: 'PATCH', headers: { authorization: 'Bearer access-token', 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Canada', intakeMonths: [1, 9], calculatorConfig, expectedUpdatedAt: '2026-01-01T00:00:00.000Z', createdByUserId: 'secret' }) }), 'countries:update:id');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;
    expect(body.calculatorConfig).toEqual(calculatorConfig);
    expect(body.intakeMonths).toEqual([1, 9]);
    expect(body).not.toHaveProperty('createdByUserId');
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

  /* The banner used to read "Catalog request failed" for every failure the
     allow-list did not know -- the operator was told nothing, not even which
     failure it was. The wording still comes from here rather than from
     upstream, but it now names the answer or carries the code. */
  it('names an operational failure, and carries an unknown code rather than swallowing it', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('mysql://secret')));
    const unreachable = await proxyCatalogRoute(request('/api/v1/admin/countries', { headers: { authorization: 'Bearer access-token' } }), 'countries:list');
    expect((await unreachable.json()).error.message).toContain('did not answer in time');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream(503, { data: null, meta: null, error: { code: 'DATABASE_UNAVAILABLE', message: 'mysql://secret', details: null }, requestId: 'db-1' })));
    const database = await proxyCatalogRoute(request('/api/v1/admin/countries', { method: 'POST', headers: { authorization: 'Bearer access-token', 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Luxembourg' }) }), 'countries:create');
    const databaseBody = await database.json();
    expect(databaseBody.error.message).toContain('could not be reached');
    expect(JSON.stringify(databaseBody)).not.toContain('mysql');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream(422, { data: null, meta: null, error: { code: 'COUNTRY_SOMETHING_NEW', message: 'mysql://secret', details: { secret: 1 } }, requestId: 'new-1' })));
    const unknown = await proxyCatalogRoute(request('/api/v1/admin/countries', { method: 'POST', headers: { authorization: 'Bearer access-token', 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Luxembourg' }) }), 'countries:create');
    const unknownBody = await unknown.json();
    expect(unknownBody.error.code).toBe('COUNTRY_SOMETHING_NEW');
    expect(unknownBody.error.message).toBe('Catalog request failed (COUNTRY_SOMETHING_NEW)');
    // Upstream wording and details still stop here.
    expect(JSON.stringify(unknownBody)).not.toContain('mysql');
    expect(unknownBody.error.details).toBeNull();

    // A code that is not one is not printed back either.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream(500, { data: null, meta: null, error: { code: '<img src=x>', message: 'raw', details: null }, requestId: 'bad-1' })));
    const malformed = await proxyCatalogRoute(request('/api/v1/admin/countries', { headers: { authorization: 'Bearer access-token' } }), 'countries:list');
    expect((await malformed.json()).error.code).toBe('CATALOG_REQUEST_FAILED');
  });

  /* A level switched off since the editor opened is ignored on save; only one
     deleted outright is still refused, and the editor is told what to do. */
  it('says what to do when a ticked study level no longer exists', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream(409, { data: null, meta: null, error: { code: 'COURSE_LEVEL_INVALID', message: 'raw', details: null }, requestId: 'level-1' })));
    const refused = await proxyCatalogRoute(request('/api/v1/admin/subjects/subject-1', { method: 'PATCH', headers: { authorization: 'Bearer access-token', 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Marine Sciences', courseLevelIds: ['gone'] }) }), 'subjects:update:subject-1');
    expect(refused.status).toBe(409);
    expect((await refused.json()).error.message).toBe('A ticked study level no longer exists. Reload the page and tick the study levels again');
  });

  /* A level page is one record saved in one PUT: its text, status, the whole
     FAQ list and its SEO. The branch for it sits before the generic
     `subjects:` one, which would otherwise read "level-pages" as an action. */
  describe('level pages', () => {
    const auth = { authorization: 'Bearer access-token', 'content-type': 'application/json' };
    async function sent(operation: Parameters<typeof proxyCatalogRoute>[1], init: RequestInit = { headers: auth }) {
      const fetchMock = vi.fn().mockResolvedValue(upstream(200, { data: {}, meta: null, error: null, requestId: 'lp-1' }));
      vi.stubGlobal('fetch', fetchMock);
      await proxyCatalogRoute(request('/api/v1/admin/level-pages', init), operation);
      const [url, upstreamInit] = fetchMock.mock.calls[0] as [URL, RequestInit];
      return { url: url.toString(), method: upstreamInit.method, body: upstreamInit.body ? JSON.parse(upstreamInit.body as string) as Record<string, unknown> : undefined };
    }

    it('maps each of the eight operations to its path and method', async () => {
      expect(await sent('subjects:level-pages:list:s1')).toEqual({ url: 'http://127.0.0.1:4000/api/v1/admin/subjects/s1/level-pages', method: 'GET', body: undefined });
      expect(await sent('subjects:level-pages:get:s1:lvl1')).toEqual({ url: 'http://127.0.0.1:4000/api/v1/admin/subjects/s1/level-pages/lvl1', method: 'GET', body: undefined });
      expect((await sent('subjects:level-pages:put:s1:lvl1', { method: 'PUT', headers: auth, body: '{}' })).method).toBe('PUT');
      expect((await sent('subjects:level-pages:delete:s1:lvl1', { method: 'DELETE', headers: auth, body: '{}' })).method).toBe('DELETE');
      expect(await sent('specializations:level-pages:list:sp1')).toEqual({ url: 'http://127.0.0.1:4000/api/v1/admin/specializations/sp1/level-pages', method: 'GET', body: undefined });
      expect(await sent('specializations:level-pages:get:sp1:lvl1')).toEqual({ url: 'http://127.0.0.1:4000/api/v1/admin/specializations/sp1/level-pages/lvl1', method: 'GET', body: undefined });
      const put = await sent('specializations:level-pages:put:sp1:lvl1', { method: 'PUT', headers: auth, body: '{}' });
      expect([put.url, put.method]).toEqual(['http://127.0.0.1:4000/api/v1/admin/specializations/sp1/level-pages/lvl1', 'PUT']);
      const removed = await sent('specializations:level-pages:delete:sp1:lvl1', { method: 'DELETE', headers: auth, body: JSON.stringify({ expectedUpdatedAt: 'v1', createdByUserId: 'secret' }) });
      expect(removed).toEqual({ url: 'http://127.0.0.1:4000/api/v1/admin/specializations/sp1/level-pages/lvl1', method: 'DELETE', body: { expectedUpdatedAt: 'v1' } });
    });

    it('forwards the nested FAQs and SEO whole, and strips unknown top-level keys', async () => {
      const faqs = [{ question: 'Is it taught in English?', answer: '<p>Mostly.</p>', status: 'ACTIVE', displayOrder: 0 }];
      const seo = { seoTitle: "Master's in Computing", metaDescription: 'Study it.', robotsIndex: true, robotsFollow: true };
      const { body } = await sent('subjects:level-pages:put:s1:lvl1', {
        method: 'PUT',
        headers: auth,
        body: JSON.stringify({ intro: '<p>Hi</p>', admissionNote: '', careersNote: '', status: 'PUBLISHED', faqs, seo, expectedUpdatedAt: null, subjectId: 'other', createdByUserId: 'secret' }),
      });
      expect(body).toEqual({ intro: '<p>Hi</p>', admissionNote: '', careersNote: '', status: 'PUBLISHED', faqs, seo, expectedUpdatedAt: null });
    });

    it('encodes the ids it puts in the path', async () => {
      expect((await sent('subjects:level-pages:get:a/b:c?d')).url).toBe('http://127.0.0.1:4000/api/v1/admin/subjects/a%2Fb/level-pages/c%3Fd');
    });

    /* A read of one level or mode used to fall through to DELETE, which
       would have removed an unused level with its ticks and level pages. */
    it('reads one study level or study mode with a GET', async () => {
      expect(await sent('course-levels:get:l1')).toEqual({ url: 'http://127.0.0.1:4000/api/v1/admin/course-levels/l1', method: 'GET', body: undefined });
      expect(await sent('study-modes:get:m1')).toEqual({ url: 'http://127.0.0.1:4000/api/v1/admin/study-modes/m1', method: 'GET', body: undefined });
      const update = await sent('course-levels:update:l1', { method: 'PATCH', headers: auth, body: JSON.stringify({ name: 'Masters', expectedUpdatedAt: 'v1', slug: 'x' }) });
      expect(update).toEqual({ url: 'http://127.0.0.1:4000/api/v1/admin/course-levels/l1', method: 'PATCH', body: { name: 'Masters', expectedUpdatedAt: 'v1' } });
    });

    it('leaves the neighbouring subject operations where they were', async () => {
      expect((await sent('subjects:get:s1')).url).toBe('http://127.0.0.1:4000/api/v1/admin/subjects/s1');
      expect((await sent('subjects:countries:get:s1')).url).toBe('http://127.0.0.1:4000/api/v1/admin/subjects/s1/countries');
      const seo = await sent('subjects-seo:put:s1', { method: 'PUT', headers: auth, body: JSON.stringify({ seoTitle: 'T', metaDescription: 'D', faqs: [] }) });
      expect(seo).toEqual({ url: 'http://127.0.0.1:4000/api/v1/admin/subjects/s1/seo', method: 'PUT', body: { seoTitle: 'T', metaDescription: 'D' } });
    });

    it('says what went wrong in the operator\u2019s words, and keeps the readiness list', async () => {
      const answer = async (code: string, details: unknown = null, status = 409) => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream(status, { data: null, meta: null, error: { code, message: 'raw', details }, requestId: 'lp-2' })));
        const response = await proxyCatalogRoute(request('/api/v1/admin/subjects/s1/level-pages/l1', { method: 'PUT', headers: auth, body: '{}' }), 'subjects:level-pages:put:s1:l1');
        return ((await response.json()) as { error: { message: string; details: unknown } }).error;
      };
      expect((await answer('LEVEL_PAGE_STALE_VERSION')).message).toBe('This level page changed in another session. Reload before saving');
      expect((await answer('LEVEL_PAGE_LEVEL_NOT_OFFERED')).message).toBe('This study level is not offered here any more, so its page cannot be saved. Tick the level and save the subject or specialization first');
      expect((await answer('LEVEL_PAGE_INVALID', { index: 2 }, 400)).message).toBe('Each question needs a question and an answer');
      expect((await answer('SEO_URL_INVALID')).message).toBe('Canonical URL must be a site path beginning with / or an http(s) URL');
      expect((await answer('COURSE_LEVEL_SLUG_TAKEN')).message).toBe("A specialization already uses this level's address. Rename that specialization first");
      expect((await answer('SUBJECT_SLUG_RESERVED')).message).toBe('That slug is a fixed page address on the site. Choose another slug');
      expect((await answer('COURSE_LEVEL_CODE_LOCKED', { code: 'PG' }, 400)).message).toBe("A study level's code can't be changed after it is created. Change the name instead");
      const notReady = await answer('LEVEL_PAGE_NOT_READY', [{ field: 'intro', message: 'Write an intro, a note or an FAQ' }], 422);
      expect(notReady.message).toBe('Write an intro, a note or an FAQ before publishing this level page');
      expect(notReady.details).toEqual([{ field: 'intro', message: 'Write an intro, a note or an FAQ' }]);
    });
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

  /* A subject's delete refused for its courses carries two counts, so the
     admin can say whether live courses or deleted ones are in the way. */
  it('passes the course counts of a refused subject delete, and nothing else', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream(409, { data: null, meta: null, error: { code: 'SUBJECT_IN_USE', message: 'raw', details: { liveCourses: 1.7, deletedCourses: 3, courses: [{ name: 'leak' }] } }, requestId: 'use-1' })));
    const blocked = await proxyCatalogRoute(request('/api/v1/admin/subjects/id', { method: 'DELETE', headers: { authorization: 'Bearer access-token', 'content-type': 'application/json' }, body: '{}' }), 'subjects:delete:id');
    expect(blocked.status).toBe(409);
    const payload = (await blocked.json()) as { error: { message: string; details: unknown } };
    expect(payload.error.message).toBe('A subject referenced by courses cannot be deleted');
    expect(payload.error.details).toEqual({ liveCourses: 1, deletedCourses: 3 });
    expect(JSON.stringify(payload)).not.toContain('leak');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream(409, { data: null, meta: null, error: { code: 'SUBJECT_IN_USE', message: 'raw', details: { liveCourses: 'two' } }, requestId: 'use-2' })));
    const malformed = await proxyCatalogRoute(request('/api/v1/admin/subjects/id', { method: 'DELETE', headers: { authorization: 'Bearer access-token', 'content-type': 'application/json' }, body: '{}' }), 'subjects:delete:id');
    expect(((await malformed.json()) as { error: { details: unknown } }).error.details).toBeNull();
  });

  /* Over 64 KB is refused here, before the API. It used to answer as
     VALIDATION_ERROR -- "Invalid catalog request" -- which said nothing about
     size; the API's own 413 shares the same wording. */
  it('says a body over 64 KB is too large, by its length or its declared length', async () => {
    const fetchMock = vi.fn().mockResolvedValue(upstream()); vi.stubGlobal('fetch', fetchMock);
    const huge = JSON.stringify({ name: 'Computing', overview: 'x'.repeat(70 * 1024) });
    const tooLarge = await proxyCatalogRoute(request('/api/v1/admin/subjects/id', { method: 'PATCH', headers: { authorization: 'Bearer access-token', 'content-type': 'application/json' }, body: huge }), 'subjects:update:id');
    expect(tooLarge.status).toBe(413);
    const payload = (await tooLarge.json()) as { error: { code: string; message: string } };
    expect(payload.error).toMatchObject({ code: 'REQUEST_TOO_LARGE', message: 'This page is too large to save in one go. Shorten the longest text or split it.' });
    const declared = await proxyCatalogRoute(request('/api/v1/admin/subjects/id', { method: 'PATCH', headers: { authorization: 'Bearer access-token', 'content-type': 'application/json', 'content-length': String(65 * 1024) }, body: '{}' }), 'subjects:update:id');
    expect(declared.status).toBe(413);
    expect(((await declared.json()) as { error: { code: string } }).error.code).toBe('REQUEST_TOO_LARGE');
    expect(fetchMock).not.toHaveBeenCalled();

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream(413, { data: null, meta: null, error: { code: 'REQUEST_TOO_LARGE', message: 'raw', details: null }, requestId: 'big-1' })));
    const upstreamTooLarge = await proxyCatalogRoute(request('/api/v1/admin/subjects/id', { method: 'PATCH', headers: { authorization: 'Bearer access-token', 'content-type': 'application/json' }, body: '{}' }), 'subjects:update:id');
    expect(((await upstreamTooLarge.json()) as { error: { message: string } }).error.message).toBe('This page is too large to save in one go. Shorten the longest text or split it.');
  });

  /* The SEO of a subject, a specialization and a course saves against the
     version its editor read: the row's updatedAt, or null for "there was
     none". Both must reach the API, and a refusal must say what happened. */
  it('forwards the SEO version, null included, and names a stale one', async () => {
    for (const [operation, path] of [['subjects-seo:put:id', '/api/v1/admin/subjects/id/seo'], ['specializations-seo:put:id', '/api/v1/admin/specializations/id/seo'], ['courses-seo:put:id', '/api/v1/admin/courses/id/seo']] as const) {
      const fetchMock = vi.fn().mockResolvedValue(upstream(200, { data: { id: 'seo-1' }, meta: null, error: null, requestId: 'seo' })); vi.stubGlobal('fetch', fetchMock);
      await proxyCatalogRoute(request(path, { method: 'PUT', headers: { authorization: 'Bearer access-token', 'content-type': 'application/json' }, body: JSON.stringify({ robotsIndex: false, robotsFollow: true, expectedUpdatedAt: null }) }), operation);
      const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
      expect(url.pathname).toBe(path);
      /* Robots alone, with no title or description, travels as it is. */
      expect(JSON.parse(init.body as string)).toEqual({ robotsIndex: false, robotsFollow: true, expectedUpdatedAt: null });
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream(409, { data: null, meta: null, error: { code: 'SEO_STALE_VERSION', message: 'raw', details: null }, requestId: 'seo-stale' })));
    const stale = await proxyCatalogRoute(request('/api/v1/admin/subjects/id/seo', { method: 'PUT', headers: { authorization: 'Bearer access-token', 'content-type': 'application/json' }, body: JSON.stringify({ seoTitle: 'T', metaDescription: 'D', expectedUpdatedAt: '2026-10-17T10:00:00.000Z' }) }), 'subjects-seo:put:id');
    expect(stale.status).toBe(409);
    expect(((await stale.json()) as { error: { code: string; message: string } }).error).toMatchObject({ code: 'SEO_STALE_VERSION', message: 'The SEO changed in another session. Reload before saving' });
  });
});
