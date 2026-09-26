/**
 * The world's study destinations, by region.
 *
 * The public directory lists every destination a student might ask about, not
 * only the ones Universta has published a guide for. The published ones come
 * from the Country table; the rest are listed by name and region alone so the
 * page can say "guide coming" without a Country record existing and without a
 * DRAFT record ever being exposed.
 *
 * This is infrastructure data in the same spirit as `country-metadata.ts`: which
 * countries exist and which region they sit in. It carries no editorial or
 * factual claim -- no costs, no visa rules, no counts. A destination graduates
 * out of this list the moment an editor publishes a Country with that name.
 *
 * Regions match the groupings in the approved directory design.
 */
import {
  COUNTRY_TABLE,
  countryTableRow,
  type CountryBand,
} from './country-table';

export const DIRECTORY_REGIONS = [
  'Europe',
  'North America',
  'Latin America',
  'Asia',
  'Middle East',
  'Africa',
  'Oceania',
] as const;

export type DirectoryRegion = (typeof DIRECTORY_REGIONS)[number];

/**
 * Every destination the directory offers, and the region it is filed under.
 *
 * Flag colours used to be a fourth column here, written by hand. They live
 * in the generated country table now, measured from the artwork -- two lists
 * of the same colours could disagree, and the hand-written one had 123 of
 * these carrying the same anonymous navy.
 */
const WORLD: ReadonlyArray<readonly [string, DirectoryRegion, string]> = [
  ['Afghanistan', 'Asia', 'AF'],
  ['Albania', 'Europe', 'AL'],
  ['Algeria', 'Africa', 'DZ'],
  ['Andorra', 'Europe', 'AD'],
  ['Angola', 'Africa', 'AO'],
  ['Antigua and Barbuda', 'Latin America', 'AG'],
  ['Argentina', 'Latin America', 'AR'],
  ['Armenia', 'Middle East', 'AM'],
  ['Aruba', 'Latin America', 'AW'],
  ['Australia', 'Oceania', 'AU'],
  ['Austria', 'Europe', 'AT'],
  ['Azerbaijan', 'Middle East', 'AZ'],
  ['Bahamas', 'Latin America', 'BS'],
  ['Bahrain', 'Middle East', 'BH'],
  ['Bangladesh', 'Asia', 'BD'],
  ['Barbados', 'Latin America', 'BB'],
  ['Belarus', 'Europe', 'BY'],
  ['Belgium', 'Europe', 'BE'],
  ['Belize', 'Latin America', 'BZ'],
  ['Benin', 'Africa', 'BJ'],
  ['Bermuda', 'Latin America', 'BM'],
  ['Bhutan', 'Asia', 'BT'],
  ['Bolivia', 'Latin America', 'BO'],
  ['Bosnia and Herzegovina', 'Europe', 'BA'],
  ['Botswana', 'Africa', 'BW'],
  ['Brazil', 'Latin America', 'BR'],
  ['Brunei', 'Asia', 'BN'],
  ['Bulgaria', 'Europe', 'BG'],
  ['Burkina Faso', 'Africa', 'BF'],
  ['Burundi', 'Africa', 'BI'],
  ['Cabo Verde', 'Africa', 'CV'],
  ['Cambodia', 'Asia', 'KH'],
  ['Cameroon', 'Africa', 'CM'],
  ['Canada', 'North America', 'CA'],
  ['Cayman Islands', 'Latin America', 'KY'],
  ['Central African Republic', 'Africa', 'CF'],
  ['Chad', 'Africa', 'TD'],
  ['Chile', 'Latin America', 'CL'],
  ['China', 'Asia', 'CN'],
  ['Colombia', 'Latin America', 'CO'],
  ['Comoros', 'Africa', 'KM'],
  ['Congo', 'Africa', 'CG'],
  ['Costa Rica', 'Latin America', 'CR'],
  ['Croatia', 'Europe', 'HR'],
  ['Cuba', 'Latin America', 'CU'],
  ['Curacao', 'Latin America', 'CW'],
  ['Cyprus', 'Europe', 'CY'],
  ['Czechia', 'Europe', 'CZ'],
  ['DR Congo', 'Africa', 'CD'],
  ['Denmark', 'Europe', 'DK'],
  ['Djibouti', 'Africa', 'DJ'],
  ['Dominica', 'Latin America', 'DM'],
  ['Dominican Republic', 'Latin America', 'DO'],
  ['Ecuador', 'Latin America', 'EC'],
  ['Egypt', 'Africa', 'EG'],
  ['El Salvador', 'Latin America', 'SV'],
  ['Equatorial Guinea', 'Africa', 'GQ'],
  ['Eritrea', 'Africa', 'ER'],
  ['Estonia', 'Europe', 'EE'],
  ['Eswatini', 'Africa', 'SZ'],
  ['Ethiopia', 'Africa', 'ET'],
  ['Fiji', 'Oceania', 'FJ'],
  ['Finland', 'Europe', 'FI'],
  ['France', 'Europe', 'FR'],
  ['Gabon', 'Africa', 'GA'],
  ['Gambia', 'Africa', 'GM'],
  ['Georgia', 'Middle East', 'GE'],
  ['Germany', 'Europe', 'DE'],
  ['Ghana', 'Africa', 'GH'],
  ['Greece', 'Europe', 'GR'],
  ['Greenland', 'Europe', 'GL'],
  ['Grenada', 'Latin America', 'GD'],
  ['Guatemala', 'Latin America', 'GT'],
  ['Guinea', 'Africa', 'GN'],
  ['Guinea-Bissau', 'Africa', 'GW'],
  ['Guyana', 'Latin America', 'GY'],
  ['Haiti', 'Latin America', 'HT'],
  ['Honduras', 'Latin America', 'HN'],
  ['Hong Kong', 'Asia', 'HK'],
  ['Hungary', 'Europe', 'HU'],
  ['Iceland', 'Europe', 'IS'],
  ['India', 'Asia', 'IN'],
  ['Indonesia', 'Asia', 'ID'],
  ['Iran', 'Middle East', 'IR'],
  ['Iraq', 'Middle East', 'IQ'],
  ['Ireland', 'Europe', 'IE'],
  ['Israel', 'Middle East', 'IL'],
  ['Italy', 'Europe', 'IT'],
  ['Ivory Coast', 'Africa', 'CI'],
  ['Jamaica', 'Latin America', 'JM'],
  ['Japan', 'Asia', 'JP'],
  ['Jordan', 'Middle East', 'JO'],
  ['Kazakhstan', 'Asia', 'KZ'],
  ['Kenya', 'Africa', 'KE'],
  ['Kiribati', 'Oceania', 'KI'],
  ['Kosovo', 'Europe', 'XK'],
  ['Kuwait', 'Middle East', 'KW'],
  ['Kyrgyzstan', 'Asia', 'KG'],
  ['Laos', 'Asia', 'LA'],
  ['Latvia', 'Europe', 'LV'],
  ['Lebanon', 'Middle East', 'LB'],
  ['Lesotho', 'Africa', 'LS'],
  ['Liberia', 'Africa', 'LR'],
  ['Libya', 'Africa', 'LY'],
  ['Liechtenstein', 'Europe', 'LI'],
  ['Lithuania', 'Europe', 'LT'],
  ['Luxembourg', 'Europe', 'LU'],
  ['Macau', 'Asia', 'MO'],
  ['Madagascar', 'Africa', 'MG'],
  ['Malawi', 'Africa', 'MW'],
  ['Malaysia', 'Asia', 'MY'],
  ['Maldives', 'Asia', 'MV'],
  ['Mali', 'Africa', 'ML'],
  ['Malta', 'Europe', 'MT'],
  ['Marshall Islands', 'Oceania', 'MH'],
  ['Mauritania', 'Africa', 'MR'],
  ['Mauritius', 'Africa', 'MU'],
  ['Mexico', 'Latin America', 'MX'],
  ['Micronesia', 'Oceania', 'FM'],
  ['Moldova', 'Europe', 'MD'],
  ['Monaco', 'Europe', 'MC'],
  ['Mongolia', 'Asia', 'MN'],
  ['Montenegro', 'Europe', 'ME'],
  ['Morocco', 'Africa', 'MA'],
  ['Mozambique', 'Africa', 'MZ'],
  ['Myanmar', 'Asia', 'MM'],
  ['Namibia', 'Africa', 'NA'],
  ['Nauru', 'Oceania', 'NR'],
  ['Nepal', 'Asia', 'NP'],
  ['Netherlands', 'Europe', 'NL'],
  ['New Caledonia', 'Oceania', 'NC'],
  ['New Zealand', 'Oceania', 'NZ'],
  ['Nicaragua', 'Latin America', 'NI'],
  ['Niger', 'Africa', 'NE'],
  ['Nigeria', 'Africa', 'NG'],
  ['North Korea', 'Asia', 'KP'],
  ['North Macedonia', 'Europe', 'MK'],
  ['Norway', 'Europe', 'NO'],
  ['Oman', 'Middle East', 'OM'],
  ['Pakistan', 'Asia', 'PK'],
  ['Palau', 'Oceania', 'PW'],
  ['Palestine', 'Middle East', 'PS'],
  ['Panama', 'Latin America', 'PA'],
  ['Papua New Guinea', 'Oceania', 'PG'],
  ['Paraguay', 'Latin America', 'PY'],
  ['Peru', 'Latin America', 'PE'],
  ['Philippines', 'Asia', 'PH'],
  ['Poland', 'Europe', 'PL'],
  ['Portugal', 'Europe', 'PT'],
  ['Puerto Rico', 'Latin America', 'PR'],
  ['Qatar', 'Middle East', 'QA'],
  ['Romania', 'Europe', 'RO'],
  ['Russia', 'Europe', 'RU'],
  ['Rwanda', 'Africa', 'RW'],
  ['Saint Kitts and Nevis', 'Latin America', 'KN'],
  ['Saint Lucia', 'Latin America', 'LC'],
  ['Saint Vincent and the Grenadines', 'Latin America', 'VC'],
  ['Samoa', 'Oceania', 'WS'],
  ['San Marino', 'Europe', 'SM'],
  ['Sao Tome and Principe', 'Africa', 'ST'],
  ['Saudi Arabia', 'Middle East', 'SA'],
  ['Senegal', 'Africa', 'SN'],
  ['Serbia', 'Europe', 'RS'],
  ['Seychelles', 'Africa', 'SC'],
  ['Sierra Leone', 'Africa', 'SL'],
  ['Singapore', 'Asia', 'SG'],
  ['Slovakia', 'Europe', 'SK'],
  ['Slovenia', 'Europe', 'SI'],
  ['Solomon Islands', 'Oceania', 'SB'],
  ['Somalia', 'Africa', 'SO'],
  ['South Africa', 'Africa', 'ZA'],
  ['South Korea', 'Asia', 'KR'],
  ['South Sudan', 'Africa', 'SS'],
  ['Spain', 'Europe', 'ES'],
  ['Sri Lanka', 'Asia', 'LK'],
  ['Sudan', 'Africa', 'SD'],
  ['Suriname', 'Latin America', 'SR'],
  ['Sweden', 'Europe', 'SE'],
  ['Switzerland', 'Europe', 'CH'],
  ['Syria', 'Middle East', 'SY'],
  ['Taiwan', 'Asia', 'TW'],
  ['Tajikistan', 'Asia', 'TJ'],
  ['Tanzania', 'Africa', 'TZ'],
  ['Thailand', 'Asia', 'TH'],
  ['Timor-Leste', 'Asia', 'TL'],
  ['Togo', 'Africa', 'TG'],
  ['Tonga', 'Oceania', 'TO'],
  ['Trinidad and Tobago', 'Latin America', 'TT'],
  ['Tunisia', 'Africa', 'TN'],
  ['Turkey', 'Middle East', 'TR'],
  ['Turkmenistan', 'Asia', 'TM'],
  ['Tuvalu', 'Oceania', 'TV'],
  ['UK', 'Europe', 'GB'],
  ['USA', 'North America', 'US'],
  ['Uganda', 'Africa', 'UG'],
  ['Ukraine', 'Europe', 'UA'],
  ['United Arab Emirates', 'Middle East', 'AE'],
  ['Uruguay', 'Latin America', 'UY'],
  ['Uzbekistan', 'Asia', 'UZ'],
  ['Vanuatu', 'Oceania', 'VU'],
  ['Vatican City', 'Europe', 'VA'],
  ['Venezuela', 'Latin America', 'VE'],
  ['Vietnam', 'Asia', 'VN'],
  ['Yemen', 'Middle East', 'YE'],
  ['Zambia', 'Africa', 'ZM'],
  ['Zimbabwe', 'Africa', 'ZW'],
];

export type DirectoryDestination = {
  name: string;
  region: DirectoryRegion;
  iso2Code: string;
  /* The flag accent the design uses in place of a flag image: no asset to
   * host, no licence to check, and it renders identically offline. */
  bands: readonly [string, string, string] | null;
  /** The same colours with the share of the flag each covers. */
  flag: readonly CountryBand[] | null;
};

/** Every destination, minus the ones already published under a Country record. */
export function comingSoonDestinations(
  publishedNames: Iterable<string>,
): DirectoryDestination[] {
  const taken = new Set(
    [...publishedNames].map((name) => name.trim().toLowerCase()),
  );
  return WORLD.filter(([name]) => !taken.has(name.toLowerCase())).map(
    ([name, region, iso2Code]) => ({
      name,
      region,
      iso2Code,
      bands: bandsFor(name, iso2Code),
      flag: flagBandsFor(name, iso2Code),
    }),
  );
}

/**
 * The catalogue's continents and the directory's regions are not the same
 * vocabulary: the catalogue files countries under "Australia & New Zealand" and
 * "South America", while the directory groups by the seven regions above. A
 * country filed under a continent with no matching region would otherwise fall
 * out of every filter, so the two are reconciled here rather than by renaming
 * anybody's continents.
 */
const CONTINENT_TO_REGION: Record<string, DirectoryRegion> = {
  africa: 'Africa',
  asia: 'Asia',
  europe: 'Europe',
  'north america': 'North America',
  'south america': 'Latin America',
  'latin america': 'Latin America',
  'middle east': 'Middle East',
  oceania: 'Oceania',
  'australia & new zealand': 'Oceania',
  'australia and new zealand': 'Oceania',
  australasia: 'Oceania',
};

export function regionForContinent(
  name: string | null | undefined,
): DirectoryRegion | null {
  if (!name) return null;
  return CONTINENT_TO_REGION[name.trim().toLowerCase()] ?? null;
}

/** The region a published country belongs to, when its continent is unset. */
export function regionForName(name: string): DirectoryRegion | null {
  const needle = name.trim().toLowerCase();
  const hit = WORLD.find(([entry]) => entry.toLowerCase() === needle);
  return hit ? hit[1] : null;
}

/** The flag accent for a destination, by name or ISO code. */
/**
 * The colours a country's flag is made of, most of the flag first.
 *
 * Measured from the flag itself rather than listed by hand -- see
 * scripts/country-table/generate.mjs -- so a share is the share of the flag a
 * colour covers. Denmark is three quarters red with a white cross, and saying
 * so is the difference between its mark reading as Denmark and reading as
 * Austria.
 */
export function flagBandsFor(
  name: string,
  iso2Code?: string | null,
): readonly CountryBand[] | null {
  const needle = name.trim().toLowerCase();
  const code = iso2Code?.trim().toUpperCase();
  const row =
    (code ? countryTableRow(code) : null) ??
    COUNTRY_TABLE.find((entry) => entry.name.toLowerCase() === needle) ??
    null;
  return row?.bands.length ? row.bands : null;
}

/**
 * The same colours as a fixed three, for a mark too small to show more.
 *
 * A chip is twenty-odd pixels wide: proportions are invisible there and a
 * missing third band would leave a gap, so a flag of two colours repeats its
 * first. The country page's own rule uses the shares instead.
 */
export function bandsFor(
  name: string,
  iso2Code?: string | null,
): readonly [string, string, string] | null {
  const bands = flagBandsFor(name, iso2Code);
  if (!bands) return null;
  const colours = bands.map((band) => band.colour);
  while (colours.length < 3)
    colours.push(colours[colours.length % bands.length]);
  return [colours[0], colours[1], colours[2]] as const;
}
