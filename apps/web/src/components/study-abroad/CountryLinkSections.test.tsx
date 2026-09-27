import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Country, ProfileSummary } from '@/lib/countries';
import { CountryConsultants } from './CountryConsultants';
import {
  CountryCourses,
  countryCourses,
  countryFigures,
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

  /* The fee is the figure a student compares courses on, and it is published
     against the destination, so the country's own card can quote it. */
  it('quotes the course fee for this destination', () => {
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
            selectedTuition: {
              min: '18000',
              max: null,
              currencyCode: 'EUR',
              period: 'YEAR',
            },
          },
        ]}
      />,
    );
    expect(html).toContain('Postgraduate · From €18,000 a year');
  });

  /* What an editor marked popular for the destination leads the section; the
     catalogue's own order fills in behind it. */
  it('puts the editor-curated courses first, in their order', () => {
    const curated = country({
      derived: {
        averageTuition: null,
        statistics: { universitiesCount: 5, publicUniversitiesCount: 5, coursesCount: 10 },
        topRankedUniversities: [],
        popularUniversities: [],
        popularCourses: [
          { id: 'x2', name: 'MSc Data Science', slug: 'msc-data', shortDescription: null },
          { id: 'x9', name: 'MA Design', slug: 'ma-design', shortDescription: null },
        ],
      },
    });
    const published = [
      { id: 'x1', name: 'MSc Robotics', slug: 'msc-robotics', courseLevel: null, subject: null },
      { id: 'x2', name: 'MSc Data Science', slug: 'msc-data', courseLevel: null, subject: null },
    ];
    expect(countryCourses(curated, published).map((course) => course.slug)).toEqual([
      'msc-data',
      'ma-design',
      'msc-robotics',
    ]);
  });

  it('leaves the catalogue order alone when nothing is curated', () => {
    const published = [
      { id: 'x1', name: 'MSc Robotics', slug: 'msc-robotics', courseLevel: null, subject: null },
      { id: 'x2', name: 'MSc Data Science', slug: 'msc-data', courseLevel: null, subject: null },
    ];
    expect(countryCourses(country(), published)).toBe(published);
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
    expect(html).toContain('Scholarships to study in Germany');
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

  /* Nothing derives this one -- it is on the band only because an editor
     recorded it, whatever the statistics source setting says. */
  it('shows the international students an editor recorded', () => {
    const html = renderToStaticMarkup(
      <CountryNumbers
        alt
        country={country({
          statistics: { universitiesCount: null, internationalStudentsCount: 416000 },
        })}
        profiles={profiles()}
      />,
    );
    expect(html).toContain('416,000</div><div class="bignum__l">International students');
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

describe('what a figure means', () => {
  /* The band states a country's numbers and leaves a reader to work out what
     to do with them. Each meaning is derived from the same published data as
     the figure, so it cannot drift out of date separately from the number. */
  const costed = () => profiles({ tuitionMin: '1500', tuitionMax: '12000' });

  it('reads the intake months out of the figure that counted them', () => {
    const figures = countryFigures(country(), costed());
    const intakes = figures.find((figure) => figure.label === 'Intakes per year');
    expect(intakes?.value).toBe('2');
    expect(intakes?.meaning).toContain('April and October');
  });

  it('names the top of the range beside the bottom of it', () => {
    const figures = countryFigures(country(), costed());
    const tuition = figures.find((figure) => figure.label === 'Tuition from, per year');
    expect(tuition?.meaning).toContain('€12,000');
  });

  /* Without a maximum there is no range to name, and inventing one would be
     worse than saying less. */
  it('says only what it has when there is no top of the range', () => {
    const figures = countryFigures(country(), profiles({ tuitionMin: '1500' }));
    const tuition = figures.find((figure) => figure.label === 'Tuition from, per year');
    expect(tuition?.meaning).not.toContain('range runs to');
    expect(tuition?.meaning).toContain('Germany');
  });

  it('counts the public universities against the profiled ones', () => {
    const figures = countryFigures(country(), costed());
    const paid = figures.find((figure) => figure.label === 'Public universities');
    expect(paid?.meaning).toContain('Of the 5 profiled');
  });

  it('gives every figure on the band something to open', () => {
    const figures = countryFigures(country(), costed());
    expect(figures.filter((figure) => !figure.meaning.trim())).toEqual([]);
  });
});

describe('the consultants panel', () => {
  const presence = { total: 3, cities: [{ city: 'Delhi', count: 2 }, { city: 'Dubai', count: 1 }] };

  it('carries the destination into the directory it links to', () => {
    const html = renderToStaticMarkup(
      <CountryConsultants
        countryName="Germany"
        countrySlug="germany"
        presence={presence}
        alt={false}
      />,
    );
    expect(html).toContain('href="/study-abroad-consultants?country=germany"');
    expect(html).toContain(
      'href="/study-abroad-consultants?country=germany&amp;city=Delhi"',
    );
    expect(html).toContain('3 consultants on Universta');
  });

  it('counts one consultant as one, not as 1 consultants', () => {
    const html = renderToStaticMarkup(
      <CountryConsultants
        countryName="Germany"
        countrySlug="germany"
        presence={{ total: 1, cities: [] }}
        alt={false}
      />,
    );
    expect(html).toContain('One consultant on Universta');
  });

  /* A destination nobody advises has no panel: an empty "Near you" row and a
     link to a directory that will show nothing is worse than no offer. */
  it('stands down for a destination with no consultants', () => {
    for (const none of [undefined, { total: 0, cities: [] }])
      expect(
        renderToStaticMarkup(
          <CountryConsultants
            countryName="Germany"
            countrySlug="germany"
            presence={none}
            alt={false}
          />,
        ),
      ).toBe('');
  });
});
