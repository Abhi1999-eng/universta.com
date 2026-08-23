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
});
