import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  CountryDetailReference,
  type CountryDetailReferenceProps,
} from './CountryDetailReference';

/**
 * Every row of the hero "at a glance" panel comes from an Admin-managed
 * profile. On the deployed catalogue none of those profiles were filled in, so
 * all six rows resolved to null and the aside still rendered: a titled card
 * with a subtitle and nothing under it, on all six country pages, with the
 * hero heading stranded at 62% width beside the empty column.
 */

const emptyProfiles = {
  cost: null,
  work: null,
  language: null,
  statistics: null,
  intakes: [],
} as unknown as CountryDetailReferenceProps['page']['profiles'];

function build(
  profiles: CountryDetailReferenceProps['page']['profiles'],
  derived?: unknown,
): CountryDetailReferenceProps {
  return {
    page: {
      country: {
        id: 'c1',
        name: 'United Kingdom',
        slug: 'united-kingdom',
        pageHeading: 'Study in the United Kingdom',
        shortDescription: 'Explore universities across the United Kingdom.',
        continent: { id: 'e1', name: 'Europe', slug: 'europe' },
        flag: null,
        featured: false,
        displayOrder: 0,
        derived,
      },
      profiles,
      sections: [],
      faqs: [],
      seo: null,
      consultantCards: [],
    },
    cities: [],
    universities: [],
    universityTotal: 0,
    scholarships: [],
    scholarshipTotal: 0,
    subjects: [],
    courseTotal: 0,
  } as unknown as CountryDetailReferenceProps;
}

describe('CountryDetailReference hero quick facts', () => {
  it('omits the at-a-glance panel when no figure is published', () => {
    const html = renderToStaticMarkup(<CountryDetailReference {...build(emptyProfiles)} />);
    expect(html).not.toContain('quickfacts');
    expect(html).not.toContain('at a glance');
    // and the hero must not keep an empty second column
    expect(html).toContain('hero-grid-solo');
  });

  it('renders the panel, and no solo modifier, as soon as one figure exists', () => {
    const withCost = {
      ...emptyProfiles,
      cost: { currencyCode: 'GBP', tuitionMin: '20000', tuitionMax: '30000', tuitionPeriod: 'PER_YEAR' },
    } as unknown as CountryDetailReferenceProps['page']['profiles'];
    const html = renderToStaticMarkup(<CountryDetailReference {...build(withCost)} />);
    expect(html).toContain('quickfacts');
    expect(html).toContain('at a glance');
    expect(html).toContain('Tuition');
    expect(html).not.toContain('hero-grid-solo');
  });

  it('uses API-derived institutional facts without requiring duplicate country profiles', () => {
    const derived = {
      averageTuition: {
        amount: '28666.67',
        currencyCode: 'GBP',
        currencySymbol: '£',
        period: 'PER_YEAR',
        offeringCount: 3,
      },
      statistics: {
        universitiesCount: 2,
        publicUniversitiesCount: 2,
        coursesCount: 3,
      },
      topRankedUniversities: [
        {
          id: 'u-top',
          name: 'Acceptance Ranked University',
          slug: 'acceptance-ranked-university',
          institutionType: 'PUBLIC',
          qsRanking: 24,
        },
      ],
      popularUniversities: [
        {
          id: 'u-popular',
          name: 'Acceptance Popular University',
          slug: 'acceptance-popular-university',
          institutionType: 'PUBLIC',
          qsRanking: null,
        },
      ],
      popularCourses: [
        {
          id: 'course-popular',
          name: 'Acceptance Popular Course',
          slug: 'acceptance-popular-course',
          shortDescription: 'A catalogue-backed course card.',
        },
      ],
    };

    const html = renderToStaticMarkup(
      <CountryDetailReference {...build(emptyProfiles, derived)} />,
    );

    expect(html).toContain('Average tuition');
    expect(html).toContain('GBP 28,666.67');
    expect(html).toContain('Universities');
    expect(html).toContain('Public universities');
    expect(html).toContain('Courses');
    expect(html).toContain('Top ranked universities');
    expect(html).toContain('Acceptance Ranked University');
    expect(html).toContain('Popular universities');
    expect(html).toContain('Acceptance Popular University');
    expect(html).toContain('Popular courses');
    expect(html).toContain('Acceptance Popular Course');
    expect(html).not.toContain('hero-grid-solo');
  });
});

/**
 * The country page carries three university blocks -- the published listing,
 * the QS-ranked highlights and the curated picks -- each an independent query
 * over the same published set. On a large catalogue they name different
 * institutions. On Malta, which publishes one university holding a QS position
 * and ticked as popular, all three named it and the page printed the same card
 * three times. Each block now shows only what the blocks above it have not.
 */

const ranked = (name: string, slug: string, qsRanking: number | null) => ({
  id: `ranked-${slug}`,
  name,
  slug,
  institutionType: 'PRIVATE',
  qsRanking,
});

const listed = (name: string, slug: string) => ({
  name,
  slug,
  city: null,
  institutionType: 'PRIVATE',
  verified: false,
});

function buildUniversities(overrides: {
  universities?: ReturnType<typeof listed>[];
  topRankedUniversities?: ReturnType<typeof ranked>[];
  popularUniversities?: ReturnType<typeof ranked>[];
}): CountryDetailReferenceProps {
  const base = build(emptyProfiles, {
    averageTuition: null,
    statistics: null,
    topRankedUniversities: overrides.topRankedUniversities ?? [],
    popularUniversities: overrides.popularUniversities ?? [],
    popularCourses: [],
  });
  const universities = overrides.universities ?? [];
  return {
    ...base,
    universities,
    universityTotal: universities.length,
  } as unknown as CountryDetailReferenceProps;
}

/** Counts rendered cards rather than raw text, so a name appearing in prose
 * cannot mask a duplicated card. */
function profileLinkCount(html: string, slug: string) {
  return html.split(`href="/universities/${slug}"`).length - 1;
}

describe('CountryDetailReference university deduplication', () => {
  it('renders a university present in all three datasets exactly once', () => {
    const html = renderToStaticMarkup(
      <CountryDetailReference
        {...buildUniversities({
          universities: [listed('Malta Institute of Technology', 'malta-institute-of-technology')],
          topRankedUniversities: [
            ranked('Malta Institute of Technology', 'malta-institute-of-technology', 801),
          ],
          popularUniversities: [
            ranked('Malta Institute of Technology', 'malta-institute-of-technology', 801),
          ],
        })}
      />,
    );

    expect(html.split('Malta Institute of Technology').length - 1).toBe(1);
    expect(profileLinkCount(html, 'malta-institute-of-technology')).toBe(1);
    expect(html).toContain('Universities in United Kingdom');
    expect(html).not.toContain('Top ranked universities');
    expect(html).not.toContain('Popular universities');
  });

  it('keeps the QS ranking on the listing card when the ranked block is suppressed', () => {
    const html = renderToStaticMarkup(
      <CountryDetailReference
        {...buildUniversities({
          universities: [listed('Malta Institute of Technology', 'malta-institute-of-technology')],
          topRankedUniversities: [
            ranked('Malta Institute of Technology', 'malta-institute-of-technology', 801),
          ],
        })}
      />,
    );

    expect(html).toContain('QS ranking');
    expect(html).toContain('#801');
    expect(html).not.toContain('Top ranked universities');
  });

  it('renders the ranked block for a university missing from the listing', () => {
    const html = renderToStaticMarkup(
      <CountryDetailReference
        {...buildUniversities({
          universities: [listed('Listed University', 'listed-university')],
          topRankedUniversities: [ranked('Ranked University', 'ranked-university', 12)],
        })}
      />,
    );

    expect(html).toContain('Top ranked universities');
    expect(html).toContain('Ranked University');
    expect(profileLinkCount(html, 'ranked-university')).toBe(1);
    expect(profileLinkCount(html, 'listed-university')).toBe(1);
  });

  it('renders the popular block only for a university not shown further up', () => {
    const html = renderToStaticMarkup(
      <CountryDetailReference
        {...buildUniversities({
          universities: [listed('Listed University', 'listed-university')],
          topRankedUniversities: [ranked('Ranked University', 'ranked-university', 12)],
          popularUniversities: [
            ranked('Listed University', 'listed-university', null),
            ranked('Ranked University', 'ranked-university', 12),
            ranked('Popular University', 'popular-university', null),
          ],
        })}
      />,
    );

    expect(html).toContain('Popular universities');
    expect(html).toContain('Popular University');
    for (const slug of ['listed-university', 'ranked-university', 'popular-university'])
      expect(profileLinkCount(html, slug)).toBe(1);
  });

  it('hides both headings when every highlight duplicates the listing', () => {
    const html = renderToStaticMarkup(
      <CountryDetailReference
        {...buildUniversities({
          universities: [listed('Listed University', 'listed-university')],
          topRankedUniversities: [ranked('Listed University', 'listed-university', 12)],
          popularUniversities: [ranked('Listed University', 'listed-university', 12)],
        })}
      />,
    );

    expect(html).not.toContain('Top ranked universities');
    expect(html).not.toContain('Popular universities');
    expect(profileLinkCount(html, 'listed-university')).toBe(1);
  });

  it('leaves no university card duplicated across the whole section', () => {
    const html = renderToStaticMarkup(
      <CountryDetailReference
        {...buildUniversities({
          universities: [listed('Alpha University', 'alpha'), listed('Beta University', 'beta')],
          topRankedUniversities: [
            ranked('Alpha University', 'alpha', 5),
            ranked('Gamma University', 'gamma', 9),
          ],
          popularUniversities: [
            ranked('Beta University', 'beta', null),
            ranked('Gamma University', 'gamma', 9),
            ranked('Delta University', 'delta', null),
          ],
        })}
      />,
    );

    for (const slug of ['alpha', 'beta', 'gamma', 'delta'])
      expect(profileLinkCount(html, slug)).toBe(1);
    /* Alpha's ranking survives on its listing card even though its ranked
     * duplicate was dropped. */
    expect(html).toContain('#5');
  });
});
