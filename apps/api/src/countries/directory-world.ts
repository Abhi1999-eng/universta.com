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

const WORLD: ReadonlyArray<
  readonly [string, DirectoryRegion, string, readonly [string, string, string]]
> = [
  ['Afghanistan', 'Asia', 'AF', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Albania', 'Europe', 'AL', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Algeria', 'Africa', 'DZ', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Andorra', 'Europe', 'AD', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Angola', 'Africa', 'AO', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Antigua and Barbuda', 'Latin America', 'AG', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Argentina', 'Latin America', 'AR', ['#74ACDF', '#FFFFFF', '#74ACDF']],
  ['Armenia', 'Middle East', 'AM', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Aruba', 'Latin America', 'AW', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Australia', 'Oceania', 'AU', ['#00247D', '#CF142B', '#FFFFFF']],
  ['Austria', 'Europe', 'AT', ['#ED2939', '#FFFFFF', '#ED2939']],
  ['Azerbaijan', 'Middle East', 'AZ', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Bahamas', 'Latin America', 'BS', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Bahrain', 'Middle East', 'BH', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Bangladesh', 'Asia', 'BD', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Barbados', 'Latin America', 'BB', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Belarus', 'Europe', 'BY', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Belgium', 'Europe', 'BE', ['#000000', '#FAE042', '#ED2939']],
  ['Belize', 'Latin America', 'BZ', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Benin', 'Africa', 'BJ', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Bermuda', 'Latin America', 'BM', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Bhutan', 'Asia', 'BT', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Bolivia', 'Latin America', 'BO', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Bosnia and Herzegovina', 'Europe', 'BA', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Botswana', 'Africa', 'BW', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Brazil', 'Latin America', 'BR', ['#009C3B', '#FFDF00', '#002776']],
  ['Brunei', 'Asia', 'BN', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Bulgaria', 'Europe', 'BG', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Burkina Faso', 'Africa', 'BF', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Burundi', 'Africa', 'BI', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Cabo Verde', 'Africa', 'CV', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Cambodia', 'Asia', 'KH', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Cameroon', 'Africa', 'CM', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Canada', 'North America', 'CA', ['#D80621', '#FFFFFF', '#D80621']],
  ['Cayman Islands', 'Latin America', 'KY', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Central African Republic', 'Africa', 'CF', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Chad', 'Africa', 'TD', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Chile', 'Latin America', 'CL', ['#0C2038', '#1B3554', '#2A4A70']],
  ['China', 'Asia', 'CN', ['#DE2910', '#FFDE00', '#DE2910']],
  ['Colombia', 'Latin America', 'CO', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Comoros', 'Africa', 'KM', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Congo', 'Africa', 'CG', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Costa Rica', 'Latin America', 'CR', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Croatia', 'Europe', 'HR', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Cuba', 'Latin America', 'CU', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Curacao', 'Latin America', 'CW', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Cyprus', 'Europe', 'CY', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Czechia', 'Europe', 'CZ', ['#11457E', '#D7141A', '#FFFFFF']],
  ['DR Congo', 'Africa', 'CD', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Denmark', 'Europe', 'DK', ['#C8102E', '#FFFFFF', '#C8102E']],
  ['Djibouti', 'Africa', 'DJ', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Dominica', 'Latin America', 'DM', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Dominican Republic', 'Latin America', 'DO', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Ecuador', 'Latin America', 'EC', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Egypt', 'Africa', 'EG', ['#0C2038', '#1B3554', '#2A4A70']],
  ['El Salvador', 'Latin America', 'SV', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Equatorial Guinea', 'Africa', 'GQ', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Eritrea', 'Africa', 'ER', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Estonia', 'Europe', 'EE', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Eswatini', 'Africa', 'SZ', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Ethiopia', 'Africa', 'ET', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Fiji', 'Oceania', 'FJ', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Finland', 'Europe', 'FI', ['#FFFFFF', '#003580', '#FFFFFF']],
  ['France', 'Europe', 'FR', ['#002395', '#FFFFFF', '#ED2939']],
  ['Gabon', 'Africa', 'GA', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Gambia', 'Africa', 'GM', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Georgia', 'Middle East', 'GE', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Germany', 'Europe', 'DE', ['#000000', '#DD0000', '#FFCE00']],
  ['Ghana', 'Africa', 'GH', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Greece', 'Europe', 'GR', ['#0D5EAF', '#FFFFFF', '#0D5EAF']],
  ['Greenland', 'Europe', 'GL', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Grenada', 'Latin America', 'GD', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Guatemala', 'Latin America', 'GT', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Guinea', 'Africa', 'GN', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Guinea-Bissau', 'Africa', 'GW', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Guyana', 'Latin America', 'GY', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Haiti', 'Latin America', 'HT', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Honduras', 'Latin America', 'HN', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Hong Kong', 'Asia', 'HK', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Hungary', 'Europe', 'HU', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Iceland', 'Europe', 'IS', ['#0C2038', '#1B3554', '#2A4A70']],
  ['India', 'Asia', 'IN', ['#FF9933', '#FFFFFF', '#138808']],
  ['Indonesia', 'Asia', 'ID', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Iran', 'Middle East', 'IR', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Iraq', 'Middle East', 'IQ', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Ireland', 'Europe', 'IE', ['#169B62', '#FFFFFF', '#FF883E']],
  ['Israel', 'Middle East', 'IL', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Italy', 'Europe', 'IT', ['#008C45', '#F4F5F0', '#CD212A']],
  ['Ivory Coast', 'Africa', 'CI', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Jamaica', 'Latin America', 'JM', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Japan', 'Asia', 'JP', ['#FFFFFF', '#BC002D', '#FFFFFF']],
  ['Jordan', 'Middle East', 'JO', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Kazakhstan', 'Asia', 'KZ', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Kenya', 'Africa', 'KE', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Kiribati', 'Oceania', 'KI', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Kosovo', 'Europe', 'XK', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Kuwait', 'Middle East', 'KW', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Kyrgyzstan', 'Asia', 'KG', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Laos', 'Asia', 'LA', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Latvia', 'Europe', 'LV', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Lebanon', 'Middle East', 'LB', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Lesotho', 'Africa', 'LS', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Liberia', 'Africa', 'LR', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Libya', 'Africa', 'LY', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Liechtenstein', 'Europe', 'LI', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Lithuania', 'Europe', 'LT', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Luxembourg', 'Europe', 'LU', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Macau', 'Asia', 'MO', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Madagascar', 'Africa', 'MG', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Malawi', 'Africa', 'MW', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Malaysia', 'Asia', 'MY', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Maldives', 'Asia', 'MV', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Mali', 'Africa', 'ML', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Malta', 'Europe', 'MT', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Marshall Islands', 'Oceania', 'MH', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Mauritania', 'Africa', 'MR', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Mauritius', 'Africa', 'MU', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Mexico', 'Latin America', 'MX', ['#006847', '#FFFFFF', '#CE1126']],
  ['Micronesia', 'Oceania', 'FM', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Moldova', 'Europe', 'MD', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Monaco', 'Europe', 'MC', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Mongolia', 'Asia', 'MN', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Montenegro', 'Europe', 'ME', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Morocco', 'Africa', 'MA', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Mozambique', 'Africa', 'MZ', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Myanmar', 'Asia', 'MM', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Namibia', 'Africa', 'NA', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Nauru', 'Oceania', 'NR', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Nepal', 'Asia', 'NP', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Netherlands', 'Europe', 'NL', ['#AE1C28', '#FFFFFF', '#21468B']],
  ['New Caledonia', 'Oceania', 'NC', ['#0C2038', '#1B3554', '#2A4A70']],
  ['New Zealand', 'Oceania', 'NZ', ['#00247D', '#CC142B', '#FFFFFF']],
  ['Nicaragua', 'Latin America', 'NI', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Niger', 'Africa', 'NE', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Nigeria', 'Africa', 'NG', ['#0C2038', '#1B3554', '#2A4A70']],
  ['North Korea', 'Asia', 'KP', ['#0C2038', '#1B3554', '#2A4A70']],
  ['North Macedonia', 'Europe', 'MK', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Norway', 'Europe', 'NO', ['#BA0C2F', '#FFFFFF', '#00205B']],
  ['Oman', 'Middle East', 'OM', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Pakistan', 'Asia', 'PK', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Palau', 'Oceania', 'PW', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Palestine', 'Middle East', 'PS', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Panama', 'Latin America', 'PA', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Papua New Guinea', 'Oceania', 'PG', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Paraguay', 'Latin America', 'PY', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Peru', 'Latin America', 'PE', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Philippines', 'Asia', 'PH', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Poland', 'Europe', 'PL', ['#FFFFFF', '#DC143C', '#FFFFFF']],
  ['Portugal', 'Europe', 'PT', ['#046A38', '#DA291C', '#FFE900']],
  ['Puerto Rico', 'Latin America', 'PR', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Qatar', 'Middle East', 'QA', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Romania', 'Europe', 'RO', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Russia', 'Europe', 'RU', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Rwanda', 'Africa', 'RW', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Saint Kitts and Nevis', 'Latin America', 'KN', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Saint Lucia', 'Latin America', 'LC', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Saint Vincent and the Grenadines', 'Latin America', 'VC', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Samoa', 'Oceania', 'WS', ['#0C2038', '#1B3554', '#2A4A70']],
  ['San Marino', 'Europe', 'SM', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Sao Tome and Principe', 'Africa', 'ST', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Saudi Arabia', 'Middle East', 'SA', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Senegal', 'Africa', 'SN', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Serbia', 'Europe', 'RS', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Seychelles', 'Africa', 'SC', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Sierra Leone', 'Africa', 'SL', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Singapore', 'Asia', 'SG', ['#EF3340', '#FFFFFF', '#EF3340']],
  ['Slovakia', 'Europe', 'SK', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Slovenia', 'Europe', 'SI', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Solomon Islands', 'Oceania', 'SB', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Somalia', 'Africa', 'SO', ['#0C2038', '#1B3554', '#2A4A70']],
  ['South Africa', 'Africa', 'ZA', ['#0C2038', '#1B3554', '#2A4A70']],
  ['South Korea', 'Asia', 'KR', ['#FFFFFF', '#CD2E3A', '#0047A0']],
  ['South Sudan', 'Africa', 'SS', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Spain', 'Europe', 'ES', ['#AA151B', '#F1BF00', '#AA151B']],
  ['Sri Lanka', 'Asia', 'LK', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Sudan', 'Africa', 'SD', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Suriname', 'Latin America', 'SR', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Sweden', 'Europe', 'SE', ['#006AA7', '#FECC00', '#006AA7']],
  ['Switzerland', 'Europe', 'CH', ['#DA291C', '#FFFFFF', '#DA291C']],
  ['Syria', 'Middle East', 'SY', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Taiwan', 'Asia', 'TW', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Tajikistan', 'Asia', 'TJ', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Tanzania', 'Africa', 'TZ', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Thailand', 'Asia', 'TH', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Timor-Leste', 'Asia', 'TL', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Togo', 'Africa', 'TG', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Tonga', 'Oceania', 'TO', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Trinidad and Tobago', 'Latin America', 'TT', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Tunisia', 'Africa', 'TN', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Turkey', 'Middle East', 'TR', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Turkmenistan', 'Asia', 'TM', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Tuvalu', 'Oceania', 'TV', ['#0C2038', '#1B3554', '#2A4A70']],
  ['UK', 'Europe', 'GB', ['#012169', '#C8102E', '#FFFFFF']],
  ['USA', 'North America', 'US', ['#3C3B6E', '#B22234', '#FFFFFF']],
  ['Uganda', 'Africa', 'UG', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Ukraine', 'Europe', 'UA', ['#0C2038', '#1B3554', '#2A4A70']],
  ['United Arab Emirates', 'Middle East', 'AE', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Uruguay', 'Latin America', 'UY', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Uzbekistan', 'Asia', 'UZ', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Vanuatu', 'Oceania', 'VU', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Vatican City', 'Europe', 'VA', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Venezuela', 'Latin America', 'VE', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Vietnam', 'Asia', 'VN', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Yemen', 'Middle East', 'YE', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Zambia', 'Africa', 'ZM', ['#0C2038', '#1B3554', '#2A4A70']],
  ['Zimbabwe', 'Africa', 'ZW', ['#0C2038', '#1B3554', '#2A4A70']],
];

export type DirectoryDestination = {
  name: string;
  region: DirectoryRegion;
  iso2Code: string;
  /* The three-band flag accent the design uses in place of a flag image: no
   * asset to host, no licence to check, and it renders identically offline. */
  bands: readonly [string, string, string];
};

/** Every destination, minus the ones already published under a Country record. */
export function comingSoonDestinations(
  publishedNames: Iterable<string>,
): DirectoryDestination[] {
  const taken = new Set(
    [...publishedNames].map((name) => name.trim().toLowerCase()),
  );
  return WORLD.filter(([name]) => !taken.has(name.toLowerCase())).map(
    ([name, region, iso2Code, bands]) => ({ name, region, iso2Code, bands }),
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

export function regionForContinent(name: string | null | undefined): DirectoryRegion | null {
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
export function bandsFor(
  name: string,
  iso2Code?: string | null,
): readonly [string, string, string] | null {
  const needle = name.trim().toLowerCase();
  const code = iso2Code?.trim().toUpperCase();
  const hit =
    WORLD.find(([entry]) => entry.toLowerCase() === needle) ??
    (code ? WORLD.find(([, , entry]) => entry === code) : undefined);
  return hit ? hit[3] : null;
}
