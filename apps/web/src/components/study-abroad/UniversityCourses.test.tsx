import { describe, expect, it, vi } from 'vitest';

/* The page sits inside the Study Abroad shell, which supplies the
   assessment through context, and its results block reads the router.
   Neither is what these assertions are about, so both are stubbed. */
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
  readCourseFilters,
  toCourseFacets,
  toOfferingCards,
} from '@/lib/university-courses';
import { UniversityCourses, type UniversityCoursesProps } from './UniversityCourses';

/**
 * A university's courses, filed under its country: the design's listing
 * head and results block, behaving like the reference's course list. The
 * figures, the ways in by level and subject, the intakes panel, the
 * university's scholarships and the questions all stay, restyled; a
 * university with nothing in the catalogue says so instead of drawing a
 * filter panel over nothing.
 */

const uk = { name: 'United Kingdom', slug: 'united-kingdom', iso2Code: 'GB' };
const owner = { name: 'University of Oxford', slug: 'university-of-oxford', country: uk, city: 'Oxford' };

const row = (index: number, over: Record<string, unknown> = {}) => ({
  id: `o${index}`,
  name: `MSc Course ${index} at University of Oxford`,
  slug: `university-of-oxford-msc-course-${index}`,
  studyMode: 'FULL_TIME',
  durationMin: '1',
  durationUnit: 'YEARS',
  campus: { name: 'City colleges', city: 'Oxford' },
  genericCourse: {
    qualificationName: 'Master of Science',
    subject: { name: 'Computer Science', slug: 'computer-science' },
    subSubject: index === 0 ? { name: 'Artificial Intelligence', slug: 'artificial-intelligence' } : null,
    courseLevel: { code: 'PG', name: "Master's" },
  },
  intakes: [],
  ...over,
});

const facets = toCourseFacets({
  levels: [
    { value: 'UG', label: "Bachelor's", count: 10 },
    { value: 'PG', label: "Master's", count: 30 },
  ],
  subjects: [
    { value: 'computer-science', label: 'Computer Science', count: 25 },
    { value: 'law', label: 'Law', count: 15 },
  ],
  studyModes: [
    { value: 'FULL_TIME', label: 'FULL_TIME', count: 38 },
    { value: 'PART_TIME', label: 'PART_TIME', count: 2 },
  ],
  intakes: [{ value: 'september', label: 'September', startMonth: 9, endMonth: 9, count: 40 }],
});

function props(over: Partial<UniversityCoursesProps> = {}): UniversityCoursesProps {
  return {
    university: { name: owner.name, slug: owner.slug, websiteUrl: 'https://www.ox.ac.uk', country: uk, city: 'Oxford' },
    filters: readCourseFilters({}),
    facets,
    cards: toOfferingCards(Array.from({ length: 18 }, (_, index) => row(index)), owner),
    meta: { page: 1, limit: 18, total: 40, totalPages: 3 },
    catalogueTotal: 40,
    campuses: 1,
    deadlines: [{ label: 'September', deadline: '2027-01-15', count: 12 }],
    scholarships: [],
    ...over,
  };
}

const render = (over: Partial<UniversityCoursesProps> = {}) =>
  renderToStaticMarkup(<UniversityCourses {...props(over)} />);

describe('a university’s course list', () => {
  it('files the page under its country in the breadcrumb', () => {
    const html = render();
    for (const href of [
      'href="/study-abroad"',
      'href="/study-abroad/united-kingdom"',
      'href="/study-abroad/united-kingdom/universities"',
      'href="/universities/university-of-oxford"',
    ])
      expect(html).toContain(href);
    expect(html).toContain('<span aria-current="page">Courses</span>');
  });

  it('keeps all six figures, in the design’s strip', () => {
    const html = render();
    expect(html).toContain('statstrip statstrip--6');
    for (const label of ['Courses', 'Degree levels', 'Subjects', 'Study modes', 'Campuses', 'Intakes'])
      expect(html).toContain(`<span>${label}</span>`);
  });

  it('lists popular subjects with counts, each opening that subject in the country', () => {
    const html = render();
    expect(html).toContain('Popular subjects here');
    expect(html).toContain('href="/study-abroad/united-kingdom/computer-science"');
    expect(html).toContain('Computer Science<em>25</em>');
  });

  it('shows the first eighteen as the design’s course cards, each leading to its eligibility', () => {
    const html = render();
    expect((html.match(/class="coursecard"/g) ?? []).length).toBe(18);
    expect(html).toContain(
      'href="/study-abroad/united-kingdom/universities/university-of-oxford/courses/university-of-oxford-msc-course-0#eligibility"',
    );
    /* The university's own name is not repeated on its own list. */
    expect(html).toContain('>MSc Course 0</a>');
    expect(html).toContain('Load more courses');
    expect(html).toContain('Showing 18 of 40');
  });

  it('renders as far as the address says “Load more” had gone, with a link one page further for no script', () => {
    const html = render({
      filters: readCourseFilters({ level: 'PG', page: '2' }),
      cards: toOfferingCards(Array.from({ length: 36 }, (_, index) => row(index)), owner),
      meta: { page: 2, limit: 18, total: 40, totalPages: 3 },
    });
    expect((html.match(/class="coursecard"/g) ?? []).length).toBe(36);
    expect(html).toContain('Showing 36 of 40');
    expect(html).not.toContain('Showing from course');
    expect(html).toContain(
      'href="/study-abroad/united-kingdom/universities/university-of-oxford/courses?level=PG&amp;page=3#courses"',
    );
    expect(html).toContain('Show more courses');
  });

  it('writes the country into sentences with its article', () => {
    const html = render({
      scholarships: [
        {
          id: 's1',
          title: 'Oxford Award',
          slug: 'oxford-award',
          summary: null,
          provider: null,
          benefit: null,
          award: null,
          deadline: null,
          eligibility: null,
          countries: [],
          universities: [],
        },
      ],
    });
    for (const phrase of [
      'Universities in the United Kingdom',
      'Study in the United Kingdom',
      'Scholarships in the United Kingdom',
      'All scholarships in the United Kingdom',
      /* A course card's specialization tag. */
      'Artificial Intelligence in the United Kingdom',
    ])
      expect(html).toContain(phrase);
    expect(html).not.toMatch(/in United Kingdom/);
  });

  it('says “Not listed” on a card rather than leaving a fact out', () => {
    const html = render();
    expect(html).toContain('<dt>Tuition</dt><dd class="coursecard__none">Not listed</dd>');
    expect(html).toContain('<dt>Intake</dt><dd class="coursecard__none">Not listed</dd>');
  });

  it('offers the reference’s filters with counts, and its sort', () => {
    const html = render();
    expect(html).toContain('Degree level');
    expect(html).toContain('name="level" value="PG"');
    expect(html).toContain('Study mode');
    expect(html).toContain('Part time');
    for (const label of ['Most relevant', 'Name A-Z', 'Lowest tuition', 'Next deadline', 'Shortest first'])
      expect(html).toContain(`>${label}</option>`);
    /* One intake covering every course narrows nothing, so it is not offered. */
    expect(html).not.toContain('name="intake"');
  });

  it('shows each filter in force as a chip that removes only itself', () => {
    const html = render({ filters: readCourseFilters({ level: 'PG', subject: 'law', sort: 'fee' }) });
    expect(html).toContain('class="activechip"');
    expect(html).toContain(
      'href="/study-abroad/united-kingdom/universities/university-of-oxford/courses?subject=law&amp;sort=fee"',
    );
    expect(html).toContain('of 40');
  });

  it('keeps the ways in by level, by subject and by intake, and the questions', () => {
    const html = render();
    expect(html).toContain('Browse by degree level');
    expect(html).toContain('courses?level=PG#courses');
    expect(html).toContain('Browse by subject');
    expect(html).toContain('href="/subjects/law"');
    expect(html).toContain('Intakes and deadlines');
    expect(html).toContain('Jan 15, 2027');
    expect(html).toContain('Are these all the courses this university offers?');
    expect(html).toContain('Shortlist your University of Oxford courses');
  });

  it('carries the destination into counselling and links the official website', () => {
    const html = render();
    expect(html).toContain('/counselling?source=country&amp;country=united-kingdom&amp;from=');
    expect(html).toContain('href="https://www.ox.ac.uk"');
  });

  it('says plainly when the catalogue holds nothing for the university', () => {
    const html = render({ cards: [], catalogueTotal: 0, meta: { page: 1, limit: 18, total: 0, totalPages: 0 }, facets: toCourseFacets({}) });
    expect(html).toContain('No course at this university is in our catalogue yet.');
    expect(html).toContain('Check the official university website');
    expect(html).not.toContain('filters-panel');
    expect(html).not.toContain('No course at University of Oxford matches');
  });
});
