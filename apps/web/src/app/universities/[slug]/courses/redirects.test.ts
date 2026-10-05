import { beforeEach, describe, expect, it, vi } from 'vitest';

/* The redirect itself is what is under test: next/navigation's throws are
   replaced by ones that carry the address, and the catalogue reads by
   fixed answers for one course at Oxford. */
class Redirected extends Error {
  constructor(readonly to: string) {
    super(`redirect ${to}`);
  }
}
vi.mock('next/navigation', () => ({
  permanentRedirect: (to: string) => {
    throw new Redirected(to);
  },
  notFound: () => {
    throw new Error('not found');
  },
}));

const uk = { name: 'United Kingdom', slug: 'united-kingdom', iso2Code: 'GB' };
const oxford = {
  name: 'University of Oxford',
  slug: 'university-of-oxford',
  country: uk,
  campuses: [{ city: 'Oxford' }],
};
const course = {
  id: 'o1',
  name: 'MSc Computer Science',
  slug: 'university-of-oxford-msc-computer-science',
  genericCourse: { slug: 'msc-computer-science' },
  university: oxford,
  moreAtUniversity: { total: 1, rows: [] },
};
vi.mock('@/lib/university-courses-server', () => ({
  universityPlace: async () => ({ name: oxford.name, slug: oxford.slug, country: uk, city: 'Oxford' }),
  loadOffering: async (_university: string, offering: string) =>
    offering === course.slug ? course : null,
  loadCourseList: async () => ({
    university: oxford,
    data: [],
    meta: { page: 1, limit: 18, total: 0, totalPages: 0 },
  }),
}));
vi.mock('@/lib/phase1', () => ({
  phaseResolveRedirect: async () => null,
  phaseList: async () => ({ data: [] }),
}));

import OldCourse from './[offeringSlug]/page';
import OldList from './page';
import NestedUniversity from '@/app/(sa)/study-abroad/[countrySlug]/universities/[universitySlug]/page';
import CourseList from '@/app/(sa)/study-abroad/[countrySlug]/universities/[universitySlug]/courses/page';
import CoursePage from '@/app/(sa)/study-abroad/[countrySlug]/universities/[universitySlug]/courses/[offeringSlug]/page';

/**
 * Every redirect around a university's courses keeps the query its request
 * arrived with: an old link's campaign tags and a list's filters travel on
 * to the page that answers them.
 */

const query = { utm_source: 'newsletter', courseLevel: 'PG' };
const searchParams = Promise.resolve(query);
const where = async (render: () => Promise<unknown>) => {
  try {
    await render();
  } catch (error) {
    if (error instanceof Redirected) return error.to;
    throw error;
  }
  return null;
};
const nested = '/study-abroad/united-kingdom/universities/university-of-oxford';

describe('redirects around a university’s courses', () => {
  beforeEach(() => vi.clearAllMocks());

  it('keeps the query from a course’s old address', async () => {
    expect(
      await where(() =>
        OldCourse({
          params: Promise.resolve({ slug: oxford.slug, offeringSlug: course.slug }),
          searchParams,
        }),
      ),
    ).toBe(`${nested}/courses/${course.slug}?utm_source=newsletter&courseLevel=PG`);
  });

  it('keeps the query from the course list’s old address', async () => {
    expect(
      await where(() => OldList({ params: Promise.resolve({ slug: oxford.slug }), searchParams })),
    ).toBe(`${nested}/courses?utm_source=newsletter&courseLevel=PG`);
  });

  it('keeps the query from a university’s nested address', async () => {
    expect(
      await where(() =>
        NestedUniversity({
          params: Promise.resolve({ countrySlug: 'united-kingdom', universitySlug: oxford.slug }),
          searchParams,
        }),
      ),
    ).toBe('/universities/university-of-oxford?utm_source=newsletter&courseLevel=PG');
  });

  it('keeps the query when a course’s short name or wrong country is corrected', async () => {
    for (const params of [
      { countrySlug: 'united-kingdom', universitySlug: oxford.slug, offeringSlug: 'msc-computer-science' },
      { countrySlug: 'france', universitySlug: oxford.slug, offeringSlug: course.slug },
    ])
      expect(
        await where(() => CoursePage({ params: Promise.resolve(params), searchParams })),
      ).toBe(`${nested}/courses/${course.slug}?utm_source=newsletter&courseLevel=PG`);
  });

  it('keeps the whole query when a course list’s wrong country is corrected', async () => {
    expect(
      await where(() =>
        CourseList({
          params: Promise.resolve({ countrySlug: 'france', universitySlug: oxford.slug }),
          searchParams,
        }),
      ),
    ).toBe(`${nested}/courses?utm_source=newsletter&courseLevel=PG`);
  });
});
