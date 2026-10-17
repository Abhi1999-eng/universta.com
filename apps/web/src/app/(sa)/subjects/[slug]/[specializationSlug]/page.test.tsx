import { isValidElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { siteOrigin } from '@/lib/site-origin';

const fixture = vi.hoisted(() => ({
  faqs: [] as Array<{ id: string; question: string; answer: string }>,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/subjects/computing/ai',
  useSearchParams: () => new URLSearchParams(),
  notFound: () => { throw new Error('NOT_FOUND'); },
  permanentRedirect: (url: string) => { throw new Error(`REDIRECT:${url}`); },
}));
vi.mock('@/components/study-abroad/StudyAbroadShell', () => ({
  useStudyAbroadShell: () => ({ openAssessment: vi.fn(), openMatch: vi.fn() }),
}));

const levels = [
  { code: 'FOUNDATION', name: 'Foundation' },
  { code: 'PATHWAY', name: 'Pathway' },
  { code: 'UG', name: "Bachelor's" },
  { code: 'PG', name: "Master's" },
  { code: 'MBA', name: 'MBA' },
  { code: 'PHD', name: 'PhD' },
].map((level, index) => ({ ...level, id: level.code.toLowerCase(), description: null, educationOrder: index + 1 }));
const subject = { id: 'computing', name: 'Computing', slug: 'computing', shortDescription: null };

vi.mock('@/lib/catalog', () => ({
  getSpecialization: vi.fn(async (_: string, slug: string) => {
    if (slug !== 'ai') throw new Error('Specialization not found');
    return {
      id: 'ai', name: 'Artificial Intelligence', slug: 'ai', shortDescription: 'Machines that learn.',
      overview: null, iconMedia: null, listingMedia: null, featured: false, displayOrder: 0,
      subject, offeredLevels: [levels[3]], levels: [levels[3]],
      contentSections: [], faqs: fixture.faqs, siblings: [], siblingTotal: 0, countries: [], courses: [], seo: null,
    };
  }),
  /* The subject is offered at Bachelor's alone. */
  getSubject: vi.fn(async () => ({
    ...subject, offeredLevels: [levels[2]], subSubjects: [], courseCountsByLevel: [], seo: null,
  })),
  getCourseLevels: vi.fn(async () => levels),
  getCoursesByLevel: vi.fn(async () => []),
  getCourseFilterOptions: vi.fn(async () => null),
  getCourses: vi.fn(async () => ({ data: [], meta: { page: 1, limit: 1, total: 0, totalPages: 0 } })),
  getSubjectLevelPage: vi.fn(async () => { throw new Error('Level page not found'); }),
}));
vi.mock('@/lib/phase1', () => ({
  phaseList: vi.fn(async () => ({ data: [], meta: { total: 0 } })),
  phaseProgrammes: vi.fn(async () => ({
    data: [], meta: { page: 1, limit: 18, total: 0, totalPages: 0 },
    summary: { programmes: 0, universities: 0, cities: 0, countries: 0 }, facets: {}, ignored: [],
  })),
}));

const { default: Page, generateMetadata } = await import('./page');
const props = (specializationSlug: string) => ({
  params: Promise.resolve({ slug: 'computing', specializationSlug }),
  searchParams: Promise.resolve({}),
});
const jsonLd = (html: string) =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match) => JSON.parse(match[1]) as Record<string, unknown>);

beforeEach(() => {
  fixture.faqs = [];
});

/**
 * The place after a subject holds a specialization or a study level. A
 * level renders only where the subject has a page at it; any other is a
 * real 404, raised inside this route rather than by an element it returns.
 */
describe('a study level after a subject', () => {
  it('404s a level the subject is not offered at', async () => {
    await expect(Page(props('phd'))).rejects.toThrow('NOT_FOUND');
    expect(await generateMetadata(props('phd'))).toEqual({
      title: 'Study level not found',
      robots: { index: false, follow: true },
    });
  });

  it('renders a level the subject is offered at', async () => {
    const page = await Page(props('bachelors'));
    expect(isValidElement(page)).toBe(true);
    const meta = await generateMetadata(props('bachelors'));
    expect(meta.title).toEqual({ absolute: "Bachelor's in Computing | Universta" });
  });

  it('404s a segment that is neither a specialization nor a level', async () => {
    await expect(Page(props('not-a-thing'))).rejects.toThrow('NOT_FOUND');
  });
});

describe('a specialization’s structured data', () => {
  it('gives its crumbs with absolute addresses', async () => {
    const html = renderToStaticMarkup(await Page(props('ai')));
    const crumbs = jsonLd(html).find((data) => data['@type'] === 'BreadcrumbList')!;
    expect(crumbs.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Home', item: new URL('/', siteOrigin).toString() },
      { '@type': 'ListItem', position: 2, name: 'Subjects', item: new URL('/subjects', siteOrigin).toString() },
      { '@type': 'ListItem', position: 3, name: 'Computing', item: new URL('/subjects/computing', siteOrigin).toString() },
      { '@type': 'ListItem', position: 4, name: 'Artificial Intelligence', item: new URL('/subjects/computing/ai', siteOrigin).toString() },
    ]);
  });

  it('gives its questions as FAQPage data, and none without questions', async () => {
    expect(jsonLd(renderToStaticMarkup(await Page(props('ai')))).some((data) => data['@type'] === 'FAQPage')).toBe(false);
    fixture.faqs = [{ id: 'f1', question: 'Is it taught in English?', answer: '<p>Mostly, <em>yes</em>.</p>' }];
    const faq = jsonLd(renderToStaticMarkup(await Page(props('ai')))).find((data) => data['@type'] === 'FAQPage')!;
    expect(faq.mainEntity).toEqual([
      { '@type': 'Question', name: 'Is it taught in English?', acceptedAnswer: { '@type': 'Answer', text: 'Mostly, yes.' } },
    ]);
  });
});
