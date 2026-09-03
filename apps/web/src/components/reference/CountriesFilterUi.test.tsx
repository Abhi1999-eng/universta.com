import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// The listing reads the router to build filter links; static rendering only
// needs those hooks to exist.
let search = '';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined }),
  usePathname: () => '/countries',
  useSearchParams: () => new URLSearchParams(search),
}));
import { CountriesReference, type CountriesReferenceProps } from './CountriesReference';
import type { Country } from '@/lib/countries';

/**
 * What the filter experience puts on the page: the grouped drawer, the chips
 * that say what is narrowing the results, the count, and the way out when
 * nothing matches. The rules behind the URL are covered separately in
 * country-filters.test.ts.
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

function build(over: Partial<CountriesReferenceProps> = {}): CountriesReferenceProps {
  return {
    countries: [country('Poland', 'poland'), country('Sweden', 'sweden')],
    meta: { page: 1, limit: 12, total: 2, totalPages: 1 },
    continents: [
      { id: 'e1', name: 'Europe', slug: 'europe', count: 2 },
      { id: 'e2', name: 'Asia', slug: 'asia', count: 1 },
    ],
    directory: [],
    directoryMeta: { page: 1, limit: 12, total: 0, totalPages: 0 },
    consultants: [],
    filters: {},
    filterOptions: {
      subjects: [
        { name: 'Engineering', slug: 'engineering', count: 7 },
        { name: 'Nursing', slug: 'nursing', count: 3 },
      ],
      intakes: [{ name: 'September', slug: 'september', count: 10 }],
      currencies: [{ code: 'EUR', count: 4 }, { code: 'SEK', count: 1 }],
    },
    content: {},
    ...over,
  } as CountriesReferenceProps;
}

const render = (props: CountriesReferenceProps) =>
  renderToStaticMarkup(<CountriesReference {...props} />);

describe('countries filter interface', () => {
  it('keeps the region pills and their counts', () => {
    const html = render(build());
    expect(html).toContain('Europe');
    expect(html).toContain('Asia');
    expect(html).toContain('>2<');
  });

  it('groups the filters under Study, Work and visa, and Destination', () => {
    const html = render(build());
    for (const group of ['Study', 'Work and visa', 'Destination'])
      expect(html).toContain(`<legend>${group}</legend>`);
  });

  it('offers only the subjects, intakes and currencies the data can answer', () => {
    const html = render(build());
    expect(html).toContain('Engineering');
    expect(html).toContain('Nursing');
    expect(html).toContain('September');
    expect(html).toContain('EUR');
    expect(html).toContain('SEK');
  });

  it('says so when nothing is assigned yet, rather than showing an empty box', () => {
    const html = render(
      build({ filterOptions: { subjects: [], intakes: [], currencies: [] } }),
    );
    expect(html).toContain('No subjects are assigned yet.');
    expect(html).toContain('No intakes are published yet.');
  });

  it('locks the amount inputs until a currency scopes them', () => {
    const html = render(build());
    expect(html).toContain('disabled');
    expect(html).toContain('Choose a currency');
    expect(html).toContain('publish tuition in their own currency');
  });

  it('unlocks them once a currency is chosen', () => {
    search = 'currency=EUR';
    const html = render(build({ filters: { currency: 'EUR' } }));
    expect(html).not.toContain('Choose a currency');
    search = '';
  });

  it('offers the four sorts', () => {
    const html = render(build());
    for (const label of [
      'Recommended',
      'Tuition: low to high',
      'Living cost: low to high',
      'Most universities',
    ])
      expect(html).toContain(label);
  });

  it('shows a chip for each applied filter', () => {
    const html = render(
      build({
        filters: {
          subjects: 'engineering',
          intakes: 'september',
          ieltsMax: '6.5',
          postStudyWork: 'true',
        },
      }),
    );
    expect(html).toContain('country-chips');
    expect(html).toContain('Engineering');
    expect(html).toContain('September intake');
    expect(html).toContain('IELTS ≤ 6.5');
    expect(html).toContain('Post-study work');
  });

  it('shows no chip row when nothing is applied', () => {
    expect(render(build())).not.toContain('country-chips');
  });

  it('badges the Filters button with how many are applied', () => {
    const html = render(
      build({ filters: { subjects: 'engineering,nursing', ieltsMax: '6.5' } }),
    );
    expect(html).toContain('Filters (3)');
  });

  it('reports how many destinations matched', () => {
    const html = render(
      build({
        countries: [country('Poland', 'poland')],
        meta: { page: 1, limit: 12, total: 9, totalPages: 1 },
      }),
    );
    expect(html).toContain('Showing 1 of 9 destinations');
  });

  it('offers a way out when nothing matches', () => {
    const html = render(
      build({
        countries: [],
        meta: { page: 1, limit: 12, total: 0, totalPages: 0 },
        filters: { subjects: 'engineering' },
      }),
    );
    expect(html).toContain('country-empty');
    expect(html).toContain('No destinations match these filters');
    expect(html).toContain('href="/countries"');
  });

  it('labels the drawer and its controls for assistive technology', () => {
    const html = render(build());
    expect(html).toContain('aria-label="Destination filters"');
    expect(html).toContain('aria-label="Search subjects"');
    expect(html).toContain('aria-labelledby="filt-subjects-label"');
    expect(html).toContain('aria-controls="country-filter-panel"');
    // Checkboxes are checkboxes, not divs pretending to be them.
    expect(html).toContain('type="checkbox"');
  });

  it('never offers an Admin tag as a public filter', () => {
    const html = render(build());
    expect(html).not.toContain('tagId');
    expect(html).not.toContain('>Tags<');
  });
});
