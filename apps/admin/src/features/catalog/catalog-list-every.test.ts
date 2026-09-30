import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CATALOG_MAX_LIMIT,
  listCountries,
  listEvery,
} from './catalog-client';

/**
 * A picker has to offer every row. The catalogue's list endpoints cap a page
 * at 100, so the course editor, its editorial workspace and the course
 * list's country filter -- all of which asked for `limit: 100` and used
 * whatever came back -- offered the first hundred countries in sort order
 * and nothing after. With 206 destinations published that hid everything
 * from Latvia onwards, and an editor had no way to map a course to one.
 */

vi.mock('@/features/auth/auth-client', () => ({
  authFetch: (input: RequestInfo | URL, init?: RequestInit) =>
    fetchMock(input, init),
}));

const fetchMock = vi.fn();

function page(data: unknown[], meta: { page: number; totalPages: number }) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      data,
      meta: { ...meta, limit: CATALOG_MAX_LIMIT, total: 206 },
      error: null,
      requestId: 'test',
      timestamp: '',
    }),
  } as unknown as Response;
}

const urls = () => fetchMock.mock.calls.map((call) => String(call[0]));

beforeEach(() => {
  fetchMock.mockReset();
});

describe('listEvery', () => {
  it('follows every page the list says it has', async () => {
    const rows = (from: number, to: number) =>
      Array.from({ length: to - from + 1 }, (_, i) => ({ id: `c${from + i}` }));
    fetchMock
      .mockResolvedValueOnce(page(rows(1, 100), { page: 1, totalPages: 3 }))
      .mockResolvedValueOnce(page(rows(101, 200), { page: 2, totalPages: 3 }))
      .mockResolvedValueOnce(page(rows(201, 206), { page: 3, totalPages: 3 }));

    const all = await listEvery(listCountries, { status: 'PUBLISHED' });

    expect(all).toHaveLength(206);
    expect(all.at(-1)).toEqual({ id: 'c206' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(urls()[0]).toContain('page=1');
    expect(urls()[1]).toContain('page=2');
    expect(urls()[2]).toContain('page=3');
    // And it never asks for a page larger than the API will serve.
    for (const url of urls())
      expect(url).toContain(`limit=${CATALOG_MAX_LIMIT}`);
  });

  it('keeps the caller’s own filters on every page', async () => {
    fetchMock.mockResolvedValue(page([], { page: 1, totalPages: 2 }));
    await listEvery(listCountries, { status: 'PUBLISHED' });
    for (const url of urls()) expect(url).toContain('status=PUBLISHED');
  });

  it('stops after one request when there is only one page', async () => {
    fetchMock.mockResolvedValueOnce(
      page([{ id: 'only' }], { page: 1, totalPages: 1 }),
    );
    await expect(listEvery(listCountries)).resolves.toEqual([{ id: 'only' }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('treats a list with no meta as complete', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: [{ id: 'a' }],
        meta: null,
        error: null,
        requestId: 'test',
        timestamp: '',
      }),
    } as unknown as Response);
    await expect(listEvery(listCountries)).resolves.toEqual([{ id: 'a' }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
