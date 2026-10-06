import { afterEach, describe, expect, it, vi } from 'vitest';

const programmeSuggestions = vi.fn();
vi.mock('@/lib/phase1', () => ({
  phaseProgrammeSuggestions: (q: string) => programmeSuggestions(q),
}));

import { GET } from './route';

/**
 * Course-name suggestions, as the older listings read them, and -- asked
 * for -- the programmes and universities beside them, each with the page
 * it opens.
 */

const course = (name: string) => ({
  id: name,
  name,
  slug: name.toLowerCase().replace(/\s+/g, '-'),
  subject: { name: 'Computer Science' },
});

afterEach(() => {
  vi.unstubAllGlobals();
  programmeSuggestions.mockReset();
});

function courseApi(rows: unknown[], status = 200) {
  const fetched: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: URL) => {
      fetched.push(String(url));
      return new Response(JSON.stringify({ data: rows, meta: null, error: null }), { status });
    }),
  );
  return fetched;
}

describe('course suggestions', () => {
  it('answers with the course API’s own list by default', async () => {
    const fetched = courseApi([course('BSc Computer Science')]);
    const response = await GET(new Request('http://x/api/courses/suggestions?q=comp'));
    expect(fetched[0]).toContain('/api/v1/courses/suggestions?q=comp');
    expect(programmeSuggestions).not.toHaveBeenCalled();
    expect((await response.json()).data).toEqual([course('BSc Computer Science')]);
  });

  it('says nothing for fewer than two letters', async () => {
    const fetched = courseApi([]);
    const response = await GET(new Request('http://x/api/courses/suggestions?q=c&with=programmes'));
    expect(fetched).toEqual([]);
    expect((await response.json()).data).toEqual([]);
  });

  it('adds programmes and universities, each with its page, when asked', async () => {
    courseApi([course('BSc Computer Science'), course('MSc Computer Science')]);
    programmeSuggestions.mockResolvedValue([
      {
        label: 'University of Warwick',
        kind: 'university',
        href: '/courses?university=university-of-warwick',
      },
      {
        label: 'MSc Computer Science',
        kind: 'programme',
        href: '/study-abroad/united-kingdom/universities/university-of-warwick/courses/x',
      },
    ]);
    const response = await GET(
      new Request('http://x/api/courses/suggestions?q=comp&with=programmes'),
    );
    const { data } = (await response.json()) as { data: Array<{ name: string; href?: string }> };
    expect(data.map((item) => item.name)).toEqual([
      'BSc Computer Science',
      'MSc Computer Science',
      'University of Warwick',
    ]);
    expect(data[2]!.href).toBe('/courses?university=university-of-warwick');
  });

  it('keeps one half when the other fails', async () => {
    courseApi([], 503);
    programmeSuggestions.mockRejectedValue(new Error('down'));
    const response = await GET(
      new Request('http://x/api/courses/suggestions?q=comp&with=programmes'),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual([]);
  });
});
