import { describe, expect, it } from '@jest/globals';
import { paginationMeta, slugify } from './catalog.constants';

describe('catalog policy helpers', () => {
  it('normalizes stable hyphenated slugs without inventing content', () => {
    expect(slugify('  Australia & New Zealand  ')).toBe(
      'australia-new-zealand',
    );
    expect(slugify('São Tomé')).toBe('sao-tome');
  });

  it('calculates bounded collection metadata deterministically', () => {
    expect(paginationMeta(2, 12, 25)).toEqual({
      page: 2,
      limit: 12,
      total: 25,
      totalPages: 3,
    });
    expect(paginationMeta(1, 12, 0).totalPages).toBe(0);
  });
});
