import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { UniversityIndex, type UniversityIndexRow } from './UniversityIndex';

/**
 * The university lists, rendered as the server renders them: from the rows
 * and the address. Every choice a reader makes lives in the address, so
 * what a test puts there is exactly what a shared link, a refresh or the
 * back button would bring back.
 */

const nav = vi.hoisted(() => ({ search: '', path: '/universities' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, replace: () => {} }),
  useSearchParams: () => new URLSearchParams(nav.search),
  usePathname: () => nav.path,
}));

beforeEach(() => {
  nav.search = '';
  nav.path = '/universities';
});

const row = (over: Partial<UniversityIndexRow> = {}): UniversityIndexRow => ({
  id: 'u1',
  name: 'Aalborg University',
  slug: 'aalborg-university',
  shortDescription: 'Known for problem-based learning.',
  institutionType: 'PUBLIC',
  qsRanking: null,
  totalStudents: null,
  internationalStudentsPercent: null,
  programmes: 3,
  campuses: 1,
  city: 'Aalborg',
  cities: ['Aalborg'],
  country: { name: 'Denmark', slug: 'denmark', iso2Code: 'DK' },
  subjects: [],
  ...over,
});

const many = (count: number) =>
  Array.from({ length: count }, (_, index) =>
    row({
      id: `u${index}`,
      name: `University ${String(index).padStart(2, '0')}`,
      slug: `university-${index}`,
    }),
  );

const render = (
  rows: UniversityIndexRow[],
  props: Partial<Parameters<typeof UniversityIndex>[0]> = {},
) => renderToStaticMarkup(<UniversityIndex universities={rows} {...props} />);

const cards = (html: string) => (html.match(/class="unicard"/g) ?? []).length;

describe('the university directory', () => {
  it('counts what matches, out loud', () => {
    expect(render([row(), row({ id: 'u2' })])).toMatch(
      /class="results__count" aria-live="polite">2 universities</,
    );
    expect(render([row()])).toContain('1 university');
  });

  it('builds the destination filter from the catalogue, with counts', () => {
    const html = render([
      row(),
      row({ id: 'u2', country: { name: 'Finland', slug: 'finland', iso2Code: 'FI' } }),
      row({ id: 'u3' }),
    ]);
    /* Denmark twice, Finland once, most first. */
    expect(html.indexOf('Denmark</span><em>2')).toBeLessThan(
      html.indexOf('Finland</span><em>1'),
    );
  });

  it('offers an institution-type filter only when it would narrow anything', () => {
    expect(render([row(), row({ id: 'u2' })])).not.toContain('Institution type');
    expect(
      render([row(), row({ id: 'u2', institutionType: 'PRIVATE' })]),
    ).toContain('Institution type');
  });

  it('draws each country’s own flag on the card', () => {
    expect(render([row()])).toContain('/flags/dk.svg');
  });

  it('shows a ranking only where there is one', () => {
    expect(render([row()])).not.toContain('Ranked #');
    expect(render([row({ qsRanking: 412 })])).toContain('Ranked #412');
  });

  it('reads an institution type back as words, not as a database value', () => {
    expect(render([row({ institutionType: 'PRIVATE_NON_PROFIT' })])).toContain(
      'Private Non Profit',
    );
  });

  it('says so plainly when the catalogue is empty', () => {
    /* Not "no match" -- there is nothing to match against. */
    expect(render([])).toContain('No university is published yet');
  });

  it('puts the filter-lines mark on the Filters button', () => {
    expect(render([row(), row({ id: 'u2', institutionType: 'PRIVATE' })])).toMatch(
      /filters-toggle[^>]*><svg[^>]*aria-hidden="true"/,
    );
  });
});

/**
 * The behaviour reference shows eighteen and adds eighteen at a time. The
 * whole catalogue on one page made the directory 49,000 pixels tall.
 */
describe('eighteen at a time', () => {
  it('shows the first eighteen and offers the rest', () => {
    const html = render(many(20));
    expect(cards(html)).toBe(18);
    expect(html).toContain('Showing 18 of 20');
    expect(html).toContain('Load more universities');
    expect(html).toContain('role="status"');
  });

  it('carries a link to the next step for a reader without script', () => {
    const html = render(many(20));
    expect(html).toContain('<noscript>');
    expect(html).toContain('href="/universities?page=2#results"');
    expect(html).toContain('rel="nofollow"');
  });

  it('keeps how far the reader had loaded, from the address', () => {
    nav.search = 'page=2';
    const html = render(many(20));
    expect(cards(html)).toBe(20);
    expect(html).not.toContain('Load more universities');
    expect(html).toContain('You’ve reached the end of the list.');
  });

  it('has no load-more row when everything fits', () => {
    const html = render(many(18));
    expect(cards(html)).toBe(18);
    expect(html).not.toContain('Load more');
    expect(html).not.toContain('end of the list');
  });
});

/**
 * Filters and the order used to be component state, so a shared link, a
 * refresh or the back button opened the whole unfiltered list again.
 */
describe('the list in the address', () => {
  const mixed = () => [
    row(),
    row({
      id: 'u2',
      name: 'University of Oxford',
      slug: 'university-of-oxford',
      institutionType: 'PRIVATE',
      city: 'Oxford',
      cities: ['Oxford'],
      country: { name: 'United Kingdom', slug: 'united-kingdom', iso2Code: 'GB' },
      subjects: [{ slug: 'law', name: 'Law' }],
    }),
    row({
      id: 'u3',
      name: 'Imperial College London',
      slug: 'imperial-college-london',
      city: 'London',
      cities: ['London'],
      country: { name: 'United Kingdom', slug: 'united-kingdom', iso2Code: 'GB' },
      subjects: [{ slug: 'engineering', name: 'Engineering' }],
    }),
  ];

  it('opens on the destination the address names, ticked', () => {
    nav.search = 'country=united-kingdom';
    const html = render(mixed());
    expect(cards(html)).toBe(2);
    expect(html).not.toContain('Aalborg University');
    expect(html).toMatch(/checked=""\/><span>United Kingdom<\/span>/);
  });

  it('opens on the type the address names', () => {
    nav.search = 'type=PRIVATE';
    const html = render(mixed());
    expect(cards(html)).toBe(1);
    expect(html).toContain('University of Oxford');
  });

  it('sets aside a value no option offers rather than emptying the list', () => {
    nav.search = 'country=narnia';
    expect(cards(render(mixed()))).toBe(3);
  });

  it('offers cities only inside a chosen destination', () => {
    expect(render(mixed())).not.toContain('>City<');
    nav.search = 'country=united-kingdom';
    const html = render(mixed());
    expect(html).toContain('>City<');
    expect(html).toContain('<span>London</span><em>1</em>');
    expect(html).toContain('<span>Oxford</span><em>1</em>');
    expect(html).not.toContain('<span>Aalborg</span>');
  });

  it('keeps a city it is narrowing by on offer, with no destination ticked', () => {
    /* A shared link, or a destination unticked before the fix that lets
       go of its cities: the city still narrows the list, so the panel has
       to show it where it can be unticked. */
    nav.search = 'city=london';
    const html = render(mixed());
    expect(cards(html)).toBe(1);
    expect(html).toContain('>City<');
    expect(html).toMatch(/checked=""\/><span>London<\/span>/);
    /* Only the city ticked, not every city in the catalogue around it. */
    expect(html).not.toContain('<span>Oxford</span>');
    expect(html).not.toContain('<span>Aalborg</span>');
  });

  it('narrows to a city', () => {
    nav.search = 'country=united-kingdom&city=oxford';
    const html = render(mixed());
    expect(cards(html)).toBe(1);
    expect(html).toContain('Oxford, United Kingdom');
  });

  it('narrows to a field of study', () => {
    nav.search = 'subject=engineering';
    const html = render(mixed());
    expect(html).toContain('Field of study');
    expect(cards(html)).toBe(1);
    expect(html).toContain('Imperial College London');
  });

  it('orders by the address’s sort', () => {
    nav.search = 'sort=programs';
    const html = render([
      row({ id: 'a', name: 'Alpha', programmes: 1 }),
      row({ id: 'b', name: 'Beta', programmes: 9 }),
    ]);
    expect(html.indexOf('Beta')).toBeLessThan(html.indexOf('Alpha'));
    expect(html).toMatch(/<option value="programs" selected="">/);
  });

  it('searches city names as well as names', () => {
    nav.search = 'q=london';
    expect(cards(render(mixed()))).toBe(1);
  });
});

describe('the order the list opens in', () => {
  it('puts ranked universities first in rank order, then the rest A to Z', () => {
    const html = render([
      row({ id: 'a', name: 'Aalto University' }),
      row({ id: 'z', name: 'Zurich University', qsRanking: 80 }),
      row({ id: 'm', name: 'Munich University', qsRanking: 20 }),
    ]);
    const at = (name: string) => html.indexOf(`>${name}</a></h3>`);
    expect(at('Munich University')).toBeLessThan(at('Zurich University'));
    expect(at('Zurich University')).toBeLessThan(at('Aalto University'));
    expect(html).toContain('Ranked first');
    expect(html).toContain('This is display order only, not a Universta ranking.');
  });

  it('says plainly when nothing shown is ranked', () => {
    expect(render([row()])).toContain(
      'None of these universities has a published QS ranking on its profile, so they are listed A to Z.',
    );
  });

  it('drops the ordering note once the reader picks another order', () => {
    nav.search = 'sort=name';
    expect(render([row()])).not.toContain('listed A to Z');
  });

  it('offers a ranked-only filter only when some, not all, are ranked', () => {
    expect(render([row()])).not.toContain('Ranked by QS');
    expect(render([row(), row({ id: 'u2', qsRanking: 5 })])).toContain('Ranked by QS');
  });

  it('notes what the catalogue is under every list', () => {
    expect(render([row()])).toContain(
      'Only universities with a published Universta profile are listed.',
    );
  });
});

/**
 * Found by emptying the production catalogue and looking at the page.
 *
 * Both filter groups are built from the catalogue, so an empty one offers
 * nothing to narrow by — and the panel rendered anyway, a titled box framing
 * the absence of its own contents. The empty message, meanwhile, told a
 * reader to clear a filter they had not set.
 */
describe('the directory with nothing in it', () => {
  it('stands the filter panel down when there is nothing to narrow by', () => {
    const html = render([]);
    expect(html).not.toContain('filters-panel');
    expect(html).not.toContain('filters-toggle');
  });

  it('says what is actually true of an empty catalogue', () => {
    const html = render([]);
    expect(html).toContain('No university is published yet');
    expect(html).not.toContain('clear the filters');
  });

  it('keeps the panel the moment there is one destination to offer', () => {
    expect(render([row()])).toContain('filters-panel');
  });

  it('does not offer to clear a filter nobody has set', () => {
    const html = render([row({ name: 'Aalto' })]);
    expect(html).not.toContain('Clear all');
    expect(html).not.toContain('Clear filters');
  });
});

/**
 * A search for something that is not there used to leave a sentence and no
 * way out: nothing on the page could clear the search.
 */
describe('clearing what the reader set', () => {
  it('offers to clear a search that found nothing', () => {
    nav.search = 'q=qzxwv';
    const html = render([row()]);
    expect(html).toContain('0 universities');
    expect(html).toContain('Try a shorter name, or clear the filters.');
    expect(html).toMatch(/<a class="btn btn--sm btn--ghost" href="\/universities">Clear filters<\/a>/);
    expect(html).not.toContain('Load more');
  });

  it('shows “Clear all” for a search alone, not only for a ticked box', () => {
    nav.search = 'q=aalborg';
    expect(render([row(), row({ id: 'u2', institutionType: 'PRIVATE' })])).toMatch(
      /<a class="linkbtn" href="\/universities">Clear all<\/a>/,
    );
  });
});

/**
 * A destination's own list is the same list with the destination fixed.
 */
describe('one destination’s list', () => {
  const uk = { slug: 'united-kingdom', name: 'the United Kingdom' };
  const ukRows = () => [
    row({
      id: 'o',
      name: 'University of Oxford',
      city: 'Oxford',
      cities: ['Oxford'],
      country: { name: 'United Kingdom', slug: 'united-kingdom', iso2Code: 'GB' },
    }),
    row({
      id: 'l',
      name: 'Imperial College London',
      city: 'London',
      cities: ['London'],
      country: { name: 'United Kingdom', slug: 'united-kingdom', iso2Code: 'GB' },
    }),
  ];

  beforeEach(() => {
    nav.path = '/study-abroad/united-kingdom/universities';
  });

  it('does not offer the destination again, and offers its cities from the start', () => {
    const html = render(ukRows(), { country: uk });
    expect(html).not.toContain('>Destination<');
    expect(html).toContain('>City<');
    expect(html).toContain('Universities in the United Kingdom');
  });

  it('keeps its own address when the reader clears a search', () => {
    nav.search = 'q=qzxwv';
    expect(render(ukRows(), { country: uk })).toContain(
      'href="/study-abroad/united-kingdom/universities">Clear filters',
    );
  });

  it('drops the country-guide button every card would share', () => {
    expect(render(ukRows(), { country: uk })).not.toContain('United Kingdom guide');
    expect(render(ukRows())).toContain('United Kingdom guide');
  });

  it('says the destination has none published when it has none', () => {
    expect(render([], { country: uk })).toContain(
      'No university in the United Kingdom is published yet.',
    );
  });
});
