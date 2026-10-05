import { describe, expect, it } from 'vitest';
import { mergeLevels, sortByLevelOrder } from './level-order';

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

  it('merge across subjects once each, in climbing order', () => {
    /* The first subject has no Foundation; the second does. First-seen
       order put Foundation last. */
    const merged = mergeLevels(
      [
        [level('DIPLOMA'), level('UG'), level('PHD')],
        [level('FOUNDATION'), level('UG'), level('PG')],
        null,
      ],
      ORDER,
    );
    expect(merged.map((row) => row.code)).toEqual(['FOUNDATION', 'DIPLOMA', 'UG', 'PG', 'PHD']);
  });

  it('merge by another key where the level is known by id', () => {
    const merged = mergeLevels(
      [[{ id: 'a', code: 'PHD' }], [{ id: 'b', code: 'UG' }, { id: 'a', code: 'PHD' }]],
      ORDER,
      (row) => row.id,
    );
    expect(merged.map((row) => row.id)).toEqual(['b', 'a']);
  });
});
