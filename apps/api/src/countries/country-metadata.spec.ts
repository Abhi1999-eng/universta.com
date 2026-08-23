import {
  normalizeCountryName,
  resolveCountryMetadata,
} from './country-metadata';

describe('country metadata', () => {
  it('resolves canonical names and safe aliases without an external request', () => {
    expect(resolveCountryMetadata('Canada')).toMatchObject({
      iso2Code: 'CA',
      iso3Code: 'CAN',
      currencyCode: 'CAD',
      currencySymbol: '$',
    });
    expect(resolveCountryMetadata('  UK  ')).toMatchObject({
      name: 'United Kingdom',
      iso2Code: 'GB',
      currencyCode: 'GBP',
    });
    expect(normalizeCountryName('United States of America')).toBe(
      'united states of america',
    );
  });
});
