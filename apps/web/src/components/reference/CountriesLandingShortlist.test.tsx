import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// The listing reads the router to build filter links; static rendering only
// needs those hooks to exist.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined }),
  usePathname: () => '/countries',
  useSearchParams: () => new URLSearchParams(''),
}));
import { CountriesReference, type CountriesReferenceProps } from './CountriesReference';
import type { Country } from '@/lib/countries';

/**
 * The destinations page is a shortlist by default and the whole catalogue at
 * `?view=all`. It is one page either way, so the cards, the filter drawer, the
 * sort and the counts are the same in both -- the only differences are how many
 * cards are on screen and whether there is an invitation to see the rest.
 *
 * The count always describes what matched, never what fitted: "6 of 14" is the
 * point of the shortlist.
 */
function country(name: string, slug: string): Country {
  return {
    id: slug,
    name,
    slug,
    pageHeading: `Study in ${name}`,
    shortDescription: `About ${name}.`,
    continent: { id: 'e1', name: 'Europe', slug: 'europe' },
    flag: null,
    listingImage: null,
    heroImage: null,
    featured: false,
    displayOrder: 0,
    statistics: null,
  } as Country;
}

const many = (count: number) =>
  Array.from({ length: count }, (_, index) => country(`Country ${index}`, `country-${index}`));

function build(over: Partial<CountriesReferenceProps> = {}): CountriesReferenceProps {
  return {
    countries: many(6),
    meta: { page: 1, limit: 6, total: 14, totalPages: 3 },
    continents: [{ id: 'e1', name: 'Europe', slug: 'europe', count: 14 }],
    directory: [],
    directoryMeta: { page: 1, limit: 12, total: 0, totalPages: 0 },
    consultants: [],
    filters: {},
    filterOptions: { subjects: [], intakes: [], currencies: [] },
    content: {},
    landingLimit: 6,
    showingAll: false,
    ...over,
  } as CountriesReferenceProps;
}

const cardCount = (html: string) => html.split('class="ccard"').length - 1;

describe('destinations shortlist', () => {
  it('shows no more than six cards, whatever the catalogue holds', () => {
    const html = renderToStaticMarkup(<CountriesReference {...build()} />);
    expect(cardCount(html)).toBe(6);
  });

  it('counts everything that matched, not the six on screen', () => {
    const html = renderToStaticMarkup(<CountriesReference {...build()} />);
    expect(html).toContain('Showing 6 of 14 destinations');
  });

  it('offers the rest of the catalogue when there is more than six', () => {
    const html = renderToStaticMarkup(<CountriesReference {...build()} />);
    expect(html).toContain('data-testid="country-view-all"');
    expect(html).toContain('View all destinations');
  });

  it('does not invite a visitor to see six when six is all there is', () => {
    const html = renderToStaticMarkup(
      <CountriesReference
        {...build({ meta: { page: 1, limit: 6, total: 6, totalPages: 1 } })}
      />,
    );
    expect(cardCount(html)).toBe(6);
    expect(html).not.toContain('data-testid="country-view-all"');
  });

  it('shows fewer than six without offering more', () => {
    const html = renderToStaticMarkup(
      <CountriesReference
        {...build({
          countries: many(3),
          meta: { page: 1, limit: 6, total: 3, totalPages: 1 },
        })}
      />,
    );
    expect(cardCount(html)).toBe(3);
    expect(html).not.toContain('data-testid="country-view-all"');
  });

  it('carries the active filters and sort into the full catalogue', () => {
    const html = renderToStaticMarkup(
      <CountriesReference
        {...build({ filters: { region: 'europe', sort: 'name', budgetBand: 'LOW', page: '2' } })}
      />,
    );
    /* The listing lives at the homepage; /countries only redirects now. */
    const href = html.match(/href="(\/\?[^"]*view=all[^"]*)"/)?.[1] ?? '';
    expect(href).toContain('region=europe');
    expect(href).toContain('sort=name');
    expect(href).toContain('budgetBand=LOW');
    expect(href).toContain('view=all');
    // The page number belongs to the shortlist, not to the catalogue behind it.
    expect(href).not.toContain('page=2');
  });

  it('does not paginate, because the full catalogue is the way through', () => {
    const html = renderToStaticMarkup(<CountriesReference {...build()} />);
    expect(html).not.toContain('aria-label="Country results pages"');
  });

  it('still offers a way back when a URL asks for a page that does not exist', () => {
    // Without this the shortlist strands a visitor on an empty list: no cards,
    // and nothing to click to get back to the first page.
    const html = renderToStaticMarkup(
      <CountriesReference
        {...build({ countries: [], meta: { page: 2, limit: 6, total: 3, totalPages: 1 } })}
      />,
    );
    expect(html).toContain('aria-label="Country results pages"');
    expect(html).toContain('Previous');
  });

  it('keeps the empty state when nothing matched', () => {
    const html = renderToStaticMarkup(
      <CountriesReference
        {...build({ countries: [], meta: { page: 1, limit: 6, total: 0, totalPages: 0 } })}
      />,
    );
    expect(html).toContain('data-testid="country-empty"');
    expect(html).not.toContain('data-testid="country-view-all"');
  });
});

describe('full destination catalogue', () => {
  const all = build({
    showingAll: true,
    countries: many(14),
    meta: { page: 1, limit: 100, total: 14, totalPages: 1 },
  });

  it('shows every matching destination', () => {
    const html = renderToStaticMarkup(<CountriesReference {...all} />);
    expect(cardCount(html)).toBe(14);
    expect(html).toContain('Showing 14 of 14 destinations');
  });

  it('stops offering a way through, because this is the way through', () => {
    const html = renderToStaticMarkup(<CountriesReference {...all} />);
    expect(html).not.toContain('data-testid="country-view-all"');
  });

  it('reuses the same filter drawer, chips and sort rather than a second set', () => {
    const shortlist = renderToStaticMarkup(
      <CountriesReference {...build({ filters: { region: 'europe' } })} />,
    );
    const full = renderToStaticMarkup(
      <CountriesReference
        {...build({ showingAll: true, countries: many(14), filters: { region: 'europe' } })}
      />,
    );
    // The drawer, the sort control, the region tabs and the count line are one
    // implementation used by both views, not two that have to be kept in step.
    for (const marker of ['country-apply', 'country-sort', 'country-count', 'class="tabs"']) {
      expect(shortlist).toContain(marker);
      expect(full).toContain(marker);
    }
    // And the region tab carries the catalogue's count in both, not the page's.
    expect(shortlist).toContain('Europe <span class="n">14</span>');
    expect(full).toContain('Europe <span class="n">14</span>');
  });
});

describe('country card stat strip', () => {
  const withCost = (over: Record<string, unknown>) =>
    ({
      ...country('Testland', 'testland'),
      profiles: {
        cost: {
          currencyCode: 'EUR',
          tuitionMin: '10000',
          tuitionMax: '30000',
          tuitionPeriod: 'PER_YEAR',
          ...over,
        },
      },
    }) as unknown as Country;

  it('renders all three cells so one missing stat cannot shorten a card', () => {
    const html = renderToStaticMarkup(
      <CountriesReference
        {...build({
          countries: [withCost({})],
          meta: { page: 1, limit: 6, total: 1, totalPages: 1 },
        })}
      />,
    );
    expect(html.split('class="f"').length - 1).toBe(3);
    expect(html).toContain('Tuition');
    expect(html).toContain('Post-study work');
    expect(html).toContain('Intakes');
    // The two this country has not published say so, rather than collapsing.
    expect(html.split('class="f-none"').length - 1).toBe(2);
  });

  it('puts the currency and period beside the value, not inside the label', () => {
    const html = renderToStaticMarkup(
      <CountriesReference
        {...build({
          countries: [withCost({})],
          meta: { page: 1, limit: 6, total: 1, totalPages: 1 },
        })}
      />,
    );
    expect(html).toContain('<em class="f-u">EUR/yr</em>');
    // The old label read "Tuition (EUR/yr)", which wrapped differently on
    // every card and left the strip ragged across the row.
    expect(html).not.toContain('(EUR/yr)');
  });

  it('leaves the strip off entirely for a country with no published stats', () => {
    const html = renderToStaticMarkup(
      <CountriesReference
        {...build({
          countries: [country('Blankland', 'blankland')],
          meta: { page: 1, limit: 6, total: 1, totalPages: 1 },
        })}
      />,
    );
    expect(html).not.toContain('data-testid="country-stats"');
  });
});
