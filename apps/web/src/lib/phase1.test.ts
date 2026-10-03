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

  /**
   * A catalogue of 9,761 universities rendered as "No university is
   * published yet".
   *
   * While the API capped its own listing at 500 rows it reported ten pages,
   * so this fired nine requests and nobody noticed they all went at once.
   * The moment the count became truthful -- 3,254 pages -- it fired
   * thirty-nine, the API shed fourteen of them with 503, one rejection
   * failed the whole call, and the page's catch turned that into an empty
   * catalogue.
   */
  it('never has more than five requests in flight', async () => {
    let inFlight = 0;
    let peak = 0;
    const inner = respond(2000);
    const fetch = vi.fn(async (input: URL | string) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 2));
      inFlight -= 1;
      return inner(input);
    });
    vi.stubGlobal('fetch', fetch);
    await phaseListAll('universities');
    expect(peak).toBeLessThanOrEqual(5);
  });

  it('retries a page the API shed under load', async () => {
    const inner = respond(120);
    let shed = false;
    const fetch = vi.fn(async (input: URL | string) => {
      if (!shed && new URL(String(input)).searchParams.get('page') === '2') {
        shed = true;
        return new Response('{}', { status: 503 });
      }
      return inner(input);
    });
    vi.stubGlobal('fetch', fetch);
    const { data } = await phaseListAll<{ slug: string }>('universities');
    // Nothing missing: the shed page came back on the second ask.
    expect(data).toHaveLength(120);
    expect(new Set(data.map((row) => row.slug)).size).toBe(120);
  });

  it('gives up if a page fails twice rather than returning a short list', async () => {
    const inner = respond(120);
    const fetch = vi.fn(async (input: URL | string) =>
      new URL(String(input)).searchParams.get('page') === '2'
        ? new Response('{}', { status: 503 })
        : inner(input),
    );
    vi.stubGlobal('fetch', fetch);
    /* Silently returning rows 1-50 and 101-120 would be worse than failing:
       the caller cannot tell a gap from a small catalogue. */
    await expect(phaseListAll('universities')).rejects.toThrow();
  });

  it('says how much of the catalogue it actually read', async () => {
    // 40 pages of 50 is the ceiling; a bigger catalogue is reported short.
    const fetch = respond(9761);
    vi.stubGlobal('fetch', fetch);
    const { data, truncated } = await phaseListAll('universities');
    expect(data).toHaveLength(2000);
    expect(truncated).toEqual({ shown: 2000, total: 9761 });
  });

  it('reports nothing truncated when it read everything', async () => {
    const fetch = respond(120);
    vi.stubGlobal('fetch', fetch);
    const { truncated } = await phaseListAll('universities');
    expect(truncated).toBeNull();
  });
});
