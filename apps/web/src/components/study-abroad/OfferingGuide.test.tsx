import { describe, expect, it, vi } from 'vitest';

/* The guide sits inside the Study Abroad shell (the assessment) and the
   student portal's buttons read the router; both are stubbed. */
vi.mock('./StudyAbroadShell', () => ({
  useStudyAbroadShell: () => ({ openAssessment: () => {}, openSelector: () => {} }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {} }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

import { renderToStaticMarkup } from 'react-dom/server';
import {
  groupRequirements,
  offeringJsonLd,
  toOfferingDetail,
  type OfferingDetail,
} from '@/lib/offering-detail';
import { OfferingGuide } from './OfferingGuide';

/**
 * One course at one university, in the design's course page and with the
 * reference's behaviour: the panel lists every row and says "Not listed"
 * where the record is silent; Fees, Intakes and Eligibility are always
 * there, pointing to the official page or a counsellor when empty; and the
 * page ends with the university's other courses and the same course at
 * other universities, each under its own country.
 */

const country = { name: 'United Kingdom', slug: 'united-kingdom', iso2Code: 'GB' };
const generic = {
  slug: 'msc-computer-science',
  qualificationName: 'Master of Science',
  careerSummary: 'Senior technical roles and doctoral study.',
  durationMin: '1',
  durationMax: '2',
  durationUnit: 'YEARS',
  subject: { name: 'Computer Science', slug: 'computer-science' },
  subSubject: { name: 'Artificial Intelligence', slug: 'artificial-intelligence' },
  courseLevel: { code: 'PG', name: "Master's" },
};

function apiRow(over: Record<string, unknown> = {}) {
  return {
    id: 'o1',
    name: 'MSc Computer Science',
    slug: 'university-of-oxford-msc-computer-science',
    shortDescription: 'Advanced study across algorithms and systems.',
    overview: '<p>Taught at {universityName}.</p>',
    studyMode: 'FULL_TIME',
    updatedAt: '2026-10-05T07:21:05.111Z',
    campus: { name: 'Oxford city colleges', city: 'Oxford' },
    genericCourse: generic,
    university: {
      name: 'University of Oxford',
      slug: 'university-of-oxford',
      websiteUrl: null,
      qsRanking: 3,
      institutionType: 'PUBLIC',
      country,
      campuses: [{ name: 'Oxford city colleges', city: 'Oxford' }],
    },
    intakes: [],
    requirements: [],
    moreAtUniversity: {
      total: 2,
      rows: [
        {
          id: 'o2',
          name: 'BA Economics',
          slug: 'university-of-oxford-ba-economics',
          genericCourse: { ...generic, courseLevel: { code: 'UG', name: "Bachelor's" }, durationMin: '3', durationMax: '4' },
        },
      ],
    },
    related: [],
    elsewhereTotal: 17,
    elsewhere: [
      {
        id: 'o3',
        name: 'MSc Computer Science',
        slug: 'eth-zurich-msc-computer-science',
        genericCourse: generic,
        university: {
          name: 'ETH Zurich',
          slug: 'eth-zurich',
          country: { name: 'Switzerland', slug: 'switzerland', iso2Code: 'CH' },
          campuses: [{ city: 'Zurich' }],
        },
        intakes: [],
      },
    ],
    seo: null,
    ...over,
  };
}

const detail = (over: Record<string, unknown> = {}) => toOfferingDetail(apiRow(over))!;
const render = (value: OfferingDetail = detail()) =>
  renderToStaticMarkup(<OfferingGuide detail={value} today={new Date('2026-10-05T00:00:00Z')} />);

describe('the course page', () => {
  it('files the course under its country, its university and its list', () => {
    const html = render();
    for (const href of [
      'href="/study-abroad/united-kingdom"',
      'href="/study-abroad/united-kingdom/universities"',
      'href="/universities/university-of-oxford"',
      'href="/study-abroad/united-kingdom/universities/university-of-oxford/courses"',
    ])
      expect(html).toContain(href);
    expect(html).toContain('<span aria-current="page">MSc Computer Science</span>');
  });

  it('links the university under the title, with its city and country, and where the course sits', () => {
    const html = render();
    expect(html).toContain('class="coursehero__uni" href="/universities/university-of-oxford"');
    expect(html).toContain('Oxford, United Kingdom');
    expect(html).toContain('href="/subjects/computer-science/artificial-intelligence"');
    expect(html).toContain('href="/study-abroad/united-kingdom/computer-science"');
  });

  it('lists every row of the panel, “Not listed” where the record is silent', () => {
    const html = render();
    const rows = html.match(/class="snap__k">([^<]+)</g) ?? [];
    expect(rows.map((entry) => entry.replace(/.*>/, '').replace('<', ''))).toEqual([
      'Degree',
      'Duration',
      'Language',
      'Tuition',
      'Intake',
      'Application deadline',
      'Location',
    ]);
    expect(html).toContain('Needs verification');
    expect(html).toContain('Last updated 2026-10-05');
  });

  it('always shows fees, intakes and eligibility, pointing somewhere when they are empty', () => {
    const html = render();
    expect(html).toContain('id="fees"');
    expect(html).toContain('Fee information for this course is not listed yet.');
    expect(html).toContain('id="intakes"');
    expect(html).toContain('Intakes for this course have not been listed yet.');
    expect(html).toContain('id="eligibility"');
    expect(html).toContain('Entry requirements for this course have not been listed yet.');
    expect(html).toContain('Talk to a counsellor');
  });

  it('points to the official page first when the record has one', () => {
    const html = render(detail({ applicationUrl: 'https://example.invalid/apply' }));
    expect(html).toContain('Apply on the university site');
    expect(html).toContain('Check the official course page');
  });

  it('files requirements into the admissions grid', () => {
    const html = render(
      detail({
        requirements: [
          { category: 'ACADEMIC', title: 'Undergraduate degree', description: 'A first in a related subject.' },
          { category: 'ENGLISH_TEST', title: 'IELTS Academic', minimumScore: '7.00' },
          { category: 'WORK_EXPERIENCE', title: 'Work experience' },
        ],
      }),
    );
    expect(html).toContain('class="eligrid"');
    expect(html).toContain('A first in a related subject.');
    expect(html).toContain('IELTS Academic<em>Minimum 7</em>');
    expect(html).toContain('Other requirements');
    expect(html).not.toContain('Entry requirements for this course have not been listed yet.');
  });

  it('shows intakes as a table, with the next deadline in the panel and the steps', () => {
    const html = render(
      detail({
        intakes: [
          { deadline: '2027-01-15', intake: { name: 'September', slug: 'september', startMonth: 9, endMonth: 9 } },
          { deadline: '2026-01-15', intake: { name: 'January', slug: 'january', startMonth: 1, endMonth: 1 } },
        ],
        tuitionMin: '30000',
        currencyCode: 'GBP',
        tuitionPeriod: 'PER_YEAR',
        verifiedAt: '2026-09-01T00:00:00.000Z',
      }),
    );
    expect(html).toContain('<th scope="col">Course start</th>');
    expect(html).toContain('Jan 15, 2027');
    expect(html).toContain('Before <b>Jan 15, 2027</b>');
    expect(html).toContain('GBP 30,000/yr');
    expect(html).toContain('Published figure, verified Sep 1, 2026');
    expect(html).toContain('>Verified<');
  });

  it('builds the section strip and the numbers from the bands that render', () => {
    const html = render();
    /* The modifier carries the sections' scroll offset, so a tab, or the
       hero's #eligibility link, lands a section below the sticky strip. */
    expect(html).toContain('<nav class="unitabs unitabs--sections" aria-label="Course sections">');
    for (const id of ['overview', 'fees', 'intakes', 'eligibility', 'apply', 'careers', 'university', 'more', 'elsewhere'])
      expect(html).toContain(`href="#${id}"`);
    expect(html).not.toContain('href="#similar"');
    expect(html).not.toContain('href="#scholarships"');
    expect(html).toMatch(/eyebrow__n">06<\/span>(?:\s|<!-- -->)*Careers/);
  });

  it('ends with the university’s other courses and this course at other universities', () => {
    const html = render();
    expect(html).toContain('More courses at University of Oxford');
    expect(html).toContain('View all 2 courses at University of Oxford');
    expect(html).toContain('Other universities offering this course');
    expect(html).toContain(
      'href="/study-abroad/switzerland/universities/eth-zurich/courses/eth-zurich-msc-computer-science"',
    );
    expect(html).toContain('Zurich, Switzerland');
  });

  it('carries the course into counselling, and keeps Save and Apply with Universta', () => {
    const html = render();
    expect(html).toContain('/counselling?source=course&amp;country=united-kingdom&amp;subject=computer-science');
    expect(html).toContain('course=msc-computer-science');
    expect(html).toContain('Apply with Universta');
    expect(html).toContain('Add to comparison');
  });

  it('resolves the overview’s content variables', () => {
    expect(render()).toContain('Taught at University of Oxford.');
  });

  it('writes the country into sentences with its article, and keeps the bare name as a label', () => {
    const html = render(detail({ genericCourse: { ...generic, careerSummary: 'Research roles.' } }));
    for (const phrase of [
      'Studying in the United Kingdom',
      'Living costs and visa fees in the United Kingdom',
      'Post-study work rights in the United Kingdom',
      'Universities in the United Kingdom',
      'Study in the United Kingdom',
    ])
      expect(html).toContain(phrase);
    expect(html).not.toMatch(/in United Kingdom/);
    /* The breadcrumb and the facts cell name the country on its own. */
    expect(html).toContain('href="/study-abroad/united-kingdom">United Kingdom</a>');
  });

  it('counts each related group in full, not the links it lists', () => {
    const html = render();
    expect(html).toMatch(/This course elsewhere <span class="h-count__n">17<\/span>/);
    expect(html).toMatch(/More at University of Oxford <span class="h-count__n">1<\/span>/);
    const many = render(
      detail({ moreAtUniversity: { ...apiRow().moreAtUniversity, total: 40 } }),
    );
    expect(many).toMatch(/More at University of Oxford <span class="h-count__n">39<\/span>/);
  });
});

describe('the course as data', () => {
  it('describes itself to search engines as a Course from its university', () => {
    const ld = offeringJsonLd(detail({ tuitionMin: null }), 'https://universta.example');
    expect(ld['@type']).toBe('Course');
    expect(ld.url).toBe(
      'https://universta.example/study-abroad/united-kingdom/universities/university-of-oxford/courses/university-of-oxford-msc-computer-science',
    );
    expect(ld.provider).toMatchObject({ '@type': 'CollegeOrUniversity', name: 'University of Oxford' });
    expect(ld.educationalCredentialAwarded).toBe('Master of Science');
  });

  it('groups requirements the way the admissions grid shows them', () => {
    const groups = groupRequirements([
      { category: 'ACADEMIC', title: 'a', description: null, minimumScore: null },
      { category: 'ENGLISH_TEST', title: 'b', description: null, minimumScore: '6.5' },
      { category: 'PORTFOLIO', title: 'c', description: null, minimumScore: null },
    ]);
    expect(groups.academic.map((r) => r.title)).toEqual(['a']);
    expect(groups.language.map((r) => r.title)).toEqual(['b']);
    expect(groups.other.map((r) => r.title)).toEqual(['c']);
  });

  it('reads how many other universities teach the course, never fewer than it lists', () => {
    expect(detail().elsewhereTotal).toBe(17);
    expect(detail({ elsewhereTotal: undefined }).elsewhereTotal).toBe(1);
  });

  it('refuses a course it cannot file under a country', () => {
    expect(toOfferingDetail(apiRow({ university: { name: 'X', slug: 'x' } }))).toBeNull();
  });
});
