import { bandsFor } from './directory-world';
import { COUNTRY_METADATA } from './country-metadata';

/**
 * The flag mark a destination card draws.
 *
 * There is no flag image anywhere in the approved design -- every mark is
 * three CSS bands -- so these colours are the flag, not a decoration around
 * one. A destination left on the neutral navy placeholder does not read as
 * "no colour chosen"; it reads as a country whose flag failed to load, which
 * is how a published Luxembourg was first reported.
 */

const PLACEHOLDER = ['#0C2038', '#1B3554', '#2A4A70'];

describe('world directory flag bands', () => {
  it('gives every destination the editor can publish its own colours', () => {
    const anonymous = COUNTRY_METADATA.filter((record) => {
      const bands = bandsFor(record.name, record.iso2Code);
      return (
        !bands || PLACEHOLDER.every((colour, index) => bands[index] === colour)
      );
    }).map((record) => `${record.name} (${record.iso2Code})`);

    expect(anonymous).toEqual([]);
  });

  it('resolves a destination the world list spells differently, by its code', () => {
    // "United Kingdom" in the metadata, "UK" in the world list.
    expect(bandsFor('United Kingdom', 'GB')).toEqual([
      '#012169',
      '#C8102E',
      '#FFFFFF',
    ]);
    expect(bandsFor('United States', 'US')).toEqual([
      '#3C3B6E',
      '#B22234',
      '#FFFFFF',
    ]);
    expect(bandsFor('Türkiye', 'TR')).toEqual([
      '#E30A17',
      '#FFFFFF',
      '#E30A17',
    ]);
  });

  it('knows Luxembourg by its red, white and light blue', () => {
    expect(bandsFor('Luxembourg', 'LU')).toEqual([
      '#ED2939',
      '#FFFFFF',
      '#00A1DE',
    ]);
  });

  it('has nothing to say about a country it does not carry', () => {
    expect(bandsFor('Not A Country', 'QX')).toBeNull();
  });
});
