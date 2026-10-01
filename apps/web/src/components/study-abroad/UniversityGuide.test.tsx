import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  UniversityGuide,
  programmeName,
  type UniversityRecord,
} from './UniversityGuide';

/**
 * The approved build's university template carries twelve sections. Most
 * read a record this catalogue keeps against a programme or a destination
 * rather than against an institution -- admission thresholds, a fee table,
 * scholarships, campus life, graduate outcomes -- and its profile-fit panel
 * is scored against a student profile this product does not collect. What
 * renders here is what the catalogue actually holds, and a section with
 * nothing behind it stands down rather than printing a dash.
 */

const offering = (over: Record<string, unknown> = {}) => ({
  id: 'o1',
  name: 'Master of Data Science at Elmswood Polytechnic University',
  slug: 'elmswood-master-of-data-science',
  shortDescription: null,
  qualificationName: 'MSc',
  subject: { name: 'Computer Science', slug: 'computer-science' },
  specialization: null,
  courseLevel: { code: 'PG', name: 'Postgraduate' },
  duration: { min: '2', max: '2', unit: 'YEARS' },
  ...over,
});

const university = (over: Partial<UniversityRecord> = {}): UniversityRecord =>
  ({
    id: 'u1',
    name: 'Elmswood Polytechnic University',
    slug: 'elmswood-polytechnic-university-germany',
    shortDescription: 'A polytechnic in Germany.',
    overview: null,
    institutionType: 'PUBLIC',
    qsRanking: null,
    sourceReference: null,
    verifiedAt: null,
    campuses: 0,
    country: {
      name: 'Germany',
      slug: 'germany',
      iso2Code: 'DE',
      officialLanguage: 'German',
      currencyCode: 'EUR',
      currencySymbol: '€',
      intakeMonths: [10, 4],
      postStudyWorkPermitMonths: null,
    },
    offerings: [offering()],
    ...over,
  }) as UniversityRecord;

const render = (record: UniversityRecord) =>
  renderToStaticMarkup(<UniversityGuide university={record} />);

describe('a university’s guide', () => {
  it('names the institution once in the programme list, not on every card', () => {
    /* "Master of Data Science at Elmswood Polytechnic University" is the
       right name in a search result and a stutter down a column of nine. */
    expect(
      programmeName(
        'Master of Data Science at Elmswood Polytechnic University',
        'Elmswood Polytechnic University',
      ),
    ).toBe('Master of Data Science');
  });

  it('leaves a name that does not carry the institution alone', () => {
    expect(programmeName('MSc Data Science', 'Elmswood')).toBe(
      'MSc Data Science',
    );
  });

  it('fills the snapshot only with cells it can answer', () => {
    const html = render(university());
    expect(html).toContain('Germany');
    expect(html).toContain('German');
    expect(html).toContain('EUR €');
    /* Months come back as months, in order, not as the numbers stored. */
    expect(html).toContain('April · October');
    /* No campuses recorded, so no campus cell at all rather than a zero. */
    expect(html).not.toContain('Campuses');
    expect(html).not.toContain('QS ranking');
  });

  it('adds the cells a fuller record earns', () => {
    const html = render(
      university({ campuses: 3, qsRanking: 412 }),
    );
    expect(html).toContain('Campuses');
    expect(html).toContain('#412');
    expect(html).toContain('Ranking is one factor among many');
  });

  it('stands the overview down when there is none', () => {
    expect(render(university())).not.toContain('About this university');
    expect(
      render(university({ overview: '<p>Two campuses on the river.</p>' })),
    ).toContain('About this university');
  });

  it('stands the programmes down when the catalogue has none', () => {
    const html = render(university({ offerings: [] }));
    expect(html).not.toContain('Programmes at');
    expect(html).not.toContain('See its programmes');
  });

  it('points each programme at its page under this university', () => {
    expect(render(university())).toContain(
      '/universities/elmswood-polytechnic-university-germany/courses/elmswood-master-of-data-science',
    );
  });

  it('numbers the sections that render, with no gaps', () => {
    const html = render(university({ overview: '<p>About.</p>' }));
    const numbers = [...html.matchAll(/eyebrow__n">(\d+)</g)].map((m) => m[1]);
    expect(numbers).toEqual(['02', '03', '04']);
  });

  it('always says to check with the university before applying', () => {
    expect(render(university())).toContain('Check before you apply');
  });

  it('cites the source and the date only when it has them', () => {
    expect(render(university())).not.toContain('Last checked');
    const html = render(
      university({
        verifiedAt: '2026-10-01T00:00:00.000Z',
        sourceReference: 'https://example.org/elmswood',
      }),
    );
    expect(html).toContain('Last checked 2026-10-01');
    expect(html).toContain('https://example.org/elmswood');
  });
});
