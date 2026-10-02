import { describe, expect, it, vi } from 'vitest';

/* The guide sits inside the Study Abroad shell, which supplies the
   assessment dialog through context. The bands that reach for it are not
   what these assertions are about, so the shell is stubbed rather than
   mounted. */
vi.mock('./StudyAbroadShell', () => ({
  useStudyAbroadShell: () => ({ openAssessment: () => {}, openSelector: () => {} }),
}));
import { renderToStaticMarkup } from 'react-dom/server';
import { CourseGuide } from './CourseGuide';
import type { CourseAvailability, CourseDetail } from '@/lib/catalog';
import { toScholarshipCards } from '@/lib/scholarship-card';

/**
 * The same programme is admitted on different terms in different countries,
 * and the catalogue has recorded those terms per country-course mapping all
 * along -- grade floors, English scores, work experience, application fees,
 * deadlines. The page fetched every one of them and threw them away, so a
 * reader comparing two destinations saw only their names.
 */
const availability = (over: Partial<CourseAvailability> = {}): CourseAvailability => ({
  id: 'a1',
  country: { id: 'c1', name: 'Germany', slug: 'germany' },
  ...over,
});

const course = (rows: CourseAvailability[]): CourseDetail =>
  ({
    id: 'course-1',
    name: 'MSc Computer Science',
    slug: 'msc-computer-science',
    shortDescription: null,
    overview: null,
    careerSummary: null,
    qualificationName: null,
    credits: null,
    featuredMedia: null,
    availableCountryCount: rows.length,
    subject: { id: 's1', name: 'Computing', slug: 'computing' },
    subSubject: null,
    courseLevel: { id: 'l1', name: 'Postgraduate', code: 'PG' },
    studyModes: [],
    duration: { min: null, max: null, unit: null },
    availability: rows,
    selectedCountry: null,
    contentSections: [],
    faqs: [],
    relatedCourses: [],
    seo: null,
    jsonLd: {},
  }) as unknown as CourseDetail;

const html = (rows: CourseAvailability[], scholarships: unknown[] = []) =>
  renderToStaticMarkup(
    <CourseGuide
      course={course(rows)}
      scholarships={toScholarshipCards(scholarships)}
    />,
  );

describe('what each destination asks for', () => {
  it('prints the grade floors a destination set', () => {
    const markup = html([
      availability({ academicRequirements: { percentage: '70', cgpa: '3.2' } }),
    ]);
    expect(markup).toContain('Academic minimum');
    expect(markup).toContain('70%');
    expect(markup).toContain('3.2');
  });

  it('prints only the English tests it named a number for', () => {
    const markup = html([
      availability({ englishRequirements: { ielts: '6.5', toefl: null, pte: null, duolingo: null } }),
    ]);
    expect(markup).toContain('IELTS');
    expect(markup).not.toContain('Duolingo');
  });

  it('prints the intakes with their deadlines', () => {
    const markup = html([
      availability({
        intakes: [
          {
            id: 'i1',
            intake: { id: 'x', name: 'September', slug: 'september' },
            applicationDeadline: '2027-01-15T00:00:00.000Z',
          },
        ],
      }),
    ]);
    expect(markup).toContain('September');
    expect(markup).toContain('2027-01-15');
  });

  it('says a deadline is unpublished rather than leaving the cell blank', () => {
    const markup = html([
      availability({
        intakes: [{ id: 'i1', intake: { id: 'x', name: 'September', slug: 'september' } }],
      }),
    ]);
    expect(markup).toContain('Deadline not published');
  });

  it('carries the prose an editor wrote for that destination', () => {
    const markup = html([
      availability({
        admissionRequirements: 'A quantitative bachelor’s degree.',
        applicationNotes: 'Assessed in rounds.',
      }),
    ]);
    expect(markup).toContain('A quantitative bachelor’s degree.');
    expect(markup).toContain('Assessed in rounds.');
  });

  it('links the source the figures were taken from', () => {
    const markup = html([
      availability({
        tuition: { min: '100', currencyCode: 'EUR' },
        sourceReference: 'https://example.invalid/programme',
        verifiedAt: '2026-10-02T00:00:00.000Z',
      }),
    ]);
    expect(markup).toContain('https://example.invalid/programme');
    expect(markup).toContain('checked 2026-10-02');
  });

  it('gives a destination a card only when it recorded something', () => {
    /* A mapping that is only a country name adds a card saying nothing,
       which is worse than no card at all. */
    expect(html([availability()])).not.toContain('What each destination asks for');
  });

  it('shows the section as soon as one destination has something to say', () => {
    const markup = html([
      availability(),
      availability({
        id: 'a2',
        country: { id: 'c2', name: 'Ireland', slug: 'ireland' },
        englishRequirements: { ielts: '6.5' },
      }),
    ]);
    expect(markup).toContain('What each destination asks for');
    expect(markup).toContain('Ireland');
  });

  it('counts the destinations band and this one separately in the numbering', () => {
    const markup = html([availability({ englishRequirements: { ielts: '6.5' } })]);
    expect(markup).toContain('01');
    expect(markup).toContain('02');
  });
});

/**
 * A scholarship can be recorded against the offerings that teach a
 * programme, and the course page never asked for them. A reader deciding
 * whether they could afford the course was told nothing about the money
 * attached to it.
 */
describe('funding on a course', () => {
  const award = {
    id: 'sch-1',
    title: 'DAAD Masters Award',
    slug: 'daad-masters',
    benefitType: 'FULL_TUITION',
    amount: '12000.00',
    currencyCode: 'EUR',
    deadline: '2027-01-15',
    provider: { name: 'DAAD' },
  };

  it('opens a funding band when an award is recorded against the programme', () => {
    const markup = html([availability()], [award]);
    expect(markup).toContain('Scholarships for MSc Computer Science');
    expect(markup).toContain('DAAD Masters Award');
    expect(markup).toContain('EUR 12,000');
    expect(markup).toContain('15 Jan 2027');
  });

  it('says plainly that eligibility is not an award', () => {
    expect(html([availability()], [award])).toContain(
      'not a guarantee of an award',
    );
  });

  it('counts one award as one and two as two', () => {
    expect(html([availability()], [award])).toContain('1 award is');
    expect(
      html([availability()], [award, { ...award, id: 'sch-2', slug: 'other' }]),
    ).toContain('2 awards are');
  });

  it('stands the band down when the catalogue records no funding', () => {
    expect(html([availability()])).not.toContain('Scholarships for');
  });

  it('keeps the numbered run sequential with the band in it', () => {
    const markup = html([availability({ englishRequirements: { ielts: '6.5' } })], [award]);
    expect(markup).toContain('01');
    expect(markup).toContain('02');
    expect(markup).toContain('03');
    expect(markup).not.toContain('04');
  });
});
