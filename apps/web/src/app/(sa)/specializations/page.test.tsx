import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/specializations',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/components/study-abroad/StudyAbroadShell', () => ({
  useStudyAbroadShell: () => ({ openAssessment: vi.fn(), openMatch: vi.fn() }),
}));

/** What the catalogue answers, set per test. */
const catalogue = {
  filtered: [] as unknown[],
  filteredTotal: 0,
  everything: 120,
};
const getSpecializations = vi.fn(async (params: Record<string, string>) => {
  const unfiltered = !params.search && !params.subject && !params.level;
  if (params.limit === '1' && unfiltered)
    return { data: [], meta: { total: catalogue.everything } };
  return { data: catalogue.filtered, meta: { total: catalogue.filteredTotal } };
});
vi.mock('@/lib/catalog', () => ({
  getSpecializations: (params: Record<string, string>) => getSpecializations(params),
  getSubjects: async () => ({ data: [{ id: 'cs', name: 'Computer Science', slug: 'computer-science' }] }),
  getCourseLevels: async () => [{ id: 'f', code: 'FOUNDATION', name: 'Foundation Program' }],
}));

const { default: SpecializationsIndexPage } = await import('./page');

const render = async (params: Record<string, string>) =>
  renderToStaticMarkup(
    await SpecializationsIndexPage({ searchParams: Promise.resolve(params) }),
  );

const row = {
  id: 'se',
  name: 'Software Engineering',
  slug: 'software-engineering',
  subject: { id: 'cs', name: 'Computer Science', slug: 'computer-science' },
  publishedCourseCount: 6,
  levels: [],
};

describe('the specializations directory', () => {
  beforeEach(() => {
    getSpecializations.mockClear();
    catalogue.filtered = [];
    catalogue.filteredTotal = 0;
  });

  it('says a filter matched nothing, not that nothing is published', async () => {
    const html = await render({ subject: 'computer-science', level: 'FOUNDATION' });
    expect(html).toContain('No specializations match those filters.');
    expect(html).toContain('Try another subject or level.');
    expect(html).not.toContain('No specializations are published yet.');
    /* No "0 shown of 0" beside it. */
    expect(html).not.toContain('h-count');
  });

  it('keeps the whole catalogue’s count in the eyebrow, in the right number', async () => {
    catalogue.filtered = [row];
    catalogue.filteredTotal = 1;
    const html = await render({ q: 'software' });
    expect(html).toMatch(/Narrow down<b>·<\/b>120 specializations/);
    expect(html).not.toContain('1 specializations');
    expect(html).toContain('1 of 120 shown');
  });

  it('says nothing is published only when nothing is filtered', async () => {
    catalogue.everything = 0;
    const html = await render({});
    expect(html).toContain('No specializations are published yet.');
    catalogue.everything = 120;
  });

  it('offers the way to browse by subject, as the design’s hero does', async () => {
    const html = await render({});
    expect(html).toMatch(/<a class="btn btn--ghost" href="\/subjects">Browse by subject/);
  });

  it('keeps its filters a real form, with the list in the same band', async () => {
    catalogue.filtered = [row];
    catalogue.filteredTotal = 1;
    const html = await render({});
    expect(html).toMatch(
      /<section class="sec sec--white sec--tight specresults" id="specializations"><div class="wrap"><form class="h-filters" role="search" method="get">/,
    );
    expect(html).toContain('<button class="btn btn--sm" type="submit">');
    expect(html).toContain('href="/subjects/computer-science/software-engineering"');
  });
});
