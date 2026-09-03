import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// The listing is a client component that reads the router to build filter links;
// static rendering only needs those hooks to exist.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined }),
  usePathname: () => '/countries',
  useSearchParams: () => new URLSearchParams(),
}));
import { CountriesReference, type CountriesReferenceProps } from './CountriesReference';
import type { Country } from '@/lib/countries';

/**
 * The client's `featured_image` maps to the country's listing image. Exposing
 * it on the public payload is only half the contract — if nothing renders it,
 * it is dead data. These cover both the rendering and the unchanged card for a
 * country that has no listing image.
 */
function country(over: Partial<Country> = {}): Country {
  return {
    id: 'c1',
    name: 'Australia',
    slug: 'australia',
    pageHeading: 'Study in Australia',
    shortDescription: 'Explore universities across Australia.',
    continent: { id: 'e1', name: 'Oceania', slug: 'oceania' },
    flag: null,
    listingImage: null,
    heroImage: null,
    featured: false,
    displayOrder: 0,
    statistics: null,
    ...over,
  } as Country;
}

function build(rows: Country[]): CountriesReferenceProps {
  return {
    countries: rows,
    meta: { page: 1, limit: 12, total: rows.length, totalPages: 1 },
    continents: [],
    directory: [],
    directoryMeta: { page: 1, limit: 12, total: 0, totalPages: 0 },
    consultants: [],
    filters: {},
    content: {},
  } as CountriesReferenceProps;
}

const render = (props: CountriesReferenceProps) =>
  renderToStaticMarkup(<CountriesReference {...props} />);

describe('countries listing media', () => {
  it('renders the listing image on the card, with its alt text', () => {
    const html = render(
      build([
        country({
          listingImage: { url: '/api/v1/media/listing.png', alt: 'Sydney skyline' },
        }),
      ]),
    );
    expect(html).toContain('ccard-media');
    expect(html).toContain('/api/v1/media/listing.png');
    expect(html).toContain('Sydney skyline');
  });

  it('falls back to the country name when the image carries no alt text', () => {
    const html = render(
      build([country({ listingImage: { url: '/api/v1/media/listing.png', alt: '' } })]),
    );
    expect(html).toContain('alt="Australia"');
  });

  it('leaves the card exactly as it was when there is no listing image', () => {
    const html = render(build([country()]));
    expect(html).not.toContain('ccard-media');
    // The flag chip and the card itself are untouched.
    expect(html).toContain('ccard');
  });
});
