import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { UniversityCard, type UniversityCardData } from './UniversityCard';

/**
 * One card for every list of universities. It prints what the record holds
 * and nothing it does not: the places that use it know different amounts.
 */
const oxford = (over: Partial<UniversityCardData> = {}): UniversityCardData => ({
  id: 'u1',
  name: 'University of Oxford',
  slug: 'university-of-oxford',
  institutionType: 'Public',
  programmes: 4,
  campuses: 1,
  city: 'Oxford',
  country: { name: 'United Kingdom', slug: 'united-kingdom', iso2Code: 'GB' },
  subjects: [
    { slug: 'law', name: 'Law' },
    { slug: 'history', name: 'History' },
    { slug: 'medicine', name: 'Medicine' },
    { slug: 'classics', name: 'Classics' },
  ],
  ...over,
});

const render = (data: UniversityCardData, guide = false) =>
  renderToStaticMarkup(<UniversityCard university={data} guide={guide} />);

describe('a university card', () => {
  it('says where it is: city and country, as the reference card does', () => {
    expect(render(oxford())).toContain('<span>Oxford, United Kingdom</span>');
  });

  it('says only the country when no campus city is recorded', () => {
    expect(render(oxford({ city: null }))).toContain('<span>United Kingdom</span>');
  });

  it('links the name and the button to the university’s own page', () => {
    const html = render(oxford());
    expect(html.match(/href="\/universities\/university-of-oxford"/g)).toHaveLength(2);
  });

  it('names at most three subjects, for what the catalogue can say of them', () => {
    const html = render(oxford());
    expect(html).toContain('Most programmes in');
    expect(html).toContain('>Law<');
    expect(html).toContain('>Medicine<');
    expect(html).not.toContain('Classics');
  });

  it('leaves the subject row out when none is known', () => {
    expect(render(oxford({ subjects: [] }))).not.toContain('Most programmes in');
  });

  it('counts campuses only when one is on record', () => {
    expect(render(oxford())).toContain('<dt>Campuses</dt><dd>1</dd>');
    expect(render(oxford({ campuses: 0 }))).not.toContain('Campuses');
  });

  it('shows student figures where the record has them', () => {
    const html = render(oxford({ totalStudents: 26000, internationalStudentsPercent: 43 }));
    expect(html).toContain('<dt>Students</dt><dd>26,000</dd>');
    expect(html).toContain('<dt>International</dt><dd>43%</dd>');
    expect(render(oxford())).not.toContain('Students');
  });

  it('has no figures block at all when it was handed none', () => {
    expect(
      render({ id: 'u1', name: 'University of Oxford', slug: 'university-of-oxford' }),
    ).not.toContain('unicard__stats');
  });

  it('offers to compare it', () => {
    const html = render(oxford());
    expect(html).toContain('href="/compare/universities?items=university-of-oxford"');
    expect(html).toContain('aria-label="Compare University of Oxford"');
  });

  it('adds the country guide only where it is asked for', () => {
    expect(render(oxford())).not.toContain('United Kingdom guide');
    const html = render(oxford(), true);
    expect(html).toContain('href="/study-abroad/united-kingdom"');
    expect(html).toContain('United Kingdom guide');
  });

  it('carries a mark of its own', () => {
    expect(render(oxford())).toContain('<span class="unimark" aria-hidden="true">OXF</span>');
  });
});
