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
    expect(html).toContain('Last updated 5 October 2026');
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
    /* The same deadline written the same way as on the university's
       profile and its course list. */
    expect(html).toContain('15 January 2027');
    expect(html).toContain('Before <b>15 January 2027</b>');
    expect(html).not.toContain('Jan 15, 2027');
    expect(html).toContain('GBP 30,000/yr');
    expect(html).toContain('Published figure, verified 1 September 2026');
    expect(html).toContain('>Verified<');
  });

  it('builds the section strip and the numbers from the bands that render', () => {
    const html = render();
    /* The modifier carries the sections' scroll offset, so a tab, or the
       hero's #eligibility link, lands a section below the sticky strip. */
    expect(html).toContain('<nav class="unitabs unitabs--sections" aria-label="Course sections">');
    for (const id of ['overview', 'curriculum', 'fees', 'intakes', 'eligibility', 'apply', 'careers', 'university', 'more', 'elsewhere'])
      expect(html).toContain(`href="#${id}"`);
    expect(html).not.toContain('href="#similar"');
    expect(html).not.toContain('href="#scholarships"');
    /* The curriculum is second, where the design puts it, so careers is
       seventh. */
    expect(html).toMatch(/eyebrow__n">02<\/span>(?:\s|<!-- -->)*Curriculum/);
    expect(html).toMatch(/eyebrow__n">07<\/span>(?:\s|<!-- -->)*Careers/);
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

  it('draws Save as the design’s heart, “Save course”, beside Apply and the comparison', () => {
    const html = render();
    const tools = html.slice(html.indexOf('uc-hero-tools'), html.indexOf('</aside>'));
    expect(tools).toMatch(
      /<button type="button" class="iconbtn" aria-pressed="false"><svg[^>]*><path d="M20\.8 5\.6[^"]*"><\/path><\/svg><span>Save course<\/span><\/button>/,
    );
    /* The phase-1 button it replaces is gone; Apply stays beside it. */
    expect(tools).not.toContain('class="button secondary"');
    expect(tools).toContain('Apply with Universta');
    expect(tools).toContain('Add to comparison');
  });

  it('says what will be studied is not in our data, and links the course’s official page', () => {
    const html = render(
      detail({
        sourceReference: 'https://example.invalid/msc',
        applicationUrl: 'https://example.invalid/apply',
      }),
    );
    const curriculum = html.slice(html.indexOf('id="curriculum"'), html.indexOf('id="fees"'));
    expect(curriculum).toContain('What will you study?');
    expect(curriculum).toContain('A semester-by-semester structure is not in our data for this course.');
    expect(curriculum).toContain(
      '<a href="https://example.invalid/msc" rel="nofollow noopener" target="_blank">Official course page ↗</a>',
    );
    expect(html).toContain('<a href="#curriculum">Curriculum</a>');
  });

  it('falls back on the application page, then the university’s site, for the modules', () => {
    const apply = render(detail({ applicationUrl: 'https://example.invalid/apply' }));
    expect(apply.slice(apply.indexOf('id="curriculum"'), apply.indexOf('id="fees"'))).toContain(
      'href="https://example.invalid/apply"',
    );
    const site = render(
      detail({ university: { ...apiRow().university, websiteUrl: 'https://www.ox.ac.uk' } }),
    );
    const block = site.slice(site.indexOf('id="curriculum"'), site.indexOf('id="fees"'));
    expect(block).toContain('Check the official university website for the current module sequence.');
    expect(block).toContain('Official university website ↗');
  });

  it('points to a counsellor for the modules when there is no official page to link', () => {
    const html = render();
    const curriculum = html.slice(html.indexOf('id="curriculum"'), html.indexOf('id="fees"'));
    expect(curriculum).not.toContain('target="_blank"');
    expect(curriculum).toContain('Talk to a counsellor</a>, who can confirm the modules with the university.');
  });

  it('keeps every section and tab it had before the curriculum', () => {
    const html = render(detail({ genericCourse: { ...generic, careerSummary: 'Research roles.' } }));
    for (const id of ['overview', 'fees', 'intakes', 'eligibility', 'apply', 'talk', 'careers', 'university', 'more', 'elsewhere'])
      expect(html).toContain(`id="${id}"`);
    for (const label of ['Overview', 'Fees', 'Intakes', 'Eligibility', 'How to apply', 'Careers', 'University', 'More courses', 'Other universities'])
      expect(html).toContain(`>${label}</a>`);
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

describe('what the course page reads from its destination and its course', () => {
  const ukGuide = {
    consultants: {
      total: 4,
      cities: [
        { city: 'London', count: 3 },
        { city: 'Manchester', count: 1 },
      ],
    },
    links: [
      { key: 'visa', label: 'Student visa', href: '/study-abroad/united-kingdom#country-visa-process' },
      { key: 'work-visa', label: 'Work after study', href: '/study-abroad/united-kingdom#work-visa' },
    ],
    costHref: '/study-abroad/united-kingdom#cost' as string | null,
  };
  const withGuide = (destination: typeof ukGuide | null, value = detail()) =>
    renderToStaticMarkup(
      <OfferingGuide
        detail={value}
        destination={destination}
        today={new Date('2026-10-05T00:00:00Z')}
      />,
    );

  it('sends the visa step to the student-visa section and living costs to the cost section', () => {
    const html = withGuide(ukGuide);
    expect(html).toContain(
      'href="/study-abroad/united-kingdom#country-visa-process">United Kingdom visa steps →</a>',
    );
    expect(html).toContain(
      'href="/study-abroad/united-kingdom#cost">Living costs and visa fees in the United Kingdom →</a>',
    );
    expect(html).not.toContain('#work-visa">United Kingdom visa steps');
  });

  it('falls back on the guide itself for a section the guide does not render', () => {
    const html = withGuide({ ...ukGuide, links: [], costHref: null });
    expect(html).toContain('href="/study-abroad/united-kingdom">United Kingdom visa steps →</a>');
    expect(html).toContain(
      'href="/study-abroad/united-kingdom">Living costs and visa fees in the United Kingdom →</a>',
    );
    expect(html).not.toContain('#country-visa-process');
    expect(html).not.toContain('#cost"');
    /* The default record has careers: its work-rights link lands on the
       guide too, rather than on an anchor that is not there. */
    expect(html).toContain('href="/study-abroad/united-kingdom">Post-study work rights');
  });

  it('keeps the post-study work link on the guide’s work section', () => {
    expect(withGuide(ukGuide)).toContain(
      'href="/study-abroad/united-kingdom#work-visa">Post-study work rights',
    );
    /* Without the guide to ask, the anchor it always had. */
    expect(withGuide(null)).toContain(
      'href="/study-abroad/united-kingdom#work-visa">Post-study work rights',
    );
  });

  it('leads the talk band to the destination’s consultants and their cities, keeping counselling', () => {
    const html = withGuide(ukGuide);
    const talk = html.slice(html.indexOf('id="talk"'), html.indexOf('id="careers"'));
    expect(talk).toContain(
      'href="/study-abroad/united-kingdom/consultants">Find United Kingdom consultants',
    );
    expect(talk).toContain(
      '4 consultants on Universta support students planning to study in the United Kingdom.',
    );
    expect(talk).toContain('Near you');
    expect(talk).toContain('href="/study-abroad/united-kingdom/consultants?city=London"');
    expect(talk).toContain('Book free counselling');
    /* One band in the slot, not a second consultants band beside it. */
    expect(html).not.toContain('id="consultants"');
  });

  it('offers only counselling when the destination has no consultants', () => {
    const html = withGuide({ ...ukGuide, consultants: { total: 0, cities: [] } });
    const talk = html.slice(html.indexOf('id="talk"'), html.indexOf('id="careers"'));
    /* No link to a consultants page, old address or new. */
    expect(talk).not.toMatch(/href="[^"]*consultants/);
    expect(talk).not.toContain('Near you');
    expect(talk).toContain('class="btn" href="/counselling');
  });

  it('names English in the panel from the course’s English test, with its score', () => {
    const html = render(
      detail({
        requirements: [
          { category: 'ENGLISH_TEST', title: 'IELTS', minimumScore: '6.50' },
          { category: 'ACADEMIC', title: 'Degree' },
        ],
      }),
    );
    expect(html).toMatch(
      /snap__k">Language<\/span><span class="snap__v">English<\/span><span class="snap__n">IELTS 6.5 minimum</,
    );
  });

  it('leaves the language unlisted without an English test, whatever else the course asks', () => {
    const html = render(
      detail({ requirements: [{ category: 'LANGUAGE_TEST', title: 'TestDaF', minimumScore: '4' }] }),
    );
    expect(html).toMatch(/snap__k">Language<\/span><span class="snap__v uc-none">Not listed</);
  });

  it('shows the questions editors wrote for the course, after careers, numbered and in the strip', () => {
    const html = renderToStaticMarkup(
      <OfferingGuide
        detail={detail()}
        faqs={[
          { id: 'f1', question: 'Do I need a computing degree?', answer: '<p>Usually, or strong maths.</p>' },
          { id: 'f2', question: 'Empty one', answer: '<p> </p>' },
        ]}
        today={new Date('2026-10-05T00:00:00Z')}
      />,
    );
    expect(html).toContain('<a href="#faqs">FAQs</a>');
    expect(html).toMatch(/eyebrow__n">08<\/span>(?:\s|<!-- -->)*Questions/);
    expect(html).toContain('About this course');
    expect(html).toContain('Do I need a computing degree?');
    expect(html).not.toContain('Empty one');
    expect(html.indexOf('id="careers"')).toBeLessThan(html.indexOf('id="faqs"'));
    expect(html.indexOf('id="faqs"')).toBeLessThan(html.indexOf('id="university"'));
    expect(html).toContain('"@type":"FAQPage"');
    expect(html).toContain('"text":"Usually, or strong maths."');
  });

  it('draws no questions band when the course has none', () => {
    const html = render();
    expect(html).not.toContain('id="faqs"');
    expect(html).not.toContain('FAQPage');
  });

  it('describes its breadcrumb trail to search engines, ending on the course', () => {
    const html = render();
    const match = html.match(
      /<script type="application\/ld\+json">(\{"@context":"https:\/\/schema.org","@type":"BreadcrumbList".*?)<\/script>/,
    );
    const crumbs = JSON.parse(match![1]!) as {
      itemListElement: Array<{ name: string; item: string }>;
    };
    expect(crumbs.itemListElement.map((step) => step.name)).toEqual([
      'Home',
      'Study abroad',
      'United Kingdom',
      'Universities',
      'University of Oxford',
      'Courses',
      'MSc Computer Science',
    ]);
    expect(crumbs.itemListElement.at(-1)!.item).toMatch(
      /\/study-abroad\/united-kingdom\/universities\/university-of-oxford\/courses\/university-of-oxford-msc-computer-science$/,
    );
  });

  it('says the course is taught in English only when it asks for an English test', () => {
    expect(offeringJsonLd(detail(), 'https://universta.example').inLanguage).toBeUndefined();
    expect(
      offeringJsonLd(
        detail({ requirements: [{ category: 'ENGLISH_TEST', title: 'IELTS', minimumScore: '6.5' }] }),
        'https://universta.example',
      ).inLanguage,
    ).toBe('en');
  });
});
