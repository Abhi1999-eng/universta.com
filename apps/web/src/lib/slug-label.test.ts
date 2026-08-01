import { describe, expect, it } from 'vitest';
import { labelFromSlug } from './slug-label';

/** These pin the exact strings that reached production: the country city
 * listing titled itself "Cities in canada", and the counselling form's
 * context chip read "Course · diploma cybersecurity · canada". */

describe('labelFromSlug', () => {
  it('title-cases a single-word slug', () => {
    expect(labelFromSlug('canada')).toBe('Canada');
  });

  it('title-cases every word of a multi-word slug', () => {
    expect(labelFromSlug('united-kingdom')).toBe('United Kingdom');
    expect(labelFromSlug('diploma-cybersecurity')).toBe('Diploma Cybersecurity');
  });

  it('ignores empty segments from leading, trailing or doubled hyphens', () => {
    expect(labelFromSlug('-canada-')).toBe('Canada');
    expect(labelFromSlug('new--zealand')).toBe('New Zealand');
  });

  it('returns an empty string for an empty slug rather than throwing', () => {
    expect(labelFromSlug('')).toBe('');
    expect(labelFromSlug('-')).toBe('');
  });

  it('leaves interior casing alone so it cannot mangle an already-cased word', () => {
    // Only the first character is forced upper; "mBA" stays "MBA"-ish rather
    // than being lowercased into something wrong.
    expect(labelFromSlug('mba-finance')).toBe('Mba Finance');
    expect(labelFromSlug('PhD-studies')).toBe('PhD Studies');
  });
});
