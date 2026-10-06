import { beforeEach, describe, expect, it, vi } from 'vitest';

/* The redirect itself is what is under test: next/navigation's throws are
   replaced by ones that say where they went, and the catalogue's reads by
   fixed answers. */
class Redirected extends Error {
  constructor(readonly to: string) {
    super(`redirect ${to}`);
  }
}
class NotFound extends Error {}
const navigation = vi.hoisted(() => ({ permanent: 0 }));
vi.mock('next/navigation', () => ({
  permanentRedirect: (to: string) => {
    navigation.permanent += 1;
    throw new Redirected(to);
  },
  redirect: () => {
    throw new Error('a temporary redirect is not what these addresses get');
  },
  notFound: () => {
    throw new NotFound('not found');
  },
}));

const api = vi.hoisted(() => ({
  courses: {} as Record<string, unknown>,
  slugs: {} as Record<string, { kind: string; path: string }>,
  programmeReads: [] as Array<Record<string, string>>,
}));
vi.mock('@/lib/catalog', () => ({
  getCourse: async (slug: string) => {
    const course = api.courses[slug];
    if (!course) throw new Error('404');
    return course;
  },
}));
vi.mock('@/lib/phase1', () => ({
  phaseCourseSlug: async (slug: string) => api.slugs[slug] ?? null,
  phaseList: async () => ({ data: [], meta: null }),
  phaseProgrammes: async (params: Record<string, string>) => {
    api.programmeReads.push(params);
    return { data: [], meta: { total: 0 }, facets: {}, summary: {} };
  },
}));

const { default: CoursePage } = await import('./page');

const visit = async (slug: string, query: Record<string, string> = {}) => {
  try {
    await CoursePage({
      params: Promise.resolve({ slug }),
      searchParams: Promise.resolve(query),
    });
  } catch (error) {
    if (error instanceof Redirected) return { redirect: error.to };
    if (error instanceof NotFound) return { status: 404 };
    throw error;
  }
  return { status: 200 };
};

beforeEach(() => {
  navigation.permanent = 0;
  api.programmeReads = [];
  api.courses = {
    'msc-computer-science': {
      id: 'c1',
      name: 'MSc Computer Science',
      slug: 'msc-computer-science',
      subject: { id: 's', name: 'Computer Science', slug: 'computer-science' },
      courseLevel: { id: 'l', name: "Master's", code: 'PG' },
      studyModes: [],
      duration: { min: null, max: null, unit: null },
      availability: [],
      jsonLd: {},
    },
  };
  api.slugs = {
    'computer-science': { kind: 'subject', path: '/subjects/computer-science' },
    'software-engineering': {
      kind: 'specialization',
      path: '/subjects/computer-science/software-engineering',
    },
    'university-of-warwick-msc-computer-science': {
      kind: 'programme',
      path: '/study-abroad/united-kingdom/universities/university-of-warwick/courses/university-of-warwick-msc-computer-science',
    },
  };
});

/**
 * The reference sends /courses/<slug>/ to whatever carries the slug. Ours
 * answered 404 for anything that was not a course guide, so a subject, a
 * specialization or a programme reached by its bare name was lost.
 */
describe('a bare /courses/<slug> that is not a course guide', () => {
  it('sends a subject’s slug to the subject, permanently', async () => {
    expect(await visit('computer-science')).toEqual({ redirect: '/subjects/computer-science' });
    expect(navigation.permanent).toBe(1);
  });

  it('sends a specialization’s slug to the specialization under its subject', async () => {
    expect(await visit('software-engineering')).toEqual({
      redirect: '/subjects/computer-science/software-engineering',
    });
  });

  it('sends a programme’s slug to its nested page', async () => {
    expect(await visit('university-of-warwick-msc-computer-science')).toEqual({
      redirect:
        '/study-abroad/united-kingdom/universities/university-of-warwick/courses/university-of-warwick-msc-computer-science',
    });
  });

  it('keeps the query the request arrived with', async () => {
    expect(await visit('computer-science', { utm_source: 'newsletter' })).toEqual({
      redirect: '/subjects/computer-science?utm_source=newsletter',
    });
  });

  it('answers 404 when nothing, or more than one thing, carries the slug', async () => {
    expect(await visit('zzz')).toEqual({ status: 404 });
    expect(navigation.permanent).toBe(0);
  });
});

describe('a course guide', () => {
  it('still renders, and asks for its programmes by its slug', async () => {
    expect(await visit('msc-computer-science')).toEqual({ status: 200 });
    expect(api.programmeReads[0]).toMatchObject({
      course: 'msc-computer-science',
      within: 'course',
    });
  });

  it('narrows its programmes to the destination it was opened under', async () => {
    await visit('msc-computer-science', { country: 'united-kingdom' });
    expect(api.programmeReads[0]).toMatchObject({
      course: 'msc-computer-science',
      country: 'united-kingdom',
    });
  });

  it('is never redirected, even where a subject shares its slug', async () => {
    api.slugs['msc-computer-science'] = { kind: 'subject', path: '/subjects/x' };
    expect(await visit('msc-computer-science')).toEqual({ status: 200 });
  });
});
