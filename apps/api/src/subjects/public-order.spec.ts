import {
  byEducationOrder,
  publicLevel,
  rankDestinations,
  type DestinationCountry,
} from './public-order';

/**
 * "Where you can study Computer Science" opened on Afghanistan, Albania and
 * Algeria, none of which teaches it, while the United Kingdom sat far down a
 * list of two hundred. And the level bar read PhD, Diploma, Bachelor's.
 */

const country = (
  id: string,
  name: string,
  displayOrder = 0,
): DestinationCountry => ({
  id,
  name,
  slug: id,
  iso2Code: id.toUpperCase(),
  displayOrder,
});

describe('a subject’s destinations', () => {
  const linked = [
    country('af', 'Afghanistan'),
    country('al', 'Albania'),
    country('ca', 'Canada', 1),
    country('us', 'United States', 2),
    country('gb', 'United Kingdom', 3),
  ].map((entry) => ({ country: entry }));

  it('open on the places that teach it, most programmes first', () => {
    const ranked = rankDestinations(
      linked,
      new Map([
        ['ca', 5],
        ['gb', 6],
        ['us', 6],
      ]),
    );
    expect(ranked.map((row) => row.id)).toEqual(['us', 'gb', 'ca', 'af', 'al']);
    expect(ranked.map((row) => row.courseCount)).toEqual([6, 6, 5, 0, 0]);
  });

  it('break a tie by the catalogue’s own country order, then by name', () => {
    const ranked = rankDestinations(
      [
        country('se', 'Sweden'),
        country('dk', 'Denmark'),
        country('gb', 'United Kingdom', 3),
      ].map((entry) => ({ country: entry })),
      new Map([
        ['se', 2],
        ['dk', 2],
        ['gb', 2],
      ]),
    );
    expect(ranked.map((row) => row.id)).toEqual(['dk', 'se', 'gb']);
  });

  it('keep every linked country, even one with nothing behind it yet', () => {
    const ranked = rankDestinations(linked, new Map());
    expect(ranked).toHaveLength(linked.length);
    expect(ranked.every((row) => row.courseCount === 0)).toBe(true);
  });

  it('add a country that teaches it without an editorial link', () => {
    const ranked = rankDestinations(linked, new Map([['jp', 4]]), [
      country('jp', 'Japan'),
    ]);
    expect(ranked[0]).toMatchObject({ id: 'jp', courseCount: 4 });
  });

  it('do not add an unlinked country that teaches none of it', () => {
    const ranked = rankDestinations(linked, new Map(), [
      country('jp', 'Japan'),
    ]);
    expect(ranked.map((row) => row.id)).not.toContain('jp');
  });

  it('list a country once, however it arrived', () => {
    const ranked = rankDestinations(
      [...linked, linked[2]],
      new Map([['ca', 1]]),
      [country('ca', 'Canada', 1)],
    );
    expect(ranked.filter((row) => row.id === 'ca')).toHaveLength(1);
  });

  it('carry only the fields the page reads', () => {
    const [first] = rankDestinations(linked.slice(2, 3), new Map([['ca', 5]]));
    expect(first).toEqual({
      id: 'ca',
      name: 'Canada',
      slug: 'ca',
      iso2Code: 'CA',
      courseCount: 5,
    });
  });
});

describe('study levels', () => {
  it('come in the order a student climbs them', () => {
    const levels = [
      { id: 'phd', code: 'PHD', name: 'PhD', educationOrder: 8 },
      { id: 'dip', code: 'DIPLOMA', name: 'Diploma', educationOrder: 3 },
      { id: 'ug', code: 'UG', name: "Bachelor's", educationOrder: 4 },
      { id: 'pg', code: 'PG', name: "Master's", educationOrder: 6 },
    ];
    expect([...levels].sort(byEducationOrder).map((row) => row.code)).toEqual([
      'DIPLOMA',
      'UG',
      'PG',
      'PHD',
    ]);
  });

  it('fall back to display order and then name on a tie', () => {
    const levels = [
      { id: 'b', code: 'B', name: 'Beta', educationOrder: 1, displayOrder: 2 },
      { id: 'c', code: 'C', name: 'Gamma', educationOrder: 1, displayOrder: 1 },
      { id: 'a', code: 'A', name: 'Alpha', educationOrder: 1, displayOrder: 2 },
    ];
    expect([...levels].sort(byEducationOrder).map((row) => row.id)).toEqual([
      'c',
      'a',
      'b',
    ]);
  });

  it('leave the payload as it always was', () => {
    expect(
      publicLevel({
        id: 'ug',
        code: 'UG',
        name: "Bachelor's",
        educationOrder: 4,
        displayOrder: 0,
      }),
    ).toEqual({ id: 'ug', code: 'UG', name: "Bachelor's" });
  });
});
