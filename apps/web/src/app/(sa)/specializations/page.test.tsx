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
  levels: [{ id: 'f', code: 'FOUNDATION', name: 'Foundation Program' }] as Array<{
    id: string;
    code: string;
    name: string;
  }>,
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
  getCourseLevels: async () => catalogue.levels,
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
    catalogue.levels = [{ id: 'f', code: 'FOUNDATION', name: 'Foundation Program' }];
  });

  it('says a filter matched nothing, not that nothing is published', async () => {
    const html = await render({ subject: 'computer-science' });
    expect(html).toContain('No specializations match those filters.');
    expect(html).toContain('Try another subject.');
    expect(html).not.toContain('No specializations are published yet.');
    /* No "0 shown of 0" beside it. */
    expect(html).not.toContain('h-count');
  });

  /* The level filter is gone from the page, so an old ?level= address
     narrows nothing the page does not show. */
  it('reads an old ?level= address without narrowing the list', async () => {
    await render({ level: 'FOUNDATION' });
    expect(getSpecializations).toHaveBeenCalledWith(expect.not.objectContaining({ level: expect.anything() }));
  });

  it('counts against the whole catalogue, with no count line over the heading', async () => {
    catalogue.filtered = [row];
    catalogue.filteredTotal = 1;
    const html = await render({ q: 'software' });
    expect(html).not.toContain('hero__eyebrow');
    expect(html).not.toContain('Narrow down');
    expect(html).not.toContain('1 specializations');
    expect(html).toContain('1 of 120 shown');
  });

  it('offers no study level filter', async () => {
    const html = await render({});
    expect(html).not.toContain('name="level"');
    expect(html).not.toContain('All levels');
    expect(html).not.toContain('<span>Study level</span>');
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

  describe('each card’s levels', () => {
    const UG = { id: 'ug', code: 'UG', name: "Bachelor's" };
    const PG = { id: 'pg', code: 'PG', name: "Master's" };
    const PHD = { id: 'phd', code: 'PHD', name: 'PhD' };
    const hrefs = (html: string) =>
      [...html.matchAll(/<a class="levellinks__a"[^>]* href="([^"]+)"/g)].map((match) => match[1]);

    it('links each level to the specialization’s page at it, by its plain address', async () => {
      catalogue.levels = [UG, PG, PHD];
      catalogue.filtered = [{ ...row, levels: [UG, PG] }];
      catalogue.filteredTotal = 1;
      const html = await render({});
      expect(hrefs(html)).toEqual([
        '/subjects/computer-science/software-engineering/bachelors',
        '/subjects/computer-science/software-engineering/masters',
      ]);
      expect(html).toContain('aria-label="Master&#x27;s in Software Engineering"');
      expect(html).toContain('6 courses · ');
    });

    it('keeps the whole card opening the specialization, with no anchor inside another', async () => {
      catalogue.levels = [UG, PG, PHD];
      catalogue.filtered = [{ ...row, levels: [UG, PG] }];
      catalogue.filteredTotal = 1;
      const html = await render({});
      expect(html).toContain(
        '<article class="h-card card-stretch"><a class="h-card__t card-stretch__link" href="/subjects/computer-science/software-engineering">Software Engineering</a>',
      );
      const card = html.slice(html.indexOf('<article class="h-card card-stretch">'));
      const opened = card.slice(0, card.indexOf('</article>'));
      /* Every anchor closes before the next one opens. */
      expect(opened.replace(/<a [^>]*>[^<]*<\/a>/g, '')).not.toContain('<a ');
    });

    it('links no level on a card offered at none, and leaves that card one link', async () => {
      catalogue.levels = [UG, PG, PHD];
      catalogue.filtered = [row];
      catalogue.filteredTotal = 1;
      const html = await render({});
      expect(hrefs(html)).toEqual([]);
      expect(html).toContain('<a class="h-card" href="/subjects/computer-science/software-engineering">');
    });

    it('does not link a level the catalogue has switched off', async () => {
      catalogue.levels = [UG];
      catalogue.filtered = [{ ...row, levels: [UG, PHD] }];
      catalogue.filteredTotal = 1;
      const html = await render({});
      expect(hrefs(html)).toEqual(['/subjects/computer-science/software-engineering/bachelors']);
    });
  });
});
