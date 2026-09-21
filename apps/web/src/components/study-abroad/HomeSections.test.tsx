import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DestinationDirectory, Destination } from '@/lib/study-abroad';
import {
  HomeCourses,
  HomeHero,
  HomeInstitutions,
  HomeScholarships,
  HomeSubjects,
  HomeTools,
  HomeTrust,
  HomeUniversities,
} from './HomeSections';

/* The assessment entry point needs the route family's shell, which only exists
   in the browser. The sections under test are server-rendered markup, so the
   hook is stubbed rather than mounting a shell around every case. */
vi.mock('./StudyAbroadShell', () => ({
  useStudyAbroadShell: () => ({ openAssessment: () => {} }),
}));

const destination = (over: Partial<Destination> = {}): Destination => ({
  name: 'Germany',
  slug: 'germany',
  iso2Code: 'DE',
  isPopular: true,
  isAvailable: true,
  region: 'Europe',
  summary: null,
  bands: null,
  counts: { universities: 4, courses: 10, scholarships: 5, consultants: 3 },
  ...over,
});

const directory = (over: Partial<DestinationDirectory> = {}): DestinationDirectory => ({
  available: [destination(), destination({ name: 'Ireland', slug: 'ireland' })],
  comingSoon: [],
  regions: ['Europe'],
  counts: { available: 2, popular: 2, total: 2 },
  ...over,
});

describe('homepage funnel sections', () => {
  /* The hero sums the directory the page already loaded. Counting again would
     be a second set of numbers to keep in step with the cards below. */
  it('sums what the platform holds from the listing it already has', () => {
    const html = renderToStaticMarkup(<HomeHero directory={directory()} />);
    expect(html).toContain('<b>2</b> countries');
    expect(html).toContain('<b>8</b> universities');
    expect(html).toContain('<b>20</b> courses');
    expect(html).toContain('<b>10</b> scholarships');
  });

  it('leaves a figure out of the hero when there is nothing to report', () => {
    const html = renderToStaticMarkup(
      <HomeHero
        directory={directory({
          available: [
            destination({
              counts: { universities: 4, courses: 10, scholarships: 0, consultants: 0 },
            }),
          ],
          counts: { available: 1, popular: 1, total: 1 },
        })}
      />,
    );
    /* Asserted against the stat item, not the page: "scholarships" also
       appears in the hero's own copy and in its second call to action. */
    expect(html).toContain('<b>4</b> universities');
    expect(html).not.toContain('</b> scholarships');
  });

  /* A card whose destination does not exist yet must not pretend to navigate:
     the same rule the directory applies to a destination with no guide. */
  it('links the tools that exist and marks the rest as coming', () => {
    const html = renderToStaticMarkup(<HomeTools />);
    expect(html).toContain('href="/courses"');
    expect(html).toContain('href="/universities"');
    expect(html).toContain('href="/compare/courses"');
    expect(html).toContain('Eligibility Checker');
    expect(html).toContain('data-soon="true"');
    expect(html).not.toContain('href="/eligibility-checker"');
    expect(html).not.toContain('href="/document-checklist"');
  });

  it('does not invent partner routes that have not been built', () => {
    const html = renderToStaticMarkup(<HomeInstitutions />);
    for (const missing of [
      'href="/for-universities"',
      'href="/for-scholarship-providers"',
      'href="/for-coaching-institutes"',
      'href="/for-consultants"',
    ])
      expect(html).not.toContain(missing);
    expect(html).toContain('Scholarship providers');
  });

  /* Every trust card is a statement, so this section has nothing behind it to
     build and carries no link that could go nowhere. */
  it('states the trust rules without linking anywhere', () => {
    const html = renderToStaticMarkup(<HomeTrust />);
    expect(html).toContain('Official sources first');
    expect(html).toContain('No invented numbers');
    expect(html).not.toContain('<a ');
  });
});

describe('homepage search and catalogue previews', () => {
  /* The design's box searched a /search page this site does not have, so it
     searches courses, and its placeholder says so rather than promising more. */
  it('searches courses and offers the popular starting points', () => {
    const html = renderToStaticMarkup(
      <HomeHero
        directory={directory()}
        popular={[
          { label: 'Germany', href: '/study-abroad/germany' },
          { label: 'Computer Science', href: '/subjects/computer-science' },
        ]}
      />,
    );
    expect(html).toContain('action="/courses"');
    expect(html).toContain('name="q"');
    expect(html).toContain('placeholder="Search courses, e.g. Computer Science"');
    expect(html).toContain('href="/study-abroad/germany"');
    expect(html).toContain('href="/subjects/computer-science"');
  });

  it('leaves the popular row out when there is nothing to offer', () => {
    expect(renderToStaticMarkup(<HomeHero directory={directory()} />)).not.toContain('bigsearch__ex');
  });

  it('links each preview card to its page and says what it holds', () => {
    const subjects = renderToStaticMarkup(
      <HomeSubjects
        subjects={[{ id: 's', name: 'Engineering', slug: 'engineering', publishedCourseCount: 12, publishedSubSubjectCount: 1 }]}
      />,
    );
    expect(subjects).toContain('href="/subjects/engineering"');
    expect(subjects).toContain('1 specialization');
    expect(subjects).toContain('12 courses');

    const universities = renderToStaticMarkup(
      <HomeUniversities
        universities={[{ id: 'u', name: 'TUM', slug: 'tum', country: { name: 'Germany' }, campuses: [{ city: { name: 'Munich' } }], _count: { offerings: 1 } }]}
      />,
    );
    expect(universities).toContain('href="/universities/tum"');
    expect(universities).toContain('Munich, Germany');
    expect(universities).toContain('1 course on Universta');

    const courses = renderToStaticMarkup(
      <HomeCourses courses={[{ id: 'c', name: 'MSc Robotics', slug: 'msc-robotics', courseLevel: { name: 'Postgraduate' } }]} />,
    );
    expect(courses).toContain('href="/courses/msc-robotics"');
    expect(courses).toContain('Postgraduate');
  });

  it('reads a free-text benefit type as words', () => {
    const html = renderToStaticMarkup(
      <HomeScholarships
        scholarships={[{ id: 'x', title: 'DAAD', slug: 'daad', summary: 'Germany’s exchange service.', benefitType: 'PARTIAL_TUITION' }]}
      />,
    );
    expect(html).toContain('Partial tuition');
    expect(html).toContain('href="/scholarships/daad"');
  });

  /* A preview with nothing published is left out, not shown as an empty shelf. */
  it('stands a preview down when there is nothing published', () => {
    expect(renderToStaticMarkup(<HomeSubjects subjects={[]} />)).toBe('');
    expect(renderToStaticMarkup(<HomeUniversities universities={[]} />)).toBe('');
    expect(renderToStaticMarkup(<HomeCourses courses={[]} />)).toBe('');
    expect(renderToStaticMarkup(<HomeScholarships scholarships={[]} />)).toBe('');
  });
});
