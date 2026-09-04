import {
  normalizeCountryName,
  resolveCountryMetadata,
} from './country-metadata';
import { CountriesService } from './countries.service';
import type { CountryDerivedService } from './country-derived.service';
import type { PrismaService } from '../prisma/prisma.service';

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

  it('keeps legacy API-only ISO compatibility while canonical names stay authoritative', () => {
    const service = new CountriesService(
      {} as PrismaService,
      {} as CountryDerivedService,
    ) as unknown as {
      metadataOrLegacyIdentity: (
        name: string,
        dto: { iso2Code?: string; iso3Code?: string },
      ) => { iso2Code: string; iso3Code: string; currencyCode?: string };
    };

    expect(
      service.metadataOrLegacyIdentity('Canada', {
        iso2Code: 'ZZ',
        iso3Code: 'ZZZ',
      }),
    ).toMatchObject({ iso2Code: 'CA', iso3Code: 'CAN', currencyCode: 'CAD' });
    expect(
      service.metadataOrLegacyIdentity('Legacy E2E Fixture', {
        iso2Code: 'ZZ',
        iso3Code: 'ZZZ',
      }),
    ).toMatchObject({ iso2Code: 'ZZ', iso3Code: 'ZZZ' });
    expect(
      service.metadataOrLegacyIdentity('Unrecognised draft', {}),
    ).toBeUndefined();
  });

  it('resolves Malta, which a client could not publish before it was covered', () => {
    /* Malta was absent from the table, so a Country created with that name got
     * no ISO codes and publish then failed COUNTRY_NOT_READY on iso2Code and
     * iso3Code. */
    expect(resolveCountryMetadata('Malta')).toMatchObject({
      iso2Code: 'MT',
      iso3Code: 'MLT',
      currencyCode: 'EUR',
      currencySymbol: '\u20ac',
    });
  });

  it('covers the countries an Admin is likely to create, not just one', () => {
    const expected: Array<[string, string, string]> = [
      ['Malta', 'MT', 'MLT'],
      ['Cyprus', 'CY', 'CYP'],
      ['Greece', 'GR', 'GRC'],
      ['Luxembourg', 'LU', 'LUX'],
      ['Estonia', 'EE', 'EST'],
      ['Vietnam', 'VN', 'VNM'],
      ['Nigeria', 'NG', 'NGA'],
      ['Saudi Arabia', 'SA', 'SAU'],
      ['Argentina', 'AR', 'ARG'],
      ['Hong Kong', 'HK', 'HKG'],
    ];
    for (const [name, iso2Code, iso3Code] of expected)
      expect(resolveCountryMetadata(name)).toMatchObject({
        iso2Code,
        iso3Code,
      });
  });

  it('accepts the spellings an operator actually types', () => {
    for (const [typed, canonical] of [
      ['malta', 'MT'],
      ['MALTA', 'MT'],
      ['Czech Republic', 'CZ'],
      ['Turkey', 'TR'],
      ['Viet Nam', 'VN'],
    ] as const)
      expect(resolveCountryMetadata(typed)).toMatchObject({
        iso2Code: canonical,
      });
  });

  it('keeps every ISO code in the table unique and well formed', () => {
    // A duplicate here would surface as a confusing uniqueness conflict on save.
    const seen2 = new Set<string>();
    const seen3 = new Set<string>();
    for (const name of [
      'Malta',
      'Cyprus',
      'Greece',
      'Czechia',
      'Hungary',
      'Romania',
      'Bulgaria',
      'Croatia',
      'Slovakia',
      'Slovenia',
      'Estonia',
      'Latvia',
      'Lithuania',
      'Luxembourg',
      'Iceland',
      'Vietnam',
      'Thailand',
      'Philippines',
      'Indonesia',
      'Sri Lanka',
      'Nepal',
      'Taiwan',
      'Saudi Arabia',
      'Qatar',
      'Kuwait',
      'Israel',
      'Egypt',
      'Nigeria',
      'Kenya',
      'Ghana',
      'Argentina',
      'Chile',
      'Colombia',
      'Peru',
      'Fiji',
    ]) {
      const record = resolveCountryMetadata(name);
      expect(record).toBeTruthy();
      expect(record!.iso2Code).toMatch(/^[A-Z]{2}$/);
      expect(record!.iso3Code).toMatch(/^[A-Z]{3}$/);
      expect(seen2.has(record!.iso2Code)).toBe(false);
      expect(seen3.has(record!.iso3Code)).toBe(false);
      seen2.add(record!.iso2Code);
      seen3.add(record!.iso3Code);
    }
  });
});
