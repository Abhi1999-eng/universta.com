import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CATALOG_MAX_LIMIT, listAllSubSubjects } from './catalog-client';

/**
 * The subject editor asked for fifty specializations and used whatever came
 * back. Computing has sixty-seven on production, so seventeen were never
 * shown, and a save treated them as removed. The editor now reads every
 * page.
 */

vi.mock('@/features/auth/auth-client', () => ({
  authFetch: (input: RequestInfo | URL, init?: RequestInit) =>
    fetchMock(input, init),
}));

const fetchMock = vi.fn();

function page(data: unknown[], meta: { page: number; totalPages: number; total: number }) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      data,
      meta: { ...meta, limit: CATALOG_MAX_LIMIT },
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

describe('a subject editor that holds every specialization', () => {
  it('reads past the first page when the subject has more than a page of them', async () => {
    const first = Array.from({ length: CATALOG_MAX_LIMIT }, (_, i) => ({ id: `s${i + 1}` }));
    const rest = Array.from({ length: 7 }, (_, i) => ({ id: `s${CATALOG_MAX_LIMIT + i + 1}` }));
    fetchMock
      .mockResolvedValueOnce(page(first, { page: 1, totalPages: 2, total: 107 }))
      .mockResolvedValueOnce(page(rest, { page: 2, totalPages: 2, total: 107 }));

    const rows = await listAllSubSubjects('subject-1');

    expect(rows).toHaveLength(107);
    expect(rows[0]).toEqual({ id: 's1' });
    expect(rows[106]).toEqual({ id: 's107' });
    expect(urls()).toEqual([
      `/api/v1/admin/subjects/subject-1/sub-subjects?page=1&limit=${CATALOG_MAX_LIMIT}`,
      `/api/v1/admin/subjects/subject-1/sub-subjects?page=2&limit=${CATALOG_MAX_LIMIT}`,
    ]);
  });

  it('asks the full page size, never the fifty the editor used to ask for', async () => {
    fetchMock.mockResolvedValueOnce(
      page(Array.from({ length: 67 }, (_, i) => ({ id: `s${i + 1}` })), { page: 1, totalPages: 1, total: 67 }),
    );
    const rows = await listAllSubSubjects('computing');
    expect(rows).toHaveLength(67);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(urls()[0]).toContain(`limit=${CATALOG_MAX_LIMIT}`);
  });
});
