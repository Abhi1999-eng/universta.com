import { WEBSITE_PAGES } from './website-pages.service';

/** Website Pages is the only screen that promises "every managed public page
 * is here". These guard that promise against future edits. */
describe('WEBSITE_PAGES registry', () => {
  it('has unique keys', () => {
    const keys = WEBSITE_PAGES.map((entry) => entry.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('gives every entry a site-relative public path', () => {
    for (const entry of WEBSITE_PAGES) {
      expect(entry.publicPath.startsWith('/')).toBe(true);
    }
  });

  it('covers every required Phase 1 page type', () => {
    const required = [
      'home',
      'about',
      'contact',
      'counselling',
      'faq',
      'countries-listing',
      'country-detail',
      'cities-listing',
      'city-detail',
      'universities-listing',
      'university-detail',
      'university-courses',
      'university-course-offering',
      'subjects-listing',
      'subject-detail',
      'specializations-listing',
      'courses-listing',
      'course-detail',
      'scholarships-listing',
      'scholarship-detail',
      'consultants-listing',
      'consultant-detail',
      'consultant-location',
      'compare-countries',
      'compare-universities',
      'compare-courses',
      'compare-consultants',
      'success-stories',
      'testimonials',
      'careers',
      'job-detail',
      'events-listing',
      'event-detail',
    ];
    const keys = new Set(WEBSITE_PAGES.map((entry) => entry.key));
    expect(required.filter((key) => !keys.has(key))).toEqual([]);
  });

  it('declares either a page slug, a template key, or an SEO key for each entry', () => {
    // An entry with none of the three would render in the selector with no
    // way to manage it, which is exactly the "hidden behind an unclear label"
    // problem the screen exists to remove.
    const unmanageable = WEBSITE_PAGES.filter(
      (entry) => !entry.pageSlug && !entry.templateKey && !entry.seoKey,
    ).map((entry) => entry.key);
    expect(unmanageable).toEqual([]);
  });
});
