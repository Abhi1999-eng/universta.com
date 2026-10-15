import { describe, expect, it } from 'vitest';
import { ownsItsChrome } from './own-chrome';

/**
 * Which routes wear the Study Abroad design's own header and footer. The
 * root layout asks on the server and the site header and footer ask again
 * on the client, so both have to get the same answer from one place.
 */
describe('which routes wear their own header and footer', () => {
  it('owns the whole public site: every family the design reached, and any address nothing answers', () => {
    for (const path of [
      '/',
      '/study-abroad',
      '/study-abroad/united-kingdom/computer-science',
      '/subjects/computer-science',
      '/specializations',
      '/courses/msc-computer-science',
      '/universities',
      '/universities/university-of-warwick',
      '/universities/university-of-warwick/claim',
      '/compare/courses',
      '/compare/universities',
      '/compare/countries',
      '/compare/consultants',
      '/search',
      '/cities',
      '/study-in-uk/cities',
      '/study-in-uk/london',
      '/contact',
      '/counselling',
      '/about',
      '/faq',
      '/scholarships',
      '/scholarships/chevening',
      '/careers',
      '/careers/student-advisor',
      '/events/open-day',
      '/success-stories/from-delhi-to-melbourne',
      '/testimonials',
      '/study-abroad-consultants',
      '/study-abroad-consultants/leap-scholar',
      '/study-abroad-consultants/locations/demo-harbour',
      '/no-such-page',
    ])
      expect(ownsItsChrome(path), path).toBe(true);
  });

  it('leaves the student portal, the preview and the referral link to the site chrome', () => {
    for (const path of ['/student', '/student/login', '/student/saved', '/preview', '/r/abc123'])
      expect(ownsItsChrome(path), path).toBe(false);
    /* A prefix is a family, not a spelling. */
    expect(ownsItsChrome('/students-abroad')).toBe(true);
    expect(ownsItsChrome('/rankings')).toBe(true);
  });

  it('leaves a path it cannot read to the site chrome', () => {
    for (const path of [undefined, null, '']) expect(ownsItsChrome(path), String(path)).toBe(false);
  });
});
