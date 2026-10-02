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
    totalStudents: null,
    internationalStudentsPercent: null,
    studentFacultyRatio: null,
    establishedYear: null,
    campusSetting: null,
    websiteUrl: null,
    admissionsEmail: null,
    phone: null,
    statsSourceName: null,
    statsSourceUrl: null,
    statsYear: null,
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

/**
 * How big an institution is, how international, and how crowded are the
 * figures a student compares institutions on, and the catalogue had
 * nowhere to keep them. They are somebody else's counts, so the page says
 * whose and from when -- and when nobody has said, it admits that too
 * rather than presenting a number as settled.
 */
describe('the figures a university is compared on', () => {
  const html = (over: Partial<UniversityRecord>) =>
    renderToStaticMarkup(<UniversityGuide university={university(over)} />);

  it('shows the student count in a readable form', () => {
    expect(html({ totalStudents: 22005 })).toContain('22,005');
  });

  it('shows how many come from abroad', () => {
    expect(html({ internationalStudentsPercent: '43' })).toContain('43%');
  });

  it('shows how many students there are per member of staff', () => {
    const markup = html({ studentFacultyRatio: '10.4' });
    expect(markup).toContain('Students per staff');
    expect(markup).toContain('10.4');
  });

  it('names who published the figures, and when', () => {
    const markup = html({
      totalStudents: 22005,
      statsSourceName: 'Times Higher Education',
      statsYear: 2026,
    });
    expect(markup).toContain('Times Higher Education, 2026');
    expect(markup).toContain('does not count them itself');
  });

  it('links the source when there is one to link', () => {
    expect(
      html({
        totalStudents: 22005,
        statsSourceName: 'Times Higher Education',
        statsSourceUrl: 'https://example.invalid/the',
      }),
    ).toContain('https://example.invalid/the');
  });

  it('says a figure is unsourced rather than letting it pass as settled', () => {
    const markup = html({ totalStudents: 22005 });
    expect(markup).toContain('without a published source');
  });

  it('says nothing about sources when it has no figures to source', () => {
    const markup = html({});
    expect(markup).not.toContain('without a published source');
    expect(markup).not.toContain('does not count them itself');
  });

  it('leaves out every figure the record does not hold', () => {
    const markup = html({});
    for (const label of [
      'Students per staff',
      'International',
      'Founded',
      'Setting',
    ])
      expect(markup).not.toContain(label);
  });

  it('writes the campus setting as a word, not a shout', () => {
    expect(html({ campusSetting: 'URBAN' })).toContain('Urban');
  });
});

/**
 * Anything on the page can change between intakes, so the institution's own
 * channels are worth offering. The section stands down entirely when the
 * record has none, like every other band here.
 */
describe('reaching the university itself', () => {
  const html = (over: Partial<UniversityRecord>) =>
    renderToStaticMarkup(<UniversityGuide university={university(over)} />);

  it('offers the official website', () => {
    expect(html({ websiteUrl: 'https://example.invalid' })).toContain(
      'Official website',
    );
  });

  it('offers the admissions address as a mail link', () => {
    expect(html({ admissionsEmail: 'admissions@example.invalid' })).toContain(
      'mailto:admissions@example.invalid',
    );
  });

  it('strips a phone number down to something dialable', () => {
    expect(html({ phone: '+44 1865 270000' })).toContain('tel:+441865270000');
  });

  it('stands the section down when there is no way to make contact', () => {
    expect(html({})).not.toContain('Ask the university directly');
  });
});
