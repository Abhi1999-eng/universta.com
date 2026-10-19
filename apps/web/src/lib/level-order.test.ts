import { describe, expect, it } from 'vitest';
import { sortByLevelOrder } from './level-order';

/** The order the public course-levels list gives. */
const ORDER = ['FOUNDATION', 'PATHWAY', 'DIPLOMA', 'UG', 'PGDM', 'PG', 'MBA', 'PHD', 'CERTIFICATE'];

const level = (code: string, name = code) => ({ code, name });

describe('study levels', () => {
  it('come in the order a student climbs them', () => {
    const sorted = sortByLevelOrder(
      [level('PHD'), level('DIPLOMA'), level('UG'), level('PG')],
      ORDER,
    );
    expect(sorted.map((row) => row.code)).toEqual(['DIPLOMA', 'UG', 'PG', 'PHD']);
  });

  it('keep one the key does not know, after the known ones', () => {
    const sorted = sortByLevelOrder([level('NEW'), level('PHD'), level('UG')], ORDER);
    expect(sorted.map((row) => row.code)).toEqual(['UG', 'PHD', 'NEW']);
  });

  it('are left as they came when there is no key', () => {
    const sorted = sortByLevelOrder([level('PHD'), level('UG')], []);
    expect(sorted.map((row) => row.code)).toEqual(['PHD', 'UG']);
  });
});
