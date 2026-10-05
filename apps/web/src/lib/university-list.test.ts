import { describe, expect, it } from 'vitest';
import {
  activeFilterCount,
  cityKey,
  effectiveFilters,
  filterUniversities,
  isNarrowedList,
  listHref,
  listOptions,
  readListState,
  settleListState,
  toUniversityListRow,
  type UniversityListRow,
} from './university-list';

const row = (over: Partial<UniversityListRow> = {}): UniversityListRow => ({
  id: 'u1',
  name: 'Aalborg University',
  slug: 'aalborg-university',
  shortDescription: null,
  institutionType: 'Public',
  qsRanking: null,
  totalStudents: null,
  internationalStudentsPercent: null,
  programmes: 1,
  campuses: 1,
  city: 'Aalborg',
  cities: ['Aalborg'],
  country: { name: 'Denmark', slug: 'denmark', iso2Code: 'DK' },
  subjects: [],
  ...over,
});

describe('a list’s address', () => {
  it('leaves every default out, so the plain list is its bare path', () => {
    expect(listHref('/universities', readListState(new URLSearchParams()))).toBe(
      '/universities',
    );
  });

  it('reads back what it writes', () => {
    const href = listHref('/universities', {
      q: 'tech',
      countries: ['germany', 'france'],
      types: ['Public'],
      cities: ['new-delhi'],
      subjects: ['law'],
      ranked: true,
      sort: 'programs',
      page: 3,
    });
    expect(href).toBe(
      '/universities?q=tech&country=germany%2Cfrance&type=Public&city=new-delhi&subject=law&ranking=ranked&sort=programs&page=3',
    );
    const state = readListState(new URLSearchParams(href.split('?')[1]));
    expect(state).toEqual({
      q: 'tech',
      countries: ['germany', 'france'],
      types: ['Public'],
      cities: ['new-delhi'],
      subjects: ['law'],
      ranked: true,
      sort: 'programs',
      page: 3,
    });
  });

  it('opens ranked first, on the first step, whatever junk it is handed', () => {
    const state = readListState(new URLSearchParams('sort=cheapest&page=-4&ranking=yes'));
    expect(state.sort).toBe('ranking');
    expect(state.page).toBe(1);
    expect(state.ranked).toBe(false);
  });

  it('knows a narrowed view from the plain list, for the robots rule', () => {
    expect(isNarrowedList({})).toBe(false);
    expect(isNarrowedList({ utm_source: 'mail' })).toBe(false);
    expect(isNarrowedList({ q: 'oxford' })).toBe(true);
    expect(isNarrowedList({ page: '2' })).toBe(true);
    expect(isNarrowedList({ country: ['germany', 'france'] })).toBe(true);
  });

  it('carries a city in the address as a slug', () => {
    expect(cityKey('New Delhi')).toBe('new-delhi');
    expect(cityKey('Zürich')).toBe('zurich');
    expect(cityKey("St. John's")).toBe('st-john-s');
  });
});

describe('a row from the list endpoint', () => {
  const api = {
    id: 'u1',
    name: 'University of Toronto',
    slug: 'university-of-toronto',
    shortDescription: '  ',
    institutionType: 'Public',
    qsRanking: 0,
    totalStudents: 97000,
    internationalStudentsPercent: '27.50',
    country: { name: 'Canada', slug: 'canada', iso2Code: 'CA' },
    campuses: [
      { id: 'c1', city: 'Toronto' },
      { id: 'c2', city: 'Mississauga' },
      { id: 'c3', city: 'Toronto' },
      { id: 'c4', city: null },
    ],
    subjects: [
      { name: 'Engineering', slug: 'engineering', offerings: 4 },
      { name: 'Law', slug: 'law', offerings: 1 },
    ],
    _count: { offerings: 5 },
    overview: '<p>Long text the list never shows.</p>',
  };

  it('keeps what a card prints and a filter reads', () => {
    const mapped = toUniversityListRow(api);
    expect(mapped).toMatchObject({
      name: 'University of Toronto',
      programmes: 5,
      campuses: 4,
      city: 'Toronto',
      cities: ['Toronto', 'Mississauga'],
      totalStudents: 97000,
      internationalStudentsPercent: 27.5,
      country: { name: 'Canada', slug: 'canada', iso2Code: 'CA' },
      subjects: [
        { slug: 'engineering', name: 'Engineering' },
        { slug: 'law', name: 'Law' },
      ],
    });
    expect(mapped).not.toHaveProperty('overview');
  });

  it('does not take a blank or a zero for a value', () => {
    const mapped = toUniversityListRow(api);
    expect(mapped.shortDescription).toBeNull();
    /* No university is ranked 0th; a zero is a missing rank. */
    expect(mapped.qsRanking).toBeNull();
  });

  it('copes with a row from before the list carried cities and subjects', () => {
    const mapped = toUniversityListRow({
      id: 'u2',
      name: 'Old',
      slug: 'old',
      campuses: [{ id: 'c1' }],
    });
    expect(mapped.city).toBeNull();
    expect(mapped.cities).toEqual([]);
    expect(mapped.subjects).toEqual([]);
    expect(mapped.campuses).toBe(1);
  });
});

describe('the options a list offers', () => {
  const rows = [
    row(),
    row({ id: 'u2', city: 'Copenhagen', cities: ['Copenhagen'] }),
    row({
      id: 'u3',
      country: { name: 'Germany', slug: 'germany', iso2Code: 'DE' },
      city: 'Berlin',
      cities: ['Berlin', 'Potsdam'],
      institutionType: 'Private',
    }),
  ];

  it('counts each destination across the whole list', () => {
    const options = listOptions(rows, ['germany']);
    expect(options.destinations).toEqual([
      { value: 'denmark', label: 'Denmark', count: 2 },
      { value: 'germany', label: 'Germany', count: 1 },
    ]);
  });

  it('counts everything else inside the chosen destination', () => {
    const options = listOptions(rows, ['germany']);
    expect(options.cities.map((option) => option.label)).toEqual(['Berlin', 'Potsdam']);
    expect(options.types).toEqual([{ value: 'Private', label: 'Private', count: 1 }]);
  });

  it('counts a university once per city, however many campuses share it', () => {
    const options = listOptions(
      [row({ cities: ['Toronto', 'Toronto'] })],
      [],
    );
    expect(options.cities).toEqual([{ value: 'toronto', label: 'Toronto', count: 1 }]);
  });

  it('lets go of a city its destination no longer offers', () => {
    const state = readListState(new URLSearchParams('country=denmark&city=berlin,aalborg'));
    const filters = effectiveFilters(state, listOptions(rows, state.countries));
    expect(filters.cities).toEqual(['aalborg']);
    expect(activeFilterCount(filters)).toBe(2);
  });
});

/**
 * Ticking a destination, then a city, then unticking the destination left
 * the city in the address, still narrowing the list, with the City group
 * gone from the panel.
 */
describe('a change a reader makes, settled', () => {
  const rows = [
    row(),
    row({
      id: 'u2',
      country: { name: 'United Kingdom', slug: 'united-kingdom', iso2Code: 'GB' },
      city: 'London',
      cities: ['London'],
    }),
  ];
  const state = (search: string) => readListState(new URLSearchParams(search));

  it('lets go of the cities when the last destination is unticked', () => {
    const before = state('country=united-kingdom&city=london');
    const settled = settleListState(rows, before, { ...before, countries: [] });
    expect(settled.countries).toEqual([]);
    expect(settled.cities).toEqual([]);
    expect(listHref('/universities', settled)).toBe('/universities');
  });

  it('keeps a city that still has its destination', () => {
    const before = state('country=united-kingdom&city=london');
    const settled = settleListState(rows, before, {
      ...before,
      countries: ['united-kingdom', 'denmark'],
    });
    expect(settled.cities).toEqual(['london']);
  });

  it('leaves a city alone when no destination was ticked to begin with', () => {
    /* A shared `?city=london` link: the reader ticking a field of study
       there has not let go of anything. */
    const before = state('city=london');
    const settled = settleListState(rows, before, { ...before, subjects: ['law'] });
    expect(settled.cities).toEqual(['london']);
  });
});

describe('the rows a list shows', () => {
  const none = effectiveFilters(
    readListState(new URLSearchParams()),
    listOptions([], []),
  );

  it('matches a search on the name, the country, a city or the description', () => {
    const rows = [
      row({ id: 'a', name: 'Alpha', cities: ['Lyon'] }),
      row({ id: 'b', name: 'Beta', shortDescription: 'A port city school' }),
      row({ id: 'c', name: 'Gamma', country: { name: 'Peru', slug: 'peru', iso2Code: 'PE' } }),
    ];
    expect(filterUniversities(rows, none, 'lyon', 'ranking').map((r) => r.id)).toEqual(['a']);
    expect(filterUniversities(rows, none, 'port', 'ranking').map((r) => r.id)).toEqual(['b']);
    expect(filterUniversities(rows, none, 'peru', 'ranking').map((r) => r.id)).toEqual(['c']);
  });

  it('keeps only the ranked when asked', () => {
    const rows = [row({ id: 'a' }), row({ id: 'b', qsRanking: 9 })];
    const filters = { ...none, ranked: true };
    expect(filterUniversities(rows, filters, '', 'name').map((r) => r.id)).toEqual(['b']);
  });

  it('orders A to Z, by most programmes, or ranked first', () => {
    const rows = [
      row({ id: 'z', name: 'Zeta', programmes: 1, qsRanking: 40 }),
      row({ id: 'a', name: 'Alpha', programmes: 2 }),
      row({ id: 'm', name: 'Mu', programmes: 9, qsRanking: 3 }),
    ];
    const ids = (sort: 'ranking' | 'name' | 'programs') =>
      filterUniversities(rows, none, '', sort).map((r) => r.id);
    expect(ids('ranking')).toEqual(['m', 'z', 'a']);
    expect(ids('name')).toEqual(['a', 'm', 'z']);
    expect(ids('programs')).toEqual(['m', 'a', 'z']);
  });
});
