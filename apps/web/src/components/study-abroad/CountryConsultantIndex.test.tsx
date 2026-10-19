import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/* The lists read their state from the address. */
const address = vi.hoisted(() => ({ path: '/study-abroad-consultants', search: '' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined }),
  usePathname: () => address.path,
  useSearchParams: () => new URLSearchParams(address.search),
}));

import { toConsultantRows } from '@/lib/country-consultant-list';
import { ConsultantCard, CountryConsultantIndex } from './CountryConsultantIndex';

beforeEach(() => {
  address.path = '/study-abroad-consultants';
  address.search = '';
});

const rows = toConsultantRows([
  {
    id: 'c1',
    name: 'Lindenhall Global Admissions',
    slug: 'lindenhall',
    verificationStatus: 'VERIFIED',
    locations: [{ location: { city: 'Pune' } }],
    services: [{ name: 'Visa documentation', slug: 'visa-documentation' }],
    languages: [{ name: 'Hindi', code: 'hi' }],
    countries: [{ country: { name: 'Japan', slug: 'japan' } }],
  },
  {
    id: 'c2',
    name: 'Ashgrove Advisers',
    slug: 'ashgrove',
    verificationStatus: 'PENDING',
    locations: [{ location: { city: 'Delhi' } }],
    services: [],
    languages: [],
    countries: [],
  },
]);

const hrefs = (html: string) => [...html.matchAll(/href="([^"]*counselling[^"]*)"/g)].map((match) => match[1]!.replace(/&amp;/g, '&'));

describe('the "Compare" tick on a consultant card', () => {
  it('is on every card of a consultants list that asks for it', () => {
    const html = renderToStaticMarkup(
      <CountryConsultantIndex rows={rows} countrySlug="" where="any destination" byDestination compare />,
    );
    expect(html.match(/class="tinycheck"/g)).toHaveLength(2);
    expect(html).toContain('aria-label="Compare Lindenhall Global Admissions"');
  });

  it('is left off where it is not asked for, as on a subject\'s level page', () => {
    expect(renderToStaticMarkup(<ConsultantCard consultant={rows[0]!} countrySlug="" />)).not.toContain('tinycheck');
    expect(
      renderToStaticMarkup(<CountryConsultantIndex rows={rows} countrySlug="" where="any destination" />),
    ).not.toContain('tinycheck');
  });
});

describe('"Get guidance" on a consultant card', () => {
  it('records the directory as the page the request came from', () => {
    const html = renderToStaticMarkup(
      <CountryConsultantIndex rows={rows} countrySlug="" where="any destination" byDestination />,
    );
    const links = hrefs(html);
    expect(links).toHaveLength(2);
    expect(new Set(links)).toEqual(new Set(['/counselling?source=general&from=%2Fstudy-abroad-consultants']));
    expect(html).not.toContain('%2Fstudy-abroad%2F%2Fconsultants');
  });

  it('records a city\'s page as the page the request came from', () => {
    address.path = '/study-abroad-consultants/locations/pune-advisory-centre';
    const html = renderToStaticMarkup(
      <CountryConsultantIndex rows={rows} countrySlug="" where="Pune" byDestination />,
    );
    expect(hrefs(html)[0]).toBe(
      '/counselling?source=general&from=%2Fstudy-abroad-consultants%2Flocations%2Fpune-advisory-centre',
    );
  });

  it('still asks about the destination on a destination\'s consultants page', () => {
    address.path = '/study-abroad/japan/consultants';
    const html = renderToStaticMarkup(
      <CountryConsultantIndex rows={rows.slice(0, 1)} countrySlug="japan" where="Japan" />,
    );
    expect(hrefs(html)[0]).toBe('/counselling?source=country&country=japan&from=%2Fstudy-abroad%2Fjapan%2Fconsultants');
  });

  it('never builds a destination page with no destination in it', () => {
    const html = renderToStaticMarkup(<ConsultantCard consultant={rows[0]!} countrySlug="" />);
    expect(hrefs(html)).toEqual(['/counselling?source=general']);
  });
});

describe('a consultant card\'s logo', () => {
  const [withLogo] = toConsultantRows([
    { id: 'c3', name: 'Logo Advisers', slug: 'logo', featuredMedia: { id: 'm', publicUrl: '/media/logo.png', altText: null, title: null } },
  ]);

  it('is drawn beside the name where the page asks for it and the record has an image', () => {
    const html = renderToStaticMarkup(<ConsultantCard consultant={withLogo!} countrySlug="" logo />);
    expect(html).toContain('<div class="consultcard__id"><img class="conslogo" src="/media/logo.png" alt=""');
    const index = renderToStaticMarkup(
      <CountryConsultantIndex rows={[withLogo!, ...rows]} countrySlug="" where="any destination" byDestination logos />,
    );
    expect(index.match(/class="conslogo"/g)).toHaveLength(1);
  });

  it('is never drawn where the page does not ask, as on a level page, nor for a record without one', () => {
    expect(renderToStaticMarkup(<ConsultantCard consultant={withLogo!} countrySlug="" />)).not.toContain('<img');
    expect(renderToStaticMarkup(<ConsultantCard consultant={rows[0]!} countrySlug="" logo />)).not.toContain('<img');
  });
});
