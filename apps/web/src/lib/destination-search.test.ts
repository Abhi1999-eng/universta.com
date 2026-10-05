import { describe, expect, it } from 'vitest';
import type { Destination } from './study-abroad';
import {
  POPULAR_SHOWN,
  destinationTerms,
  destinationToOpen,
  matchesDestination,
  popularDestinations,
  regionFromParam,
  regionKey,
} from './destination-search';

const destination = (over: Partial<Destination> = {}): Destination => ({
  name: 'Germany',
  slug: 'germany',
  iso2Code: 'DE',
  isPopular: false,
  isAvailable: true,
  region: 'Europe',
  summary: null,
  bands: null,
  counts: { universities: 0, courses: 0, scholarships: 0, consultants: 0 },
  ...over,
});

const uk = destination({ name: 'United Kingdom', slug: 'united-kingdom', iso2Code: 'GB' });
const us = destination({ name: 'United States', slug: 'united-states', iso2Code: 'US' });
const ukraine = destination({ name: 'Ukraine', slug: 'ukraine', iso2Code: 'UA' });
const tunisia = destination({ name: 'Tunisia', slug: 'tunisia', iso2Code: 'TN' });
const uae = destination({ name: 'United Arab Emirates', slug: 'uae', iso2Code: 'AE' });
const everyone = [uk, us, ukraine, tunisia, uae];
const found = (query: string) =>
  everyone.filter((entry) => matchesDestination(entry, query)).map((entry) => entry.name);

/* The reference's own box: every word typed begins a word of the name,
   and a country is also found by the code and the short name people type. */
describe('matchesDestination', () => {
  it('matches the start of a word, not the inside of one', () => {
    expect(found('uni')).toEqual(['United Kingdom', 'United States', 'United Arab Emirates']);
    expect(found('uni')).not.toContain('Tunisia');
  });

  it('finds the United Kingdom by "uk", beside Ukraine', () => {
    expect(found('uk')).toEqual(['United Kingdom', 'Ukraine']);
  });

  it('finds the United States by "usa" and the Emirates by "uae"', () => {
    expect(found('usa')).toEqual(['United States']);
    expect(found('UAE')).toEqual(['United Arab Emirates']);
  });

  it('finds a destination by its ISO code', () => {
    expect(found('gb')).toEqual(['United Kingdom']);
  });

  it('takes the words in any order, ignoring case and punctuation', () => {
    expect(found('kingdom, UNITED')).toEqual(['United Kingdom']);
  });

  it('matches everything when nothing is typed', () => {
    expect(found('   ')).toHaveLength(everyone.length);
  });

  it('keeps aliases to search terms keyed on the code', () => {
    expect(destinationTerms(uk)).toBe('United Kingdom GB uk britain great britain');
    expect(destinationTerms(destination({ iso2Code: null }))).toBe('Germany ');
  });
});

describe('destinationToOpen', () => {
  it('opens the only match', () => {
    expect(destinationToOpen([uk], 'united k')).toBe(uk);
  });

  it('opens the match whose code or alias is exactly what was typed', () => {
    /* "uk" leaves Ukraine beside the United Kingdom; the reader meant one. */
    expect(destinationToOpen([uk, ukraine], 'uk')).toBe(uk);
    expect(destinationToOpen([uk, us, uae], 'United States')).toBe(us);
  });

  it('stays put when several remain and none is exact', () => {
    expect(destinationToOpen([uk, us, uae], 'uni')).toBeNull();
  });

  it('has nowhere to go for an empty box or a destination with no guide', () => {
    expect(destinationToOpen([uk], '  ')).toBeNull();
    expect(destinationToOpen([destination({ slug: null })], 'germany')).toBeNull();
  });
});

describe('popularDestinations', () => {
  it('opens on the marked destinations with the most behind them', () => {
    const row = popularDestinations([
      destination({ name: 'Ireland', slug: 'ireland', isPopular: true, counts: { universities: 2, courses: 3, scholarships: 0, consultants: 0 } }),
      destination({ name: 'Canada', slug: 'canada', isPopular: true, counts: { universities: 9, courses: 40, scholarships: 0, consultants: 0 } }),
      destination({ name: 'Albania', slug: 'albania', isPopular: false, counts: { universities: 50, courses: 90, scholarships: 0, consultants: 0 } }),
      destination({ name: 'Australia', slug: 'australia', isPopular: true, counts: { universities: 2, courses: 3, scholarships: 0, consultants: 0 } }),
    ]);
    /* Albania is not marked; the tie between Australia and Ireland goes by name. */
    expect(row.map((entry) => entry.name)).toEqual(['Canada', 'Australia', 'Ireland']);
  });

  it('leaves out a marked destination with no guide to open', () => {
    expect(popularDestinations([destination({ isPopular: true, slug: null })])).toEqual([]);
  });

  it('holds the reference row of twelve', () => {
    const many = Array.from({ length: 20 }, (_, index) =>
      destination({ name: `Country ${index}`, slug: `c-${index}`, isPopular: true }),
    );
    expect(popularDestinations(many)).toHaveLength(POPULAR_SHOWN);
    expect(POPULAR_SHOWN).toBe(12);
  });
});

describe('the region in the address', () => {
  const regions = ['Europe', 'North America', 'Asia'];

  it('writes a region as a short key', () => {
    expect(regionKey('North America')).toBe('north-america');
    expect(regionKey(' Asia ')).toBe('asia');
  });

  it('reads the key or the name back to the directory\'s own name', () => {
    expect(regionFromParam('north-america', regions)).toBe('North America');
    expect(regionFromParam('Asia', regions)).toBe('Asia');
  });

  it('falls back to every region for one it does not know', () => {
    expect(regionFromParam('atlantis', regions)).toBe('all');
    expect(regionFromParam(null, regions)).toBe('all');
    expect(regionFromParam('', regions)).toBe('all');
  });
});
