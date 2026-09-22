import { afterEach, describe, expect, it, vi } from 'vitest';
import { phaseListAll } from './phase1';

/** The phase-1 list endpoints cap a page at 50 rows. Callers that wanted every
 * university asked for 100 and got fifty, so the A-Z index, the per-country
 * counts and the sitemap all stopped short once the catalogue grew. */

function respond(total: number) {
  return vi.fn(async (input: URL | string) => {
    const url = new URL(String(input));
    const limit = Number(url.searchParams.get('limit'));
    const page = Number(url.searchParams.get('page') ?? '1');
    const size = Math.min(limit, 50);
    const start = (page - 1) * size;
    const rows = Array.from(
      { length: Math.max(0, Math.min(size, total - start)) },
      (_, index) => ({ slug: `u-${start + index + 1}` }),
    );
    return new Response(
      JSON.stringify({
        data: rows,
        meta: { page, limit: size, total, totalPages: Math.ceil(total / size) },
        error: null,
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('phaseListAll', () => {
  it('reads past the 50-row page cap', async () => {
    const fetch = respond(101);
    vi.stubGlobal('fetch', fetch);
    const { data } = await phaseListAll<{ slug: string }>('universities');
    expect(data).toHaveLength(101);
    expect(new Set(data.map((row) => row.slug)).size).toBe(101);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('keeps the caller’s filters on every page', async () => {
    const fetch = respond(60);
    vi.stubGlobal('fetch', fetch);
    await phaseListAll('universities', { country: 'italy' });
    for (const [input] of fetch.mock.calls)
      expect(new URL(String(input)).searchParams.get('country')).toBe('italy');
  });

  it('makes one request when everything fits on a page', async () => {
    const fetch = respond(12);
    vi.stubGlobal('fetch', fetch);
    const { data } = await phaseListAll('scholarships');
    expect(data).toHaveLength(12);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
