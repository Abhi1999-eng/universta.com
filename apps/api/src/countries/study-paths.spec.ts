import { MAX_STUDY_PATHS, parseStudyPaths } from './study-paths';

/**
 * What a destination's study paths are allowed to be.
 *
 * The guide shows these rows and only these: there is no list behind them to
 * fall back on. So the reader is deliberately forgiving about one bad field
 * and unforgiving about a row with no name, which is a tab with nothing on it.
 */
describe('reading a destination’s study paths', () => {
  it('keeps the rows in the order they were given', () => {
    expect(
      parseStudyPaths([
        { name: 'PhD', duration: '3–5 years' },
        { name: "Bachelor's", duration: '3 years' },
      ]).map((row) => row.name),
    ).toEqual(['PhD', "Bachelor's"]);
  });

  it('gives a row every field, with nothing where nothing was typed', () => {
    expect(parseStudyPaths([{ name: 'MBA' }])).toEqual([
      { name: 'MBA', duration: null, entry: null, summary: null },
    ]);
  });

  it('trims what was typed', () => {
    expect(
      parseStudyPaths([
        {
          name: '  Master’s ',
          duration: ' 1 year ',
          entry: '',
          summary: '   ',
        },
      ]),
    ).toEqual([
      { name: 'Master’s', duration: '1 year', entry: null, summary: null },
    ]);
  });

  it('drops a row with no name, because the name is the tab', () => {
    expect(
      parseStudyPaths([
        { duration: '3 years' },
        { name: '   ' },
        { name: 'MBA' },
      ]),
    ).toEqual([{ name: 'MBA', duration: null, entry: null, summary: null }]);
  });

  it('leaves out a field of the wrong kind rather than the whole row', () => {
    expect(
      parseStudyPaths([
        { name: 'MBA', duration: 2, entry: ['degree'], summary: null },
      ]),
    ).toEqual([{ name: 'MBA', duration: null, entry: null, summary: null }]);
  });

  it('leaves out a field that is too long to be what it says it is', () => {
    const [row] = parseStudyPaths([{ name: 'MBA', duration: 'x'.repeat(81) }]);
    expect(row.duration).toBeNull();
  });

  it('measures a field the way the request was measured, so nothing accepted is dropped', () => {
    /* The request is checked with class-validator, which counts an emoji as
       one character; String.length counts it as two. Sixty characters ending
       in one is a name the DTO accepts, and it used to be dropped here --
       taking the level with it. */
    const name = `${'x'.repeat(59)}🎓`;
    expect(name.length).toBe(61);
    expect(parseStudyPaths([{ name }])).toEqual([
      { name, duration: null, entry: null, summary: null },
    ]);
    /* One more and it is over, by either count. */
    expect(parseStudyPaths([{ name: `${'x'.repeat(60)}🎓` }])).toEqual([]);
  });

  it('is nothing for anything that is not a list', () => {
    for (const value of [null, undefined, 'four', 4, {}, { name: 'MBA' }])
      expect(parseStudyPaths(value)).toEqual([]);
  });

  it('skips entries that are not rows at all', () => {
    expect(parseStudyPaths([null, 'MBA', 7, { name: 'PhD' }])).toHaveLength(1);
  });

  it('stops at the most a guide will show', () => {
    const many = Array.from({ length: MAX_STUDY_PATHS + 5 }, (_, i) => ({
      name: `Level ${i}`,
    }));
    expect(parseStudyPaths(many)).toHaveLength(MAX_STUDY_PATHS);
  });
});
