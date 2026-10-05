import { describe, expect, it } from 'vitest';
import {
  SWITCHER_COLUMNS,
  destinationsLead,
  programmeCount,
  rankDestinations,
  sparseBandClass,
  switcherClass,
  teachingDestinations,
} from './switcher';

/**
 * "Where you can study X" lays its destination chips into three equal
 * tracks. That reads well at 186 chips and badly at one: the single chip was
 * stretched across a third of the band with two empty columns beside it, so
 * the section looked like something that had failed to load rather than a
 * destination list with one entry in it.
 */

describe('the destination chip grid', () => {
  it('packs one chip to the start instead of stretching it', () => {
    expect(switcherClass(1)).toBe('switcher switcher--few');
  });

  it('does the same for two', () => {
    expect(switcherClass(2)).toBe('switcher switcher--few');
  });

  it('fills the tracks once there are enough of them to fill', () => {
    expect(switcherClass(SWITCHER_COLUMNS)).toBe('switcher');
    expect(switcherClass(186)).toBe('switcher');
  });

  it('is harmless at zero, where the section does not render at all', () => {
    expect(switcherClass(0)).toBe('switcher switcher--few');
  });
});

describe('the band around it', () => {
  it('goes compact when it holds one or two', () => {
    expect(sparseBandClass(1)).toBe(' sec--sparse');
    expect(sparseBandClass(2)).toBe(' sec--sparse');
  });

  it('keeps the full furniture once there is something to fill it', () => {
    expect(sparseBandClass(SWITCHER_COLUMNS)).toBe('');
    expect(sparseBandClass(205)).toBe('');
  });

  it('is a suffix, so it appends to whatever band class it is given', () => {
    /* The call site is `band('destinations') + sparseBandClass(n)`. */
    expect('sec sec--white' + sparseBandClass(1)).toBe(
      'sec sec--white sec--sparse',
    );
    expect('sec sec--white' + sparseBandClass(9)).toBe('sec sec--white');
  });
});

/**
 * "Where you can study Computer Science" opened on Afghanistan, Albania and
 * Algeria. The record now counts programmes per destination, and the band
 * opens on the places that teach it.
 */
describe('the order the destinations are shown in', () => {
  const country = (id: string, courseCount?: number | null) => ({
    id,
    name: id,
    slug: id,
    courseCount,
  });

  it('puts the places that teach it first, most programmes first', () => {
    const ranked = rankDestinations([
      country('afghanistan', 0),
      country('canada', 5),
      country('albania', 0),
      country('united-states', 6),
    ]);
    expect(ranked.map((row) => row.id)).toEqual([
      'united-states',
      'canada',
      'afghanistan',
      'albania',
    ]);
  });

  it('keeps the order it was given among equals, and for a record with no counts', () => {
    expect(
      rankDestinations([country('b'), country('a'), country('c')]).map((row) => row.id),
    ).toEqual(['b', 'a', 'c']);
  });

  it('knows which of them teach it', () => {
    expect(
      teachingDestinations([country('a', 2), country('b', 0), country('c')]).map(
        (row) => row.id,
      ),
    ).toEqual(['a']);
  });

  it('counts programmes in words', () => {
    expect(programmeCount(1)).toBe('1 programme');
    expect(programmeCount(6)).toBe('6 programmes');
  });
});

describe('what the destinations band says', () => {
  const lead = (countries: Array<{ courseCount?: number | null }>) =>
    destinationsLead({
      name: 'Law',
      countries: countries.map((row, index) => ({
        id: String(index),
        name: String(index),
        slug: String(index),
        ...row,
      })),
      open: 'Open one.',
      legacy: 'Open a destination.',
    });

  it('names how many teach it, and how many only list it', () => {
    expect(lead([{ courseCount: 3 }, { courseCount: 1 }, { courseCount: 0 }])).toBe(
      '2 destinations teach Law, and they come first, most programmes first. 1 more list it with no programme published yet. Open one.',
    );
  });

  it('says so plainly when none teaches it yet', () => {
    expect(lead([{ courseCount: 0 }])).toBe(
      'No destination has a Law programme published yet. Open one.',
    );
  });

  it('keeps the sentence it had for a record sent without counts', () => {
    expect(lead([{}, {}])).toBe('Open a destination.');
  });
});
