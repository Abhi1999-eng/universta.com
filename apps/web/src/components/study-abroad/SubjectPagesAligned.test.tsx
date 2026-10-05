import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { SpecializationDetail, SubjectDetail } from '@/lib/catalog';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

/* The closing bands open the assessment through the page shell; they are
   not what this file is about. */
vi.mock('./StudyAbroadShell', () => ({
  useStudyAbroadShell: () => ({ openAssessment: vi.fn(), openMatch: vi.fn() }),
}));

const { Crumbs } = await import('./Crumbs');
const { SpecializationGuide } = await import('./SpecializationGuide');
const { SubjectGuide } = await import('./SubjectGuide');

/**
 * The parts of the alignment pass that are markup, not stylesheet: where a
 * slash sits in a breadcrumb, which block a hero is built from, and what a
 * section's "see all" link is. The rest was measured in a browser.
 */
const country = { id: 'uk', name: 'United Kingdom', slug: 'uk', iso2Code: 'GB' };
const specialization = {
  id: 'ee',
  name: 'Energy Engineering',
  slug: 'energy-engineering',
  shortDescription: null,
  overview: null,
  subject: { id: 'eog', name: 'Energy, Oil & Gas', slug: 'energy-oil-gas', shortDescription: null },
  siblings: [
    { id: 'se', name: 'Solar Energy', slug: 'solar-energy' },
    { id: 'we', name: 'Wind Energy', slug: 'wind-energy' },
  ],
  countries: [country],
  courses: [],
} as unknown as SpecializationDetail;

const subject = {
  id: 'eog',
  name: 'Energy, Oil & Gas',
  slug: 'energy-oil-gas',
  shortDescription: null,
  overview: null,
  iconMedia: null,
  publishedCourseCount: 0,
  subSubjects: [],
  countries: [country],
  tests: [],
  courseCountsByLevel: [],
  featuredCourses: [],
  seo: null,
} as unknown as SubjectDetail;

describe('the breadcrumb', () => {
  it('makes each slash and each step a child of the nav, so the gap falls on both sides of a slash', () => {
    const html = renderToStaticMarkup(
      <Crumbs
        trail={[
          { label: 'Home', href: '/' },
          { label: 'Subjects', href: '/subjects' },
          { label: 'Energy' },
        ]}
      />,
    );
    expect(html).toBe(
      '<nav class="crumbs" aria-label="Breadcrumb">' +
        '<a href="/">Home</a>' +
        '<span class="crumbs__sep" aria-hidden="true">/</span>' +
        '<a href="/subjects">Subjects</a>' +
        '<span class="crumbs__sep" aria-hidden="true">/</span>' +
        '<span aria-current="page">Energy</span>' +
        '</nav>',
    );
  });
});

describe('a specialization’s page', () => {
  const html = renderToStaticMarkup(<SpecializationGuide specialization={specialization} />);

  it('opens with the subject page’s hero: the tile, then the text beside it', () => {
    expect(html).toMatch(/<div class="subjhero"><span class="subjhero__icon" aria-hidden="true">/);
    expect(html).not.toContain('class="hero__lead"');
  });

  it('sets a section’s link as a link, apart from the sentence above it', () => {
    expect(html).toMatch(
      /<p class="sec-head__cta"><a class="linkcta" href="\/study-abroad">All destinations/,
    );
    expect(html).not.toMatch(/<p class="sec-lead"><a /);
  });

  it('gives the related specializations the compact head, and a way to the rest of them', () => {
    expect(html).toMatch(/<section class="sec sec--(paper|white) sec--tight" id="related">/);
    expect(html).toMatch(/<h2 class="sec-title sec-title--sm">Other Energy, Oil &amp; Gas specializations<\/h2>/);
    expect(html).toMatch(
      /<a class="linkcta" href="\/subjects\/energy-oil-gas\/specializations">All Energy, Oil &amp; Gas specializations/,
    );
  });
});

describe('a subject’s page', () => {
  it('sets "All destinations" as a link, apart from the sentence above it', () => {
    const html = renderToStaticMarkup(<SubjectGuide subject={subject} scholarships={[]} />);
    expect(html).toMatch(
      /<p class="sec-head__cta"><a class="linkcta" href="\/study-abroad">All destinations/,
    );
    expect(html).not.toMatch(/<p class="sec-lead"><a /);
  });
});
