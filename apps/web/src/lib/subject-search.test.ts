import { describe, expect, it } from 'vitest';
import { foldWords, matchesSubject } from './subject-search';

/**
 * The search on a destination's subjects page behaves the way the reference
 * site's does: each typed word begins a word of the name, in any order.
 * Every case here was typed into that site's box and gave this answer.
 */
const NAMES = [
  'Agriculture & Environmental Sciences',
  'Business & Management',
  'Computing & Information Technology',
  'Education, PGCE & Teaching',
  'Energy, Oil & Gas',
  'Engineering',
  'Health, Medicine & Veterinary Studies',
  'Law',
  'Security, Defence & Emergency Management',
];
const found = (query: string) => NAMES.filter((name) => matchesSubject(name, query));

describe('searching a destination’s subjects', () => {
  it('finds a subject from the start of its name, whatever the case', () => {
    for (const query of ['engin', 'ENGIN', 'EnGiN', '  engin  '])
      expect(found(query)).toEqual(['Engineering']);
  });

  it('finds one from the start of any word in it', () => {
    expect(found('tech')).toEqual(['Computing & Information Technology']);
    expect(found('pgce')).toEqual(['Education, PGCE & Teaching']);
    expect(found('manag')).toEqual([
      'Business & Management',
      'Security, Defence & Emergency Management',
    ]);
  });

  it('does not match the middle or the end of a word', () => {
    /* "ing" used to return every subject that ends in it. */
    expect(found('gineer')).toEqual([]);
    expect(found('ing')).toEqual([]);
  });

  it('takes several words in any order, and ignores the punctuation between them', () => {
    for (const query of ['oil gas', 'gas oil', 'oil & gas', 'oil, gas', 'energy oil'])
      expect(found(query)).toEqual(['Energy, Oil & Gas']);
  });

  it('needs every typed word to be there', () => {
    expect(found('business management xyz')).toEqual([]);
  });

  it('shows everything for an empty box, or one with only spaces or punctuation', () => {
    expect(found('')).toEqual(NAMES);
    expect(found('   ')).toEqual(NAMES);
    expect(found('&')).toEqual(NAMES);
  });

  it('reads an accented letter as the letter', () => {
    expect(matchesSubject('Études Françaises', 'etudes franc')).toBe(true);
  });

  it('splits a name on anything that is not a letter or a digit', () => {
    expect(foldWords('Health, Medicine & Veterinary Studies')).toEqual([
      'health',
      'medicine',
      'veterinary',
      'studies',
    ]);
  });
});
