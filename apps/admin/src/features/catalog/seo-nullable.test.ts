import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSubjectSeo, getCourseSeo } from './catalog-client';

/** ISS-010. The SEO endpoints answer `{ data: null }` to mean "no SEO
 * configured yet". The shared `request` helper treats *any* null payload as a
 * failure and throws, so `getSubjectSeo` rejected for every subject without
 * SEO. The Subject editor loads the record and its SEO with `Promise.all`, so
 * that rejection discarded the record too: every Subject editor opened with
 * blank fields and "Catalog request failed" — including production subjects,
 * which made the module uneditable.
 *
 * These pin that a null SEO payload resolves instead of throwing, while a real
 * error still throws. */

vi.mock('@/features/auth/auth-client', () => ({
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => fetchMock(input, init),
}));

const fetchMock = vi.fn();

function envelope(data: unknown, error: unknown = null, status = 200) {
  return {
    ok: status < 400,
    status,
    json: async () => ({ data, meta: null, error, requestId: 'test', timestamp: '' }),
  } as unknown as Response;
}

beforeEach(() => {
  fetchMock.mockReset();
});

describe('nullable SEO getters', () => {
  it('resolves with null when a subject has no SEO yet', async () => {
    fetchMock.mockResolvedValue(envelope(null));
    await expect(getSubjectSeo('subject-1')).resolves.toMatchObject({ data: null });
  });

  it('resolves with null when a course has no SEO yet', async () => {
    fetchMock.mockResolvedValue(envelope(null));
    await expect(getCourseSeo('course-1')).resolves.toMatchObject({ data: null });
  });

  it('returns the record when SEO does exist', async () => {
    fetchMock.mockResolvedValue(envelope({ id: 'seo-1', title: 'Computer Science' }));
    const result = await getSubjectSeo('subject-1');
    expect(result.data).toMatchObject({ id: 'seo-1' });
  });

  it('still throws on a real API error, so failures are not swallowed', async () => {
    fetchMock.mockResolvedValue(
      envelope(null, { code: 'FORBIDDEN', message: 'Not allowed', details: null }, 403),
    );
    await expect(getSubjectSeo('subject-1')).rejects.toThrow();
  });

  it('still throws on a non-JSON response', async () => {
    fetchMock.mockResolvedValue({
      ok: true, status: 200,
      json: async () => { throw new Error('not json'); },
    } as unknown as Response);
    await expect(getSubjectSeo('subject-1')).rejects.toThrow();
  });
});
