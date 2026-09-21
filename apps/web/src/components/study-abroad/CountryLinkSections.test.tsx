import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Country, ProfileSummary } from '@/lib/countries';
import {
  CountryCourses,
  CountryNumbers,
  CountryScholarships,
  CountrySubjects,
  CountryTestimonials,
  CountryUniversities,
} from './CountryLinkSections';

const country = (over: Record<string, unknown> = {}) =>
  ({
    id: 'c1',
    name: 'Germany',
    slug: 'germany',
    subjects: [{ id: 's1', name: 'Engineering', slug: 'engineering' }],
    currency: { code: 'EUR', symbol: '€' },
    configuration: {
      features: [],
      acceptedTests: [],
      intakeMonths: [4, 10],
      postStudyWorkPermitMonths: 18,
      calculator: null,
    },
    derived: {
      averageTuition: null,
      statistics: { universitiesCount: 5, publicUniversitiesCount: 5, coursesCount: 10 },
      topRankedUniversities: [],
      popularUniversities: [
        {
          id: 'u1',
          name: 'Technical University of Munich',
          slug: 'tum',
          institutionType: 'Public',
          qsRanking: 28,
        },
      ],
      popularCourses: [],
    },
    ...over,
  }) as unknown as Country;

const profiles = (over: Record<string, unknown> = {}) =>
  ({ cost: { tuitionMin: '0', ...over } }) as unknown as ProfileSummary;

describe('country guide catalogue sections', () => {
  it('lists the universities published for the country', () => {
    const html = renderToStaticMarkup(<CountryUniversities country={country()} alt />);
    expect(html).toContain('Explore universities in Germany');
    expect(html).toContain('href="/universities/tum"');
    expect(html).toContain('QS #28');
    expect(html).toContain('5 universities and 10 programmes');
  });

  /* A guide with nothing published stands the section down rather than
     showing an empty shelf -- the rule the snapshot panel already follows. */
  it('stands down when the country has no universities', () => {
    const html = renderToStaticMarkup(
      <CountryUniversities
        alt
        country={country({
          derived: {
            averageTuition: null,
            statistics: { universitiesCount: 0, publicUniversitiesCount: 0, coursesCount: 0 },
            topRankedUniversities: [],
            popularUniversities: [],
            popularCourses: [],
          },
        })}
      />,
    );
    expect(html).toBe('');
  });

  it('does not list the same university twice when it is both ranked and popular', () => {
    const ranked = {
      id: 'u1',
      name: 'Technical University of Munich',
      slug: 'tum',
      institutionType: 'Public',
      qsRanking: 28,
    };
    const html = renderToStaticMarkup(
      <CountryUniversities
        alt
        country={country({
          derived: {
            averageTuition: null,
            statistics: { universitiesCount: 1, publicUniversitiesCount: 1, coursesCount: 1 },
            topRankedUniversities: [ranked],
            popularUniversities: [ranked],
            popularCourses: [],
          },
        })}
      />,
    );
    expect(html.match(/href="\/universities\/tum"/g) ?? []).toHaveLength(1);
  });

  it('links each subject taught in the country', () => {
    const html = renderToStaticMarkup(<CountrySubjects country={country()} alt />);
    expect(html).toContain('href="/subjects/engineering"');
    expect(html).toContain('Popular subjects to study in Germany');
  });

  it('stands down when no subject is mapped to the country', () => {
    expect(
      renderToStaticMarkup(<CountrySubjects country={country({ subjects: [] })} alt />),
    ).toBe('');
  });

  it('lists the courses read for the country', () => {
    const html = renderToStaticMarkup(
      <CountryCourses
        alt
        country={country()}
        courses={[
          {
            id: 'x1',
            name: 'MSc Robotics',
            slug: 'msc-robotics',
            courseLevel: { name: 'Postgraduate' },
            subject: { name: 'Engineering' },
          },
        ]}
      />,
    );
    expect(html).toContain('href="/courses/msc-robotics"');
    expect(html).toContain('Postgraduate');
  });

  it('stands down when no course is published for the country', () => {
    expect(
      renderToStaticMarkup(<CountryCourses country={country()} courses={[]} alt />),
    ).toBe('');
  });

  it('lists the funding open in the country', () => {
    const html = renderToStaticMarkup(
      <CountryScholarships
        alt
        country={country()}
        scholarships={[
          {
            id: 'sch1',
            title: 'DAAD Scholarships',
            slug: 'daad',
            summary: 'Germany’s national academic exchange service.',
            provider: { name: 'DAAD' },
          },
        ]}
      />,
    );
    expect(html).toContain('href="/scholarships/daad"');
    expect(html).toContain('Scholarships for Germany');
  });

  it('quotes the testimonials filed against the country', () => {
    const html = renderToStaticMarkup(
      <CountryTestimonials
        alt
        country={country()}
        testimonials={[
          {
            id: 't1',
            quote: 'Seeing tuition and language rules side by side made the shortlist obvious.',
            attribution: 'Aarti Nair',
            attributionNote: 'Master’s applicant',
          },
        ]}
      />,
    );
    expect(html).toContain('What students say about studying in Germany');
    expect(html).toContain('Aarti Nair');
    /* Initials come from the attribution rather than being stored twice. */
    expect(html).toContain('>AN<');
    expect(html).toContain('Master’s applicant');
  });

  /* Nothing is borrowed from a university to fill a country guide, and no
     placeholder quote is invented, so the section simply is not there. */
  it('stands down when no testimonial is filed against the country', () => {
    expect(
      renderToStaticMarkup(<CountryTestimonials country={country()} testimonials={[]} alt />),
    ).toBe('');
  });

  /* Only figures the catalogue actually holds. A zero is an absence the
     student cannot act on, so it never reaches the grid. */
  it('reports only the figures the catalogue holds', () => {
    const html = renderToStaticMarkup(
      <CountryNumbers country={country()} profiles={profiles()} alt />,
    );
    expect(html).toContain('Universities profiled');
    expect(html).toContain('Programmes listed');
    expect(html).toContain('2</div><div class="bignum__l">Intakes per year');
    expect(html).toContain('18</div><div class="bignum__l">Months of post-study work');
  });

  it('stands down when there is barely anything to report', () => {
    const html = renderToStaticMarkup(
      <CountryNumbers
        alt
        country={country({
          derived: {
            averageTuition: null,
            statistics: { universitiesCount: 0, publicUniversitiesCount: 0, coursesCount: 0 },
            topRankedUniversities: [],
            popularUniversities: [],
            popularCourses: [],
          },
          configuration: {
            features: [],
            acceptedTests: [],
            intakeMonths: [],
            postStudyWorkPermitMonths: null,
            calculator: null,
          },
        })}
        profiles={{ cost: {} } as unknown as ProfileSummary}
      />,
    );
    expect(html).toBe('');
  });
});
