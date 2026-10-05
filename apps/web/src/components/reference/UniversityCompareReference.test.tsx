import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { UniversityCompareReference, type CompareUniversity } from './UniversityCompareReference';

/**
 * The comparison's link to a university's courses. The courses moved under
 * the country in their address, and this link kept the old flat one, which
 * now only answers with a redirect.
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {} }),
  usePathname: () => '/compare/universities',
}));

const oxford = (over: Partial<CompareUniversity> = {}): CompareUniversity => ({
  name: 'University of Oxford',
  slug: 'university-of-oxford',
  country: 'United Kingdom',
  countrySlug: 'united-kingdom',
  institutionType: 'PUBLIC',
  shortDescription: null,
  campuses: 1,
  offerings: 12,
  accreditations: [],
  verifiedAt: null,
  ...over,
});

const render = (item: CompareUniversity) =>
  renderToStaticMarkup(
    <UniversityCompareReference
      items={[item]}
      invalid={[]}
      options={[{ slug: item.slug, name: item.name }]}
      selected={[item.slug]}
    />,
  );

describe('the comparison’s link to a university’s courses', () => {
  it('goes to the courses under their country, not through the old redirect', () => {
    const html = render(oxford());
    expect(html).toContain(
      'href="/study-abroad/united-kingdom/universities/university-of-oxford/courses"',
    );
    expect(html).not.toContain('href="/universities/university-of-oxford/courses"');
  });

  it('falls back to the flat address, which still redirects, when the country is not known', () => {
    expect(render(oxford({ countrySlug: null }))).toContain(
      'href="/universities/university-of-oxford/courses"',
    );
  });

  it('keeps the profile link flat, where the profile lives', () => {
    expect(render(oxford())).toContain('href="/universities/university-of-oxford"');
  });
});
