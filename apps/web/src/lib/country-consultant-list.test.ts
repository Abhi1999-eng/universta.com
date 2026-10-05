import { describe, expect, it } from 'vitest';
import {
  activeConsultantFilters,
  consultantListHref,
  consultantOptions,
  countryConsultantsHref,
  filterConsultants,
  isNarrowedConsultantList,
  narrowsConsultants,
  readConsultantState,
  toConsultantRow,
  toConsultantRows,
  type ConsultantListState,
} from './country-consultant-list';

const location = (city: string | null) => ({ location: { city } });

const record = (over: Record<string, unknown> = {}) => ({
  id: 'c1',
  name: 'Lindenhall Global Admissions',
  slug: 'lindenhall',
  shortDescription: 'Counsels students on studying abroad.',
  verificationStatus: 'VERIFIED',
  verifiedAt: '2026-10-01T00:00:00Z',
  locations: [location('New Delhi'), location('Pune'), location('new delhi'), location(null)],
  services: [
    { name: 'Visa guidance', slug: 'visa-guidance' },
    { name: 'Course selection', slug: 'course-selection' },
  ],
  languages: [{ name: 'Hindi', code: 'HI' }],
  countries: [
    { country: { name: 'Belize', slug: 'belize' } },
    { country: { name: 'United Kingdom', slug: 'united-kingdom' } },
  ],
  /* Contact details are on the record but never reach a card. */
  email: 'hello@example.invalid',
  phone: '+91 90000 00000',
  ...over,
});

const rows = toConsultantRows([
  record(),
  record({
    id: 'c2',
    name: 'Silverbeck Student Partners',
    slug: 'silverbeck',
    verifiedAt: '2026-10-03T00:00:00Z',
    locations: [location('Adelaide')],
    services: [{ name: 'Visa guidance', slug: 'visa-guidance' }],
    languages: [{ name: 'English', code: 'EN' }],
  }),
  record({
    id: 'c3',
    name: 'Ashgrove Advisers',
    slug: 'ashgrove',
    verificationStatus: 'PENDING',
    verifiedAt: null,
    locations: [location('Pune')],
    services: [],
    languages: [],
  }),
  /* No slug, no profile to open: no card. */
  record({ id: 'c4', slug: '' }),
]);

const state = (over: Partial<ConsultantListState> = {}): ConsultantListState => ({
  q: '',
  cities: [],
  services: [],
  languages: [],
  verified: false,
  sort: 'recommended',
  page: 1,
  ...over,
});

const names = (list: { name: string }[]) => list.map((row) => row.name);

describe('a destination\'s consultants page', () => {
  it('lives under the destination', () => {
    expect(countryConsultantsHref('united-kingdom')).toBe(
      '/study-abroad/united-kingdom/consultants',
    );
  });

  it('reads a list row as the card needs it, and nothing it should not show', () => {
    const row = toConsultantRow(record());
    expect(row).toMatchObject({
      name: 'Lindenhall Global Admissions',
      slug: 'lindenhall',
      verified: true,
      /* The same city twice is one city, in the order the record lists. */
      cities: ['New Delhi', 'Pune'],
      languages: [{ code: 'HI', name: 'Hindi' }],
      destinations: [
        { slug: 'belize', name: 'Belize' },
        { slug: 'united-kingdom', name: 'United Kingdom' },
      ],
    });
    expect(JSON.stringify(row)).not.toContain('example.invalid');
    expect(JSON.stringify(row)).not.toContain('90000');
  });

  it('drops a row with no profile to open', () => {
    expect(names(rows)).toEqual([
      'Lindenhall Global Admissions',
      'Silverbeck Student Partners',
      'Ashgrove Advisers',
    ]);
    expect(toConsultantRow(null)).toBeNull();
  });

  it('dates a verification only when the record is verified', () => {
    expect(rows[2]?.verified).toBe(false);
    expect(rows[2]?.verifiedAt).toBeNull();
  });
});

describe('the consultants list state', () => {
  it('reads a city by name or by key, as the guide\'s old links carried it', () => {
    expect(readConsultantState(new URLSearchParams('city=New Delhi')).cities).toEqual(['new-delhi']);
    expect(readConsultantState(new URLSearchParams('city=new-delhi,Pune')).cities).toEqual([
      'new-delhi',
      'pune',
    ]);
  });

  it('writes a state back to the same address, leaving the defaults out', () => {
    const path = '/study-abroad/united-kingdom/consultants';
    expect(consultantListHref(path, state())).toBe(path);
    const href = consultantListHref(path, state({ cities: ['pune'], verified: true, sort: 'name-asc' }));
    expect(href).toBe(`${path}?city=pune&verified=true&sort=name-asc`);
    expect(readConsultantState(new URL(href, 'http://x').searchParams)).toEqual(
      state({ cities: ['pune'], verified: true, sort: 'name-asc' }),
    );
  });

  it('keeps a searched or filtered view out of the index', () => {
    expect(isNarrowedConsultantList({})).toBe(false);
    expect(isNarrowedConsultantList({ city: 'pune' })).toBe(true);
  });

  it('counts the filters ticked', () => {
    expect(activeConsultantFilters(state({ cities: ['a'], services: ['b'], verified: true }))).toBe(3);
  });
});

describe('what the consultants list can be narrowed by', () => {
  const options = consultantOptions(rows);

  it('counts each city, service and language over the consultants here', () => {
    expect(options.cities).toEqual([
      { value: 'pune', label: 'Pune', count: 2 },
      { value: 'adelaide', label: 'Adelaide', count: 1 },
      { value: 'new-delhi', label: 'New Delhi', count: 1 },
    ]);
    expect(options.services[0]).toEqual({ value: 'visa-guidance', label: 'Visa guidance', count: 2 });
    expect(options.verified).toBe(2);
  });

  it('does not offer a filter every consultant already satisfies', () => {
    expect(narrowsConsultants([{ value: 'a', label: 'A', count: 3 }], 3)).toBe(false);
    expect(narrowsConsultants(options.cities, 3)).toBe(true);
  });
});

describe('filterConsultants', () => {
  it('searches the name, the cities and the services', () => {
    expect(names(filterConsultants(rows, state({ q: 'adelaide' })))).toEqual([
      'Silverbeck Student Partners',
    ]);
    expect(names(filterConsultants(rows, state({ q: 'visa' })))).toHaveLength(2);
  });

  it('narrows by city, service, language and verification', () => {
    expect(names(filterConsultants(rows, state({ cities: ['pune'] })))).toEqual([
      'Lindenhall Global Admissions',
      'Ashgrove Advisers',
    ]);
    expect(filterConsultants(rows, state({ services: ['course-selection'] }))).toHaveLength(1);
    expect(filterConsultants(rows, state({ languages: ['en'] }))).toHaveLength(1);
    expect(names(filterConsultants(rows, state({ verified: true })))).not.toContain(
      'Ashgrove Advisers',
    );
  });

  it('keeps the catalogue order as recommended, and sorts on request', () => {
    expect(names(filterConsultants(rows, state()))).toEqual(names(rows));
    expect(names(filterConsultants(rows, state({ sort: 'name-asc' })))[0]).toBe('Ashgrove Advisers');
    /* The latest verification first; the unverified last. */
    expect(names(filterConsultants(rows, state({ sort: 'verified' })))).toEqual([
      'Silverbeck Student Partners',
      'Lindenhall Global Admissions',
      'Ashgrove Advisers',
    ]);
  });
});
