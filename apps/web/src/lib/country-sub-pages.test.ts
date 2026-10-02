import { describe, expect, it } from 'vitest';
import { partitionSubjects, rankedFirst } from './country-sub-pages';

describe('ordering a destination’s universities', () => {
  const uni = (name: string, qsRanking?: number | null) => ({ name, qsRanking });

  it('puts the better rank first', () => {
    expect(
      rankedFirst([uni('Second', 40), uni('First', 12)]).map((u) => u.name),
    ).toEqual(['First', 'Second']);
  });

  it('treats an unranked university as unmeasured, not as last place', () => {
    /* It still follows the ranked ones -- but among themselves the
       unranked are alphabetical, not pushed to an invented position. */
    const rows = rankedFirst([
      uni('Zeta', null),
      uni('Ranked', 50),
      uni('Alpha', null),
    ]);
    expect(rows.map((u) => u.name)).toEqual(['Ranked', 'Alpha', 'Zeta']);
  });

  it('falls back to the name when nothing is ranked', () => {
    expect(
      rankedFirst([uni('Charlie'), uni('Alpha'), uni('Bravo')]).map((u) => u.name),
    ).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  it('leaves the caller’s array alone', () => {
    const input = [uni('Second', 40), uni('First', 12)];
    rankedFirst(input);
    expect(input.map((u) => u.name)).toEqual(['Second', 'First']);
  });

  it('has nothing to say about an empty destination', () => {
    expect(rankedFirst([])).toEqual([]);
  });
});

describe('splitting a destination’s subjects by what put them there', () => {
  it('counts a derived subject as taught', () => {
    const { taught, editorial } = partitionSubjects([{ source: 'DERIVED' }]);
    expect(taught).toHaveLength(1);
    expect(editorial).toHaveLength(0);
  });

  it('counts an editorial subject separately, since it may be empty', () => {
    const { taught, editorial } = partitionSubjects([{ source: 'EDITORIAL' }]);
    expect(taught).toHaveLength(0);
    expect(editorial).toHaveLength(1);
  });

  it('treats a subject with no source as taught rather than hiding it', () => {
    /* Older rows predate the column. Demoting them would quietly empty
       the main grid on every destination that has not been swept. */
    expect(partitionSubjects([{}, { source: null }]).taught).toHaveLength(2);
  });

  it('keeps both kinds when a destination has both', () => {
    const { taught, editorial } = partitionSubjects([
      { source: 'DERIVED' },
      { source: 'EDITORIAL' },
      { source: 'DERIVED' },
    ]);
    expect(taught).toHaveLength(2);
    expect(editorial).toHaveLength(1);
  });
});
