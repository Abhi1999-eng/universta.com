import { describe, expect, it } from 'vitest';
import { ownsItsChrome } from './own-chrome';

/**
 * Which routes wear the Study Abroad design's own header and footer. The
 * root layout asks on the server and the site header and footer ask again
 * on the client, so both have to get the same answer from one place.
 */
describe('which routes wear their own header and footer', () => {
  it('owns the homepage and the whole Study Abroad family', () => {
    for (const path of [
      '/',
      '/study-abroad',
      '/study-abroad/united-kingdom/computer-science',
      '/subjects/computer-science',
      '/specializations',
      '/courses',
      '/courses/msc-computer-science',
      '/scholarships',
      '/scholarships/chevening',
    ])
      expect(ownsItsChrome(path), path).toBe(true);
  });

  it('owns course and university comparisons, the directory, a university guide and its claim, and no deeper', () => {
    expect(ownsItsChrome('/compare/courses')).toBe(true);
    expect(ownsItsChrome('/universities')).toBe(true);
    expect(ownsItsChrome('/search')).toBe(true);
    expect(ownsItsChrome('/search/other')).toBe(false);
    expect(ownsItsChrome('/universities/university-of-warwick')).toBe(true);
    expect(ownsItsChrome('/universities/university-of-warwick/claim')).toBe(true);
    expect(ownsItsChrome('/universities/university-of-warwick/courses')).toBe(false);
    expect(ownsItsChrome('/compare/universities')).toBe(true);
    expect(ownsItsChrome('/compare/universities/other')).toBe(false);
    expect(ownsItsChrome('/compare/countries')).toBe(true);
    expect(ownsItsChrome('/compare/consultants')).toBe(true);
    expect(ownsItsChrome('/compare/other')).toBe(false);
  });

  it('owns the contact page, the content directories and their records', () => {
    for (const path of ['/contact', '/careers', '/events', '/success-stories', '/testimonials', '/study-abroad-consultants', '/counselling', '/about', '/faq'])
      expect(ownsItsChrome(path), path).toBe(true);
    for (const path of ['/careers/student-advisor', '/events/open-day', '/success-stories/from-delhi-to-melbourne'])
      expect(ownsItsChrome(path), path).toBe(true);
    for (const path of ['/careers/student-advisor/apply', '/faq/other', '/aboutus'])
      expect(ownsItsChrome(path), path).toBe(false);
  });

  it('owns a consultant profile and a consultant location', () => {
    expect(ownsItsChrome('/study-abroad-consultants/leap-scholar')).toBe(true);
    expect(ownsItsChrome('/study-abroad-consultants/locations/demo-harbour')).toBe(true);
    expect(ownsItsChrome('/study-abroad-consultants/leap-scholar/other')).toBe(false);
  });

  it('owns the city index, and not a city page under a country', () => {
    expect(ownsItsChrome('/cities')).toBe(true);
    expect(ownsItsChrome('/cities/london')).toBe(false);
    expect(ownsItsChrome('/study-in-uk/london')).toBe(false);
  });

  it('leaves every other route, and a path it cannot read, to the site chrome', () => {
    for (const path of ['/student/saved', '/coursesx', '/subjectsfoo', '/scholarshipsx', undefined, null, ''])
      expect(ownsItsChrome(path), String(path)).toBe(false);
  });
});
