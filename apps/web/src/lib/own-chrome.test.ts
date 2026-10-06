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
    ])
      expect(ownsItsChrome(path), path).toBe(true);
  });

  it('owns the course comparison, the directory and a university guide, and no deeper', () => {
    expect(ownsItsChrome('/compare/courses')).toBe(true);
    expect(ownsItsChrome('/universities')).toBe(true);
    expect(ownsItsChrome('/universities/university-of-warwick')).toBe(true);
    expect(ownsItsChrome('/universities/university-of-warwick/claim')).toBe(false);
    expect(ownsItsChrome('/compare/universities')).toBe(false);
  });

  it('leaves every other route, and a path it cannot read, to the site chrome', () => {
    for (const path of ['/scholarships', '/student/saved', '/coursesx', '/subjectsfoo', undefined, null, ''])
      expect(ownsItsChrome(path), String(path)).toBe(false);
  });
});
