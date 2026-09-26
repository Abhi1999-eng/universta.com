import { bandsFor, flagBandsFor } from './directory-world';
import { COUNTRY_METADATA } from './country-metadata';
import { COUNTRY_TABLE } from './country-table';

/**
 * The flag mark a destination draws.
 *
 * There is no flag image anywhere in the approved design -- every mark is
 * colour bands -- so these colours are the flag, not a decoration around one.
 * They are measured from the artwork rather than listed by hand, which is what
 * makes the share meaningful and what keeps a destination added later from
 * quietly having no flag at all.
 */

describe('flag bands', () => {
  it('gives every destination the editor can publish a flag', () => {
    const anonymous = COUNTRY_METADATA.filter(
      (record) => !flagBandsFor(record.name, record.iso2Code)?.length,
    ).map((record) => `${record.name} (${record.iso2Code})`);

    expect(anonymous).toEqual([]);
  });

  it('gives every country in the table one too', () => {
    const anonymous = COUNTRY_TABLE.filter((row) => !row.bands.length).map(
      (row) => row.name,
    );
    expect(anonymous).toEqual([]);
  });

  it('resolves a destination the world list spells differently, by its code', () => {
    // "United Kingdom" in the metadata, "UK" in the table.
    expect(flagBandsFor('United Kingdom', 'GB')?.[0].colour).toBe('#c8102e');
    expect(flagBandsFor('United States', 'US')?.[0].colour).toBe('#ffffff');
    expect(flagBandsFor('Türkiye', 'TR')?.[0].colour).toBe('#e30a17');
  });

  it('knows Luxembourg by its red, white and light blue', () => {
    expect(
      flagBandsFor('Luxembourg', 'LU')?.map((band) => band.colour),
    ).toEqual(['#ed2939', '#ffffff', '#00a1de']);
  });

  /* Denmark is a white cross on red, and the seam along that cross renders as
     enough pink to pass for a third band. Counting it would make the mark a
     washed-out tricolour -- which is Austria's flag, not Denmark's. */
  it('reads Denmark as red with a white cross, not as three stripes', () => {
    const bands = flagBandsFor('Denmark', 'DK')!;
    expect(bands.map((band) => band.colour)).toEqual(['#c8102e', '#ffffff']);
    expect(bands[0].share).toBeGreaterThan(bands[1].share);
  });

  /* A chip is twenty-odd pixels wide: proportions do not read at that size and
     a missing band would leave a gap, so two colours become three. */
  it('pads a two-colour flag for a mark too small to show proportions', () => {
    expect(bandsFor('Denmark', 'DK')).toEqual([
      '#c8102e',
      '#ffffff',
      '#c8102e',
    ]);
  });

  it('has nothing to say about a country it does not carry', () => {
    expect(flagBandsFor('Not A Country', 'QX')).toBeNull();
    expect(bandsFor('Not A Country', 'QX')).toBeNull();
  });
});

describe('the country table', () => {
  it('carries an ISO3 and a currency for every row', () => {
    const incomplete = COUNTRY_TABLE.filter(
      (row) => !row.iso3 || !row.currencyCode || !row.currencySymbol,
    ).map((row) => row.name);
    expect(incomplete).toEqual([]);
  });

  /* The curated entries carry judgement the reference data does not: "KSh"
     rather than the "Sh" it gives Kenya, Tanzania and Uganda alike. */
  it('keeps the curated currency symbols rather than the dataset ones', () => {
    const byIso = new Map(COUNTRY_TABLE.map((row) => [row.iso2, row]));
    for (const [iso2, symbol] of [
      ['KE', 'KSh'],
      ['TZ', 'TSh'],
      ['UG', 'USh'],
      ['CH', 'CHF'],
    ] as Array<[string, string]>)
      expect(byIso.get(iso2)?.currencySymbol).toBe(symbol);
  });

  it('agrees with every destination already curated by hand', () => {
    const byIso = new Map(COUNTRY_TABLE.map((row) => [row.iso2, row]));
    const drifted = COUNTRY_METADATA.filter((record) => {
      const row = byIso.get(record.iso2Code);
      return (
        !row ||
        row.iso3 !== record.iso3Code ||
        row.currencyCode !== record.currencyCode ||
        row.currencySymbol !== record.currencySymbol
      );
    }).map((record) => record.name);

    expect(drifted).toEqual([]);
  });
});
