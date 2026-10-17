import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { siteOrigin } from '@/lib/site-origin';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/subjects/computing',
  useSearchParams: () => new URLSearchParams(),
  notFound: () => { throw new Error('NOT_FOUND'); },
}));
vi.mock('@/components/study-abroad/StudyAbroadShell', () => ({
  useStudyAbroadShell: () => ({ openAssessment: vi.fn(), openMatch: vi.fn() }),
}));
vi.mock('@/lib/catalog', () => ({
  getSubject: vi.fn(async () => ({
    id: 'computing', name: 'Computing', slug: 'computing', shortDescription: null, overview: null,
    iconMedia: null, publishedCourseCount: 0, availableCountryCount: 0, subSubjects: [], countries: [],
    tests: [], courseCountsByLevel: [], offeredLevels: [], featuredCourses: [], seo: null,
  })),
  getSubjects: vi.fn(async () => ({ data: [], meta: { page: 1, limit: 100, total: 0, totalPages: 0 } })),
  getCoursesByLevel: vi.fn(async () => []),
  getCourseLevels: vi.fn(async () => []),
}));
vi.mock('@/lib/phase1', () => ({
  phaseList: vi.fn(async () => ({ data: [], meta: { total: 0 } })),
  phaseProgrammes: vi.fn(async () => { throw new Error('unavailable'); }),
}));

const { default: Page } = await import('./page');

describe('a subject’s structured data', () => {
  it('gives its crumbs with absolute addresses', async () => {
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ slug: 'computing' }) }));
    const data = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match) => JSON.parse(match[1]));
    const crumbs = data.find((entry) => entry['@type'] === 'BreadcrumbList');
    expect(crumbs.itemListElement.map((item: { item: string }) => item.item)).toEqual([
      new URL('/', siteOrigin).toString(),
      new URL('/subjects', siteOrigin).toString(),
      new URL('/subjects/computing', siteOrigin).toString(),
    ]);
  });
});
