import { WEBSITE_PAGES } from './website-pages.service';

/** The registry is the contract behind the Website Builder selector: if an
 * approved Phase 1 page is missing from it, that page is unmanageable no matter
 * what the rest of the system does. These pin the list itself. */

/** Every page and template the client approved for Phase 1, by label. */
const REQUIRED = [
  // Static / editorial
  'Home',
  'About Us',
  'Contact Us',
  'Book Free Counselling',
  'Success Stories',
  'Testimonials',
  'FAQ',
  // Destinations
  'Countries Listing',
  'Country Detail Template',
  'Cities Listing',
  'City Detail Template',
  // Universities
  'Universities Listing',
  'University Detail Template',
  'University Courses Template',
  'Single University Course Offering Template',
  // Academics
  'Subjects Listing',
  'Subject Detail Template',
  'Specializations Listing',
  'Generic Courses Listing',
  'Generic Course Detail Template',
  // Scholarships
  'Scholarships Listing',
  'Scholarship Detail Template',
  // Consultants
  'Consultants Listing',
  'Consultant Detail Template',
  'Consultant Location Template',
  // Comparison
  'Country Comparison',
  'University Comparison',
  'Course Comparison',
  'Consultant Comparison',
  // Careers and Events
  'Careers Listing',
  'Job Detail Template',
  'Events Listing',
  'Event Detail Template',
];

describe('Website Builder registration', () => {
  it('registers every approved Phase 1 page and template', () => {
    const labels = WEBSITE_PAGES.map((entry) => entry.label);
    const missing = REQUIRED.filter((label) => !labels.includes(label));
    expect(missing).toEqual([]);
    expect(WEBSITE_PAGES).toHaveLength(REQUIRED.length);
  });

  it('has no duplicate route keys', () => {
    const keys = WEBSITE_PAGES.map((entry) => entry.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('has no duplicate public routes', () => {
    // Two entries claiming the same URL would mean either a duplicated route or
    // a registry entry that cannot be told apart in the selector.
    const paths = WEBSITE_PAGES.map((entry) => entry.publicPath);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('has no duplicate backing page slugs or template keys', () => {
    const slugs = WEBSITE_PAGES.map((entry) => entry.pageSlug).filter(Boolean);
    expect(new Set(slugs).size).toBe(slugs.length);
    const templateKeys = WEBSITE_PAGES.map((entry) => entry.templateKey).filter(
      Boolean,
    );
    expect(new Set(templateKeys).size).toBe(templateKeys.length);
  });

  it('gives every entry exactly one backing record type', () => {
    // A page is either Page-managed or Template-managed, never both: two
    // backing records would make "which one am I editing?" ambiguous.
    for (const entry of WEBSITE_PAGES) {
      const backings = [entry.pageSlug, entry.templateKey].filter(Boolean);
      expect({ key: entry.key, backings: backings.length }).toEqual({
        key: entry.key,
        backings: 1,
      });
    }
  });

  it('assigns a management type consistent with the backing record', () => {
    for (const entry of WEBSITE_PAGES) {
      if (entry.managementType === 'DETAIL_TEMPLATE') {
        expect({
          key: entry.key,
          hasTemplate: Boolean(entry.templateKey),
        }).toEqual({
          key: entry.key,
          hasTemplate: true,
        });
      } else {
        expect({ key: entry.key, hasPage: Boolean(entry.pageSlug) }).toEqual({
          key: entry.key,
          hasPage: true,
        });
      }
    }
  });

  it('keeps every public route rooted and free of query strings', () => {
    for (const entry of WEBSITE_PAGES) {
      expect(entry.publicPath.startsWith('/')).toBe(true);
      expect(entry.publicPath).not.toContain('?');
    }
  });

  it('covers each approved family', () => {
    const families = new Set(WEBSITE_PAGES.map((entry) => entry.family));
    for (const family of [
      'Core',
      'Destinations',
      'Universities',
      'Academics',
      'Scholarships',
      'Consultants',
      'Comparison',
      'Content',
    ]) {
      expect([...families]).toContain(family);
    }
  });
});
