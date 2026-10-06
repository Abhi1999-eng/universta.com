import { describe, expect, it } from 'vitest';
import {
  activeScholarshipFilters,
  countryScholarshipsHref,
  filterScholarships,
  isNarrowedScholarshipList,
  narrowsScholarships,
  readScholarshipState,
  scholarshipListHref,
  scholarshipOptions,
  toCountryScholarshipRows,
  type ScholarshipListState,
} from './country-scholarship-list';

const now = new Date('2026-10-05T12:00:00Z');

const record = (over: Record<string, unknown> = {}) => ({
  id: 's1',
  slug: 'chevening',
  title: 'Chevening Scholarships',
  provider: { name: 'Chevening (UK Government)' },
  benefitType: 'FULL_FUNDING',
  deadline: '2026-11-04',
  publishedAt: '2026-01-10T00:00:00Z',
  ...over,
});

const rows = toCountryScholarshipRows(
  [
    record(),
    record({
      id: 's2',
      slug: 'gates',
      title: 'Gates Cambridge Scholarship',
      provider: { name: 'Gates Cambridge Trust' },
      deadline: '2026-10-05',
      publishedAt: '2026-03-01T00:00:00Z',
    }),
    record({
      id: 's3',
      slug: 'access-grant',
      title: 'Access grant',
      provider: { name: 'Demo Provider' },
      benefitType: 'FIXED_GRANT',
      deadline: '2026-09-01',
      publishedAt: '2026-05-01T00:00:00Z',
    }),
    record({
      id: 's4',
      slug: 'rhodes',
      title: 'Rhodes Scholarship',
      provider: { name: 'Rhodes Trust' },
      deadline: null,
      publishedAt: null,
      createdAt: '2025-12-01T00:00:00Z',
    }),
    /* No slug: no page to link to, so no card. */
    record({ id: 's5', slug: null }),
  ],
  new Map([
    ['PG', new Set(['s1', 's2', 's4'])],
    ['UG', new Set(['s3'])],
  ]),
  now,
);

const state = (over: Partial<ScholarshipListState> = {}): ScholarshipListState => ({
  q: '',
  levels: [],
  types: [],
  open: false,
  sort: 'relevance',
  page: 1,
  ...over,
});

const titles = (list: { title: string }[]) => list.map((row) => row.title);

describe('a destination\'s scholarships page', () => {
  it('lives under the destination', () => {
    expect(countryScholarshipsHref('united-kingdom')).toBe(
      '/study-abroad/united-kingdom/scholarships',
    );
  });

  it('reads the list endpoint\'s rows, dropping one with no page', () => {
    expect(titles(rows)).toEqual([
      'Chevening Scholarships',
      'Gates Cambridge Scholarship',
      'Access grant',
      'Rhodes Scholarship',
    ]);
    expect(rows[0]).toMatchObject({ type: 'FULL_FUNDING', levels: ['PG'], closed: false });
  });

  it('closes an award at the end of its deadline day, not at its start', () => {
    expect(rows.find((row) => row.id === 's2')?.closed).toBe(false);
    expect(rows.find((row) => row.id === 's3')?.closed).toBe(true);
    /* No closing date recorded says nothing either way. */
    expect(rows.find((row) => row.id === 's4')?.closed).toBeNull();
  });
});

describe('the scholarships list state', () => {
  it('reads the names the worldwide finder already uses', () => {
    const read = readScholarshipState(
      new URLSearchParams('q=gates&degreeLevel=PG,UG&type=FULL_FUNDING&deadline=open&sort=deadline&page=3'),
    );
    expect(read).toEqual({
      q: 'gates',
      levels: ['PG', 'UG'],
      types: ['FULL_FUNDING'],
      open: true,
      sort: 'deadline',
      page: 3,
    });
  });

  it('ignores a sort or page it does not know', () => {
    const read = readScholarshipState(new URLSearchParams('sort=cheapest&page=-2'));
    expect(read.sort).toBe('relevance');
    expect(read.page).toBe(1);
  });

  it('writes a state back to the same address, leaving the defaults out', () => {
    const path = '/study-abroad/united-kingdom/scholarships';
    expect(scholarshipListHref(path, state())).toBe(path);
    const href = scholarshipListHref(path, state({ q: 'gates', levels: ['PG'], open: true, page: 2 }));
    expect(href).toBe(`${path}?q=gates&degreeLevel=PG&deadline=open&page=2`);
    expect(readScholarshipState(new URL(href, 'http://x').searchParams)).toEqual(
      state({ q: 'gates', levels: ['PG'], open: true, page: 2 }),
    );
  });

  it('keeps a searched or filtered view out of the index', () => {
    expect(isNarrowedScholarshipList({})).toBe(false);
    expect(isNarrowedScholarshipList({ q: 'gates' })).toBe(true);
    expect(isNarrowedScholarshipList({ utm_source: 'x' })).toBe(false);
  });

  it('counts the filters ticked for the phone\'s badge', () => {
    expect(activeScholarshipFilters(state({ levels: ['PG'], types: ['A', 'B'], open: true }))).toBe(4);
  });
});

describe('what the scholarships list can be narrowed by', () => {
  const options = scholarshipOptions(rows, [
    { code: 'UG', name: "Bachelor's" },
    { code: 'PG', name: "Master's" },
    { code: 'PHD', name: 'PhD' },
  ]);

  it('offers only the funding types and levels the awards here carry', () => {
    expect(options.types).toEqual([
      { value: 'FULL_FUNDING', label: 'Full funding', count: 3 },
      { value: 'FIXED_GRANT', label: 'Fixed grant', count: 1 },
    ]);
    /* In the catalogue's academic order, and no PhD: no award here has it. */
    expect(options.levels.map((level) => level.label)).toEqual(["Bachelor's", "Master's"]);
    expect(options.open).toBe(3);
  });

  it('does not offer a filter that would leave the list as it is', () => {
    expect(narrowsScholarships([{ value: 'A', label: 'A', count: 4 }], 4)).toBe(false);
    expect(narrowsScholarships([{ value: 'A', label: 'A', count: 3 }], 4)).toBe(true);
    expect(narrowsScholarships(options.types, 4)).toBe(true);
  });
});

describe('filterScholarships', () => {
  it('searches the name, the provider and what the award covers', () => {
    expect(titles(filterScholarships(rows, state({ q: 'trust' })))).toEqual([
      'Gates Cambridge Scholarship',
      'Rhodes Scholarship',
    ]);
    expect(titles(filterScholarships(rows, state({ q: 'fixed grant' })))).toEqual(['Access grant']);
  });

  it('narrows by level, funding type and an open deadline', () => {
    expect(titles(filterScholarships(rows, state({ levels: ['UG'] })))).toEqual(['Access grant']);
    expect(filterScholarships(rows, state({ types: ['FIXED_GRANT', 'FULL_FUNDING'] }))).toHaveLength(4);
    /* An award with no closing date recorded is not known to be closed. */
    expect(titles(filterScholarships(rows, state({ open: true })))).not.toContain('Access grant');
    expect(titles(filterScholarships(rows, state({ open: true })))).toContain('Rhodes Scholarship');
  });

  it('puts the soonest open deadline first and the closed ones last', () => {
    expect(titles(filterScholarships(rows, state({ sort: 'deadline' })))).toEqual([
      'Gates Cambridge Scholarship',
      'Chevening Scholarships',
      'Rhodes Scholarship',
      'Access grant',
    ]);
  });

  it('orders by the date published, then by name', () => {
    expect(titles(filterScholarships(rows, state({ sort: 'newest' })))).toEqual([
      'Access grant',
      'Gates Cambridge Scholarship',
      'Chevening Scholarships',
      'Rhodes Scholarship',
    ]);
    expect(titles(filterScholarships(rows, state({ sort: 'name-asc' })))[0]).toBe('Access grant');
  });

  it('keeps the catalogue\'s own order as the most relevant', () => {
    expect(titles(filterScholarships(rows, state()))).toEqual(titles(rows));
  });
});
