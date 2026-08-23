import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CountryStructuredSections } from './CountryStructuredSections';

describe('CountryStructuredSections', () => {
  it('shows country configuration as chips and never invents a zero tuition value', () => {
    const html = renderToStaticMarkup(
      <CountryStructuredSections
        country={{
          id: 'country-1', name: 'Canada', slug: 'canada', pageHeading: 'Study in Canada',
          shortDescription: '', continent: { id: 'continent-1', name: 'North America', slug: 'north-america' },
          flag: null, featured: false, displayOrder: 0, statistics: null,
          configuration: { features: [{ code: 'PART_TIME_ALLOWED', label: 'Part-time allowed' }], acceptedTests: ['IELTS'], intakeMonths: [1, 9], postStudyWorkPermitMonths: 24 },
          derived: { averageTuition: null, statistics: { universitiesCount: 1, publicUniversitiesCount: 1, coursesCount: 2 }, topRankedUniversities: [], popularUniversities: [], popularCourses: [] },
        }}
      />,
    );
    expect(html).toContain('Part-time allowed');
    expect(html).toContain('rounded-full');
    expect(html).toContain('January, September');
    expect(html).toContain('Up to 24 months');
    expect(html).not.toContain('Average Tuition');
    expect(html).not.toContain('>0<');
  });
});
