import { afterEach, describe, expect, it, vi } from 'vitest';

const programmeSuggestions = vi.fn();
const scopedCourses = vi.fn();
const scopedProgrammes = vi.fn();
vi.mock('@/lib/catalog', () => ({
  getCourses: (params: Record<string, string>) => scopedCourses(params),
}));
vi.mock('@/lib/phase1', () => ({
  phaseProgrammeSuggestions: (q: string) => programmeSuggestions(q),
  phaseProgrammes: (params: Record<string, string>) => scopedProgrammes(params),
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
  scopedCourses.mockReset();
  scopedProgrammes.mockReset();
});

const offering = (index: number, university = 'University of Warwick') => ({
  id: `programme-${index}`,
  slug: `msc-computer-science-${index}`,
  name: `MSc Computer Science ${index}`,
  university: {
    name: university,
    slug: 'university-of-warwick',
    country: { name: 'United Kingdom', slug: 'united-kingdom', iso2Code: 'GB' },
  },
});

describe('scoped course suggestions', () => {
  it('searches the fixed subject, specialization and level instead of a global first page', async () => {
    const fetched = courseApi([course('Unrelated global course')]);
    scopedCourses.mockResolvedValue({ data: [course('BSc Computer Science')] });
    const response = await GET(new Request(
      'http://x/api/courses/suggestions?q=comp&subject=computer-science&subSubject=software-engineering&level=UG',
    ));
    expect(scopedCourses).toHaveBeenCalledWith({
      subject: 'computer-science', subSubject: 'software-engineering', level: 'UG', q: 'comp', pageSize: '8',
    });
    expect((await response.json()).data).toEqual([course('BSc Computer Science')]);
    expect(fetched).toEqual([]);
    expect(programmeSuggestions).not.toHaveBeenCalled();
    expect(scopedProgrammes).not.toHaveBeenCalled();
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('scopes programme reads and opens a suggested university inside the same level listing', async () => {
    const fetched = courseApi([]);
    scopedCourses.mockResolvedValue({ data: [course('Warwick course guide')] });
    scopedProgrammes.mockResolvedValue({ data: [offering(1), offering(2)] });
    const response = await GET(new Request(
      'http://x/api/courses/suggestions?q=war&with=programmes&subject=computer-science&subSubject=software-engineering&level=PG',
    ));
    expect(scopedProgrammes).toHaveBeenCalledWith({
      subject: 'computer-science', specialization: 'software-engineering', level: 'PG',
      q: 'war', limit: '8', within: 'subject,specialization,level',
    });
    const { data } = await response.json();
    expect(data.map((row: { name: string }) => row.name)).toEqual([
      'Warwick course guide', 'University of Warwick',
      'MSc Computer Science 1 · University of Warwick', 'MSc Computer Science 2 · University of Warwick',
    ]);
    expect(data[1].href).toBe(
      '/subjects/computer-science/software-engineering/levels/masters?university=university-of-warwick',
    );
    expect(data[2].href).toBe(
      '/study-abroad/united-kingdom/universities/university-of-warwick/courses/msc-computer-science-1',
    );
    expect(programmeSuggestions).not.toHaveBeenCalled();
    expect(fetched).toEqual([]);
  });

  it('accepts programme specialization naming and retains the global university address for a partial scope', async () => {
    scopedCourses.mockResolvedValue({ data: [] });
    scopedProgrammes.mockResolvedValue({ data: [offering(1)] });
    const response = await GET(new Request(
      'http://x/api/courses/suggestions?q=war&with=programmes&subject=computer-science&specialization=software-engineering',
    ));
    expect(scopedCourses).toHaveBeenCalledWith({
      subject: 'computer-science', subSubject: 'software-engineering', q: 'war', pageSize: '8',
    });
    expect((await response.json()).data[0].href).toBe('/courses?university=university-of-warwick');
  });

  it('keeps successful scoped guides when the scoped programmes service fails', async () => {
    const fetched = courseApi([course('Unrelated global course')]);
    scopedCourses.mockResolvedValue({ data: [course('BSc Computer Science')] });
    scopedProgrammes.mockRejectedValue(new Error('unavailable'));
    const response = await GET(new Request(
      'http://x/api/courses/suggestions?q=comp&with=programmes&subject=computer-science&level=UG',
    ));
    expect((await response.json()).data).toEqual([course('BSc Computer Science')]);
    expect(fetched).toEqual([]);
    expect(programmeSuggestions).not.toHaveBeenCalled();
  });

  it('keeps successful scoped programmes when guides fail, with no unrelated university suggestion', async () => {
    scopedCourses.mockRejectedValue(new Error('unavailable'));
    scopedProgrammes.mockResolvedValue({ data: [offering(1)] });
    const response = await GET(new Request(
      'http://x/api/courses/suggestions?q=comp&with=programmes&subject=computer-science&level=UG',
    ));
    const { data } = await response.json();
    expect(data).toHaveLength(1);
    expect(data[0].kind).toBe('programme');
    expect(data[0].name).toBe('MSc Computer Science 1 · University of Warwick');
  });

  it('bounds the mixed result to eight and returns an empty scoped answer when both reads fail', async () => {
    scopedCourses.mockResolvedValue({ data: Array.from({ length: 8 }, (_, index) => course(`Guide ${index}`)) });
    scopedProgrammes.mockResolvedValue({ data: [offering(1), offering(2), offering(3)] });
    const request = () => new Request(
      'http://x/api/courses/suggestions?q=comp&with=programmes&subject=computer-science&level=UG',
    );
    const first = await GET(request());
    const { data } = await first.json();
    expect(data).toHaveLength(8);
    expect(data.slice(0, 4).map((row: { name: string }) => row.name)).toEqual(['Guide 0', 'Guide 1', 'Guide 2', 'Guide 3']);
    scopedCourses.mockRejectedValue(new Error('unavailable'));
    scopedProgrammes.mockRejectedValue(new Error('unavailable'));
    const second = await GET(request());
    expect((await second.json()).data).toEqual([]);
    expect(programmeSuggestions).not.toHaveBeenCalled();
  });
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
