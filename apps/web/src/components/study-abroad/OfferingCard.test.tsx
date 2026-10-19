import { describe, expect, it, vi } from 'vitest';

/* The heart is the student portal's save, which reads the router. */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {} }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

import { renderToStaticMarkup } from 'react-dom/server';
import { toOfferingCard } from '@/lib/university-courses';
import { OfferingCard, type ProgrammeCardData } from './OfferingCard';

/**
 * The programme card, as the design draws it: the four facts in its order
 * -- duration, language, tuition, intake -- with "Not listed" where the
 * record is silent; the heart and the Compare tick at the top; and in the
 * foot "View course", "Check eligibility" to the course page's own
 * section, and the course guide. Everything the card carried before stays:
 * the study mode as a tag, the specialization, campus, deadline and code.
 */

const uk = { name: 'United Kingdom', slug: 'united-kingdom', iso2Code: 'GB' };

function card(over: Record<string, unknown> = {}, extra: Partial<ProgrammeCardData> = {}) {
  const base = toOfferingCard({
    id: '9d30d45a-73fd-497a-8337-150174e8155c',
    name: 'MSc Computer Science at University of Warwick',
    slug: 'university-of-warwick-msc-computer-science',
    studyMode: 'FULL_TIME',
    durationMin: '1',
    durationUnit: 'YEARS',
    courseCode: 'G5PD',
    campus: { name: 'Main campus', city: 'Coventry' },
    genericCourse: {
      slug: 'msc-computer-science',
      qualificationName: 'Master of Science',
      subject: { name: 'Computer Science', slug: 'computer-science' },
      subSubject: { name: 'Artificial Intelligence', slug: 'artificial-intelligence' },
      courseLevel: { code: 'PG', name: "Master's" },
    },
    intakes: [{ deadline: '2099-08-02', intake: { name: 'September', startMonth: 9, endMonth: 9 } }],
    university: { name: 'University of Warwick', slug: 'university-of-warwick', country: uk, campuses: [{ city: 'Coventry' }] },
    ...over,
  })!;
  return { ...base, ...extra };
}

const render = (course: ProgrammeCardData, show: 'subject' | 'university' = 'university') =>
  renderToStaticMarkup(<OfferingCard course={course} show={show} />);

const facts = (html: string) =>
  [...html.matchAll(/<dt>([^<]+)<\/dt><dd[^>]*>(.*?)<\/dd>/g)].map(
    (match) => [match[1], match[2]!.replace(/<[^>]+>/g, '')] as const,
  );

describe('the programme card', () => {
  it('lists the design’s four facts, in its order', () => {
    expect(facts(render(card())).map(([label]) => label)).toEqual([
      'Duration',
      'Language',
      'Tuition',
      'Intake',
    ]);
  });

  it('names English only on the course’s English-test evidence, with the score in the tags', () => {
    const evidenced = card({}, { language: { value: 'English', note: 'IELTS 6.5 minimum' } });
    /* One word in the cell, as on the design's card; the evidence, word for
       word and without the brackets it used to be wrapped in, as a tag. */
    expect(facts(render(evidenced))[1]).toEqual(['Language', 'English']);
    expect(render(evidenced)).toContain('<span class="tag coursecard__test">IELTS 6.5 minimum</span>');
    expect(render(evidenced)).not.toContain('(IELTS');
    expect(facts(render(card({}, { language: null })))[1]).toEqual(['Language', 'Not listed']);
    /* A list that does not carry the language yet says so, too. */
    expect(facts(render(card()))[1]).toEqual(['Language', 'Not listed']);
    expect(render(card())).toContain('<dt>Language</dt><dd class="coursecard__none">Not listed</dd>');
  });

  it('keeps the study mode, now as a tag, written for a reader', () => {
    const html = render(card());
    expect(html).toContain('<span class="tag">Full time</span>');
    expect(html).not.toContain('FULL_TIME');
  });

  it('lists each accepted test as its own tag, as the record names it', () => {
    const html = render(
      card({
        requirements: [
          { category: 'ENGLISH_TEST', title: 'TOEFL iBT (official score report)', minimumScore: null },
          { category: 'ENGLISH_TEST', title: 'IELTS Academic', minimumScore: '6.5' },
        ],
      }),
    );
    expect(facts(html)[1]).toEqual(['Language', 'English']);
    expect(html).toContain('<span class="tag coursecard__test">TOEFL iBT (official score report)</span>');
    expect(html).toContain('<span class="tag coursecard__test">IELTS Academic 6.5 minimum</span>');
    expect(html).not.toContain('English (TOEFL');
  });

  it('says what kind of programme it is in the design’s short type line', () => {
    const short = card({
      genericCourse: {
        slug: 'mist',
        shortName: 'MIST',
        qualificationName: 'Master of Information Science and Technology',
        courseLevel: { code: 'PG', name: "Master's" },
      },
    });
    expect(render(short)).toContain('<span class="coursecard__type">Master&#x27;s · MIST</span>');
    /* No short name: the qualification stands in, clamped, whole in the title. */
    expect(render(card())).toContain(
      '<span class="coursecard__type coursecard__type--long" title="Master&#x27;s · Master of Science">Master&#x27;s · Master of Science</span>',
    );
  });

  it('keeps the fee whole, breaking only before "/yr"', () => {
    const html = render(card({ tuitionMin: '535800', currencyCode: 'JPY', tuitionPeriod: 'PER_YEAR' }));
    expect(html).toContain('JPY 535,800<wbr/><span class="coursecard__per">/yr</span>');
    expect(facts(html)[2]).toEqual(['Tuition', 'JPY 535,800/yr']);
  });

  it('keeps every tag and link the card had', () => {
    const html = render(card());
    expect(html).toContain(
      'href="/study-abroad/united-kingdom/computer-science/artificial-intelligence"',
    );
    expect(html).toContain('Artificial Intelligence in the United Kingdom');
    expect(html).toContain('Campus: Main campus');
    expect(html).toContain('Apply by 2 August 2099');
    expect(html).toContain('Code G5PD');
    expect(html).toContain('class="coursecard__uni" href="/universities/university-of-warwick"');
    expect(html).toContain('aria-label="Compare MSc Computer Science · University of Warwick"');
  });

  it('leads to the course and, from “Check eligibility”, to its eligibility section', () => {
    const html = render(card());
    const href =
      '/study-abroad/united-kingdom/universities/university-of-warwick/courses/university-of-warwick-msc-computer-science';
    expect(html).toContain(`class="btn btn--sm" href="${href}"`);
    expect(html).toContain(`class="linkbtn" href="${href}#eligibility">Check eligibility</a>`);
  });

  it('links the course guide when the card knows the course it is an instance of', () => {
    const html = render(card({}, { genericCourse: { name: 'MSc Computer Science', slug: 'msc-computer-science' } }));
    const guide = html.match(/<a class="linkbtn coursecard__guide"[^>]*>Course guide<\/a>/)?.[0];
    expect(guide).toContain('href="/courses/msc-computer-science"');
    expect(guide).toContain('aria-label="Course guide: MSc Computer Science"');
    expect(render(card())).not.toContain('Course guide');
  });

  it('leaves the course guide out where the card sits on that guide', () => {
    const course = card({}, { genericCourse: { name: 'MSc Computer Science', slug: 'msc-computer-science' } });
    const html = renderToStaticMarkup(
      <OfferingCard course={course} show="university" guideLink={false} />,
    );
    expect(html).not.toContain('Course guide');
    expect(html).not.toContain('href="/courses/msc-computer-science"');
    /* The rest of the foot stays. */
    expect(html).toContain('>Check eligibility</a>');
    expect(html).toContain('View course');
  });

  it('carries the design’s heart, which saves to the student’s account', () => {
    const html = render(card());
    expect(html).toContain('class="tinybtn" aria-pressed="false" aria-label="Save MSc Computer Science at University of Warwick"');
    expect(html).toContain('<path d="M20.8 5.6');
    /* The heart sits before the Compare tick, as in the design. */
    expect(html.indexOf('class="tinybtn"')).toBeLessThan(html.indexOf('class="tinycheck"'));
  });

  it('draws no heart for a row that has no id of its own to save', () => {
    const slugOnly = card({ id: undefined });
    expect(slugOnly.id).toBe(slugOnly.slug);
    expect(render(slugOnly)).not.toContain('class="tinybtn"');
    /* The offering's own id, where the list gives it, is the one saved. */
    expect(render(card({ id: undefined }, { offeringId: 'abc' }))).toContain('class="tinybtn"');
  });
});
