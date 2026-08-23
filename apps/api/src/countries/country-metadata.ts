/**
 * Offline country identity metadata. This deliberately avoids a runtime
 * dependency on an external API: ISO/currency identity is infrastructure data,
 * not editorial content. Names and aliases are normalized before lookup so
 * normal Admin spelling such as "UK" resolves to the same canonical record.
 */
export type CountryMetadata = {
  name: string;
  iso2Code: string;
  iso3Code: string;
  currencyCode: string;
  currencySymbol: string;
  aliases?: string[];
};

const records: CountryMetadata[] = [
  {
    name: 'Australia',
    iso2Code: 'AU',
    iso3Code: 'AUS',
    currencyCode: 'AUD',
    currencySymbol: '$',
  },
  {
    name: 'Austria',
    iso2Code: 'AT',
    iso3Code: 'AUT',
    currencyCode: 'EUR',
    currencySymbol: '€',
  },
  {
    name: 'Bangladesh',
    iso2Code: 'BD',
    iso3Code: 'BGD',
    currencyCode: 'BDT',
    currencySymbol: '৳',
  },
  {
    name: 'Belgium',
    iso2Code: 'BE',
    iso3Code: 'BEL',
    currencyCode: 'EUR',
    currencySymbol: '€',
  },
  {
    name: 'Brazil',
    iso2Code: 'BR',
    iso3Code: 'BRA',
    currencyCode: 'BRL',
    currencySymbol: 'R$',
  },
  {
    name: 'Canada',
    iso2Code: 'CA',
    iso3Code: 'CAN',
    currencyCode: 'CAD',
    currencySymbol: '$',
  },
  {
    name: 'China',
    iso2Code: 'CN',
    iso3Code: 'CHN',
    currencyCode: 'CNY',
    currencySymbol: '¥',
  },
  {
    name: 'Denmark',
    iso2Code: 'DK',
    iso3Code: 'DNK',
    currencyCode: 'DKK',
    currencySymbol: 'kr',
  },
  {
    name: 'Finland',
    iso2Code: 'FI',
    iso3Code: 'FIN',
    currencyCode: 'EUR',
    currencySymbol: '€',
  },
  {
    name: 'France',
    iso2Code: 'FR',
    iso3Code: 'FRA',
    currencyCode: 'EUR',
    currencySymbol: '€',
  },
  {
    name: 'Germany',
    iso2Code: 'DE',
    iso3Code: 'DEU',
    currencyCode: 'EUR',
    currencySymbol: '€',
  },
  {
    name: 'India',
    iso2Code: 'IN',
    iso3Code: 'IND',
    currencyCode: 'INR',
    currencySymbol: '₹',
  },
  {
    name: 'Ireland',
    iso2Code: 'IE',
    iso3Code: 'IRL',
    currencyCode: 'EUR',
    currencySymbol: '€',
  },
  {
    name: 'Italy',
    iso2Code: 'IT',
    iso3Code: 'ITA',
    currencyCode: 'EUR',
    currencySymbol: '€',
  },
  {
    name: 'Japan',
    iso2Code: 'JP',
    iso3Code: 'JPN',
    currencyCode: 'JPY',
    currencySymbol: '¥',
  },
  {
    name: 'Malaysia',
    iso2Code: 'MY',
    iso3Code: 'MYS',
    currencyCode: 'MYR',
    currencySymbol: 'RM',
  },
  {
    name: 'Mexico',
    iso2Code: 'MX',
    iso3Code: 'MEX',
    currencyCode: 'MXN',
    currencySymbol: '$',
  },
  {
    name: 'Netherlands',
    iso2Code: 'NL',
    iso3Code: 'NLD',
    currencyCode: 'EUR',
    currencySymbol: '€',
    aliases: ['Holland'],
  },
  {
    name: 'New Zealand',
    iso2Code: 'NZ',
    iso3Code: 'NZL',
    currencyCode: 'NZD',
    currencySymbol: '$',
  },
  {
    name: 'Norway',
    iso2Code: 'NO',
    iso3Code: 'NOR',
    currencyCode: 'NOK',
    currencySymbol: 'kr',
  },
  {
    name: 'Pakistan',
    iso2Code: 'PK',
    iso3Code: 'PAK',
    currencyCode: 'PKR',
    currencySymbol: '₨',
  },
  {
    name: 'Poland',
    iso2Code: 'PL',
    iso3Code: 'POL',
    currencyCode: 'PLN',
    currencySymbol: 'zł',
  },
  {
    name: 'Portugal',
    iso2Code: 'PT',
    iso3Code: 'PRT',
    currencyCode: 'EUR',
    currencySymbol: '€',
  },
  {
    name: 'Singapore',
    iso2Code: 'SG',
    iso3Code: 'SGP',
    currencyCode: 'SGD',
    currencySymbol: '$',
  },
  {
    name: 'South Africa',
    iso2Code: 'ZA',
    iso3Code: 'ZAF',
    currencyCode: 'ZAR',
    currencySymbol: 'R',
  },
  {
    name: 'South Korea',
    iso2Code: 'KR',
    iso3Code: 'KOR',
    currencyCode: 'KRW',
    currencySymbol: '₩',
    aliases: ['Korea, Republic of', 'Republic of Korea'],
  },
  {
    name: 'Spain',
    iso2Code: 'ES',
    iso3Code: 'ESP',
    currencyCode: 'EUR',
    currencySymbol: '€',
  },
  {
    name: 'Sweden',
    iso2Code: 'SE',
    iso3Code: 'SWE',
    currencyCode: 'SEK',
    currencySymbol: 'kr',
  },
  {
    name: 'Switzerland',
    iso2Code: 'CH',
    iso3Code: 'CHE',
    currencyCode: 'CHF',
    currencySymbol: 'CHF',
  },
  {
    name: 'United Arab Emirates',
    iso2Code: 'AE',
    iso3Code: 'ARE',
    currencyCode: 'AED',
    currencySymbol: 'د.إ',
    aliases: ['UAE'],
  },
  {
    name: 'United Kingdom',
    iso2Code: 'GB',
    iso3Code: 'GBR',
    currencyCode: 'GBP',
    currencySymbol: '£',
    aliases: ['UK', 'Great Britain', 'Britain'],
  },
  {
    name: 'United States',
    iso2Code: 'US',
    iso3Code: 'USA',
    currencyCode: 'USD',
    currencySymbol: '$',
    aliases: ['USA', 'United States of America', 'US'],
  },
];

export function normalizeCountryName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

const byName = new Map(
  records.flatMap((record) =>
    [record.name, ...(record.aliases ?? [])].map(
      (name) => [normalizeCountryName(name), record] as const,
    ),
  ),
);

export function resolveCountryMetadata(name: string): CountryMetadata | null {
  return byName.get(normalizeCountryName(name)) ?? null;
}
