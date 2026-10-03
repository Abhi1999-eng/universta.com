import { taughtFirst } from './countries.service';

/**
 * Every destination lists every subject, so the first few of an
 * undifferentiated list are an accident. The guide's study paths take six
 * and a field page's "more subjects" takes eight; they should be handed the
 * ones with programmes behind them before the ones without.
 */
const row = (name: string, source: string) => ({ name, source });

describe('the order a destination hands its subjects out in', () => {
  it('puts the ones a course stands behind first', () => {
    const rows = [
      row('Agriculture', 'EDITORIAL'),
      row('Engineering', 'DERIVED'),
      row('Law', 'EDITORIAL'),
      row('Medicine', 'DERIVED'),
    ];
    expect(taughtFirst(rows).map((entry) => entry.name)).toEqual([
      'Engineering',
      'Medicine',
      'Agriculture',
      'Law',
    ]);
  });

  it('keeps each group in the order it arrived in', () => {
    /* The query has already put them in the catalogue's order; this only
       decides which group leads. */
    const rows = [
      row('Zoology', 'DERIVED'),
      row('Art', 'DERIVED'),
      row('Music', 'EDITORIAL'),
      row('Dance', 'EDITORIAL'),
    ];
    expect(taughtFirst(rows).map((entry) => entry.name)).toEqual([
      'Zoology',
      'Art',
      'Music',
      'Dance',
    ]);
  });

  it('changes nothing when no subject is taught yet', () => {
    const rows = [row('Art', 'EDITORIAL'), row('Law', 'EDITORIAL')];
    expect(taughtFirst(rows)).toEqual(rows);
  });
});
