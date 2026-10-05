import { describe, expect, it } from 'vitest';
import type { AnyRecord } from '@/components/phase1/PhaseOneViews';
import type { CountryPage } from '@/lib/countries';
import { cityOf, toDestination, toOffering, toRecord } from './university-record';

/**
 * The detail endpoint's record is loose JSON. What the page needs from it
 * has to be read the same way every time, and a field the record lacks has
 * to come out as nothing rather than as "undefined" on the page.
 */

const offeringRow = (over: Record<string, unknown> = {}) => ({
  id: 'o1',
  name: 'BA Economics at University of Oxford',
  slug: 'university-of-oxford-ba-economics',
  studyMode: 'FULL_TIME',
  durationMin: '3',
  durationMax: '4',
  durationUnit: 'YEARS',
  tuitionMin: null,
  tuitionMax: null,
  currencyCode: null,
  tuitionPeriod: null,
  intakes: [],
  genericCourse: {
    qualificationName: 'Bachelor of Arts',
    subject: { name: 'Social Sciences', slug: 'social-sciences' },
    subSubject: { name: 'Economics', slug: 'economics' },
    courseLevel: { code: 'UG', name: "Bachelor's", displayOrder: 3, educationOrder: 3 },
  },
  ...over,
});

describe('reading an offering', () => {
  it('carries the specialization, the study mode and the level’s place in the order', () => {
    const offering = toOffering(offeringRow());
    expect(offering.specialization).toEqual({ name: 'Economics', slug: 'economics' });
    expect(offering.studyMode).toBe('FULL_TIME');
    expect(offering.courseLevel).toEqual({ code: 'UG', name: "Bachelor's", order: 303 });
  });

  /* An editor can file one university's course under another level than the
     catalogue's course (Sterling's MEng is Master's there; its generic course
     is a pathway). The course list and the course page read the course's
     own level first, so the university page has to as well, or the three
     pages call the course different levels and count the levels apart. */
  it('takes the level set on the course first, the generic course’s otherwise', () => {
    const own = { code: 'PG', name: "Master's", displayOrder: 4, educationOrder: 4 };
    const pathway = {
      code: 'PATHWAY',
      name: 'Pathway Program',
      displayOrder: 2,
      educationOrder: 2,
    };
    const generic = offeringRow().genericCourse;
    expect(
      toOffering(offeringRow({ courseLevel: own, genericCourse: { ...generic, courseLevel: pathway } }))
        .courseLevel,
    ).toEqual({ code: 'PG', name: "Master's", order: 404 });
    expect(toOffering(offeringRow({ courseLevel: null })).courseLevel).toEqual({
      code: 'UG',
      name: "Bachelor's",
      order: 303,
    });
  });

  it('reads a fee only when the offering states one', () => {
    expect(toOffering(offeringRow()).tuition).toBeNull();
    expect(
      toOffering(
        offeringRow({ tuitionMin: '24000', tuitionMax: '30000', currencyCode: 'GBP', tuitionPeriod: 'PER_YEAR' }),
      ).tuition,
    ).toEqual({ min: '24000', max: '30000', currencyCode: 'GBP', period: 'PER_YEAR' });
  });

  it('reads its intakes with their month and deadline', () => {
    const offering = toOffering(
      offeringRow({
        intakes: [
          { deadline: '2027-01-15', intake: { id: 'i9', name: 'September', startMonth: 9 } },
          { deadline: null, intake: {} },
        ],
      }),
    );
    expect(offering.intakes).toEqual([
      { key: 'i9', name: 'September', month: 9, deadline: '2027-01-15' },
    ]);
  });
});

describe('reading a university', () => {
  const row = {
    id: 'u1',
    name: 'University of Oxford',
    slug: 'university-of-oxford',
    campuses: [{ city: null, cityRef: { name: 'Oxford' } }],
    country: { name: 'United Kingdom', slug: 'united-kingdom', iso2Code: 'GB' },
    offerings: [offeringRow()],
    otherUniversities: {
      total: 13,
      data: [
        {
          id: 'u2',
          name: 'Imperial College London',
          slug: 'imperial-college-london',
          institutionType: 'Public',
          qsRanking: 8,
          campuses: [{ city: 'London' }],
          _count: { offerings: 2 },
        },
      ],
    },
  } as unknown as AnyRecord;

  it('takes its city from its campuses, typed or picked from the lists', () => {
    expect(toRecord(row).city).toBe('Oxford');
    expect(cityOf([{ city: '  ' }, { city: 'London' }])).toBe('London');
    expect(cityOf(undefined)).toBeNull();
  });

  it('carries the other universities in its country and how many there are', () => {
    const record = toRecord(row);
    expect(record.otherUniversityTotal).toBe(13);
    expect(record.otherUniversities).toEqual([
      expect.objectContaining({
        name: 'Imperial College London',
        city: 'London',
        qsRanking: 8,
        programmes: 2,
      }),
    ]);
  });

  it('has none to offer when the record carries none', () => {
    const record = toRecord({ ...row, otherUniversities: undefined } as AnyRecord);
    expect(record.otherUniversities).toEqual([]);
    expect(record.otherUniversityTotal).toBe(0);
  });
});

describe('what the destination’s guide offers a university page', () => {
  const page = (over: Partial<CountryPage['country']> = {}, sections: unknown[] = []) =>
    ({
      country: { slug: 'united-kingdom', name: 'United Kingdom', documents: [], configuration: null, ...over },
      profiles: { cost: null, work: [], language: null, intakes: [], statistics: null },
      sections,
      faqs: [],
      seo: null,
      consultantCards: [],
      consultants: { total: 4, cities: [] },
    }) as unknown as CountryPage;

  it('links only into sections the guide renders', () => {
    const destination = toDestination(page())!;
    expect(destination.links).toEqual([]);
    expect(destination.costHref).toBeNull();
    expect(destination.consultants?.total).toBe(4);
  });

  it('offers the documents and the visa route when the guide has them', () => {
    const destination = toDestination(
      page({ documents: [{ id: 'd1' }] } as never, [
        { id: 's1', sectionKey: 'visa-process', heading: 'Student visa', bodyJson: null },
      ]),
    )!;
    expect(destination.links.map((link) => link.href)).toEqual([
      '/study-abroad/united-kingdom#country-visa-process',
      '/study-abroad/united-kingdom#documents',
    ]);
  });

  it('has nothing when the guide could not be read', () => {
    expect(toDestination(null)).toBeNull();
  });
});
