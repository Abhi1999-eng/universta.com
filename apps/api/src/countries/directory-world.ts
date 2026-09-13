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

const WORLD: ReadonlyArray<readonly [string, DirectoryRegion]> = [
  ['Afghanistan', 'Asia'],
  ['Albania', 'Europe'],
  ['Algeria', 'Africa'],
  ['Andorra', 'Europe'],
  ['Angola', 'Africa'],
  ['Antigua And Barbuda', 'Latin America'],
  ['Argentina', 'Latin America'],
  ['Armenia', 'Middle East'],
  ['Aruba', 'Latin America'],
  ['Australia', 'Oceania'],
  ['Austria', 'Europe'],
  ['Azerbaijan', 'Middle East'],
  ['Bahamas', 'Latin America'],
  ['Bahrain', 'Middle East'],
  ['Bangladesh', 'Asia'],
  ['Barbados', 'Latin America'],
  ['Belarus', 'Europe'],
  ['Belgium', 'Europe'],
  ['Belize', 'Latin America'],
  ['Benin', 'Africa'],
  ['Bermuda', 'Latin America'],
  ['Bhutan', 'Asia'],
  ['Bolivia', 'Latin America'],
  ['Bosnia And Herzegovina', 'Europe'],
  ['Botswana', 'Africa'],
  ['Brazil', 'Latin America'],
  ['Brunei', 'Asia'],
  ['Bulgaria', 'Europe'],
  ['Burkina Faso', 'Africa'],
  ['Burundi', 'Africa'],
  ['Cabo Verde', 'Africa'],
  ['Cambodia', 'Asia'],
  ['Cameroon', 'Africa'],
  ['Canada', 'North America'],
  ['Cayman Islands', 'Latin America'],
  ['Central African Republic', 'Africa'],
  ['Chad', 'Africa'],
  ['Chile', 'Latin America'],
  ['China', 'Asia'],
  ['Colombia', 'Latin America'],
  ['Comoros', 'Africa'],
  ['Congo', 'Africa'],
  ['Costa Rica', 'Latin America'],
  ['Croatia', 'Europe'],
  ['Cuba', 'Latin America'],
  ['Curacao', 'Latin America'],
  ['Cyprus', 'Europe'],
  ['Czechia', 'Europe'],
  ['Denmark', 'Europe'],
  ['Djibouti', 'Africa'],
  ['Dominica', 'Latin America'],
  ['Dominican Republic', 'Latin America'],
  ['Dr Congo', 'Africa'],
  ['Ecuador', 'Latin America'],
  ['Egypt', 'Africa'],
  ['El Salvador', 'Latin America'],
  ['Equatorial Guinea', 'Africa'],
  ['Eritrea', 'Africa'],
  ['Estonia', 'Europe'],
  ['Eswatini', 'Africa'],
  ['Ethiopia', 'Africa'],
  ['Fiji', 'Oceania'],
  ['Finland', 'Europe'],
  ['France', 'Europe'],
  ['Gabon', 'Africa'],
  ['Gambia', 'Africa'],
  ['Georgia', 'Middle East'],
  ['Germany', 'Europe'],
  ['Ghana', 'Africa'],
  ['Greece', 'Europe'],
  ['Greenland', 'Europe'],
  ['Grenada', 'Latin America'],
  ['Guatemala', 'Latin America'],
  ['Guinea', 'Africa'],
  ['Guinea-Bissau', 'Africa'],
  ['Guyana', 'Latin America'],
  ['Haiti', 'Latin America'],
  ['Honduras', 'Latin America'],
  ['Hong Kong', 'Asia'],
  ['Hungary', 'Europe'],
  ['Iceland', 'Europe'],
  ['India', 'Asia'],
  ['Indonesia', 'Asia'],
  ['Iran', 'Middle East'],
  ['Iraq', 'Middle East'],
  ['Ireland', 'Europe'],
  ['Israel', 'Middle East'],
  ['Italy', 'Europe'],
  ['Ivory Coast', 'Africa'],
  ['Jamaica', 'Latin America'],
  ['Japan', 'Asia'],
  ['Jordan', 'Middle East'],
  ['Kazakhstan', 'Asia'],
  ['Kenya', 'Africa'],
  ['Kiribati', 'Oceania'],
  ['Kosovo', 'Europe'],
  ['Kuwait', 'Middle East'],
  ['Kyrgyzstan', 'Asia'],
  ['Laos', 'Asia'],
  ['Latvia', 'Europe'],
  ['Lebanon', 'Middle East'],
  ['Lesotho', 'Africa'],
  ['Liberia', 'Africa'],
  ['Libya', 'Africa'],
  ['Liechtenstein', 'Europe'],
  ['Lithuania', 'Europe'],
  ['Luxembourg', 'Europe'],
  ['Macau', 'Asia'],
  ['Madagascar', 'Africa'],
  ['Malawi', 'Africa'],
  ['Malaysia', 'Asia'],
  ['Maldives', 'Asia'],
  ['Mali', 'Africa'],
  ['Malta', 'Europe'],
  ['Marshall Islands', 'Oceania'],
  ['Mauritania', 'Africa'],
  ['Mauritius', 'Africa'],
  ['Mexico', 'Latin America'],
  ['Micronesia', 'Oceania'],
  ['Moldova', 'Europe'],
  ['Monaco', 'Europe'],
  ['Mongolia', 'Asia'],
  ['Montenegro', 'Europe'],
  ['Morocco', 'Africa'],
  ['Mozambique', 'Africa'],
  ['Myanmar', 'Asia'],
  ['Namibia', 'Africa'],
  ['Nauru', 'Oceania'],
  ['Nepal', 'Asia'],
  ['Netherlands', 'Europe'],
  ['New Caledonia', 'Oceania'],
  ['New Zealand', 'Oceania'],
  ['Nicaragua', 'Latin America'],
  ['Niger', 'Africa'],
  ['Nigeria', 'Africa'],
  ['North Korea', 'Asia'],
  ['North Macedonia', 'Europe'],
  ['Norway', 'Europe'],
  ['Oman', 'Middle East'],
  ['Pakistan', 'Asia'],
  ['Palau', 'Oceania'],
  ['Palestine', 'Middle East'],
  ['Panama', 'Latin America'],
  ['Papua New Guinea', 'Oceania'],
  ['Paraguay', 'Latin America'],
  ['Peru', 'Latin America'],
  ['Philippines', 'Asia'],
  ['Poland', 'Europe'],
  ['Portugal', 'Europe'],
  ['Puerto Rico', 'Latin America'],
  ['Qatar', 'Middle East'],
  ['Romania', 'Europe'],
  ['Russia', 'Europe'],
  ['Rwanda', 'Africa'],
  ['Saint Kitts And Nevis', 'Latin America'],
  ['Saint Lucia', 'Latin America'],
  ['Saint Vincent And The Grenadines', 'Latin America'],
  ['Samoa', 'Oceania'],
  ['San Marino', 'Europe'],
  ['Sao Tome And Principe', 'Africa'],
  ['Saudi Arabia', 'Middle East'],
  ['Senegal', 'Africa'],
  ['Serbia', 'Europe'],
  ['Seychelles', 'Africa'],
  ['Sierra Leone', 'Africa'],
  ['Singapore', 'Asia'],
  ['Slovakia', 'Europe'],
  ['Slovenia', 'Europe'],
  ['Solomon Islands', 'Oceania'],
  ['Somalia', 'Africa'],
  ['South Africa', 'Africa'],
  ['South Korea', 'Asia'],
  ['South Sudan', 'Africa'],
  ['Spain', 'Europe'],
  ['Sri Lanka', 'Asia'],
  ['Sudan', 'Africa'],
  ['Suriname', 'Latin America'],
  ['Sweden', 'Europe'],
  ['Switzerland', 'Europe'],
  ['Syria', 'Middle East'],
  ['Taiwan', 'Asia'],
  ['Tajikistan', 'Asia'],
  ['Tanzania', 'Africa'],
  ['Thailand', 'Asia'],
  ['Timor-Leste', 'Asia'],
  ['Togo', 'Africa'],
  ['Tonga', 'Oceania'],
  ['Trinidad And Tobago', 'Latin America'],
  ['Tunisia', 'Africa'],
  ['Turkey', 'Middle East'],
  ['Turkmenistan', 'Asia'],
  ['Tuvalu', 'Oceania'],
  ['Uganda', 'Africa'],
  ['Uk', 'Europe'],
  ['Ukraine', 'Europe'],
  ['United Arab Emirates', 'Middle East'],
  ['Uruguay', 'Latin America'],
  ['Usa', 'North America'],
  ['Uzbekistan', 'Asia'],
  ['Vanuatu', 'Oceania'],
  ['Vatican City', 'Europe'],
  ['Venezuela', 'Latin America'],
  ['Vietnam', 'Asia'],
  ['Yemen', 'Middle East'],
  ['Zambia', 'Africa'],
  ['Zimbabwe', 'Africa'],
];

export type DirectoryDestination = {
  name: string;
  region: DirectoryRegion;
};

/** Every destination, minus the ones already published under a Country record. */
export function comingSoonDestinations(
  publishedNames: Iterable<string>,
): DirectoryDestination[] {
  const taken = new Set(
    [...publishedNames].map((name) => name.trim().toLowerCase()),
  );
  return WORLD.filter(([name]) => !taken.has(name.toLowerCase())).map(
    ([name, region]) => ({ name, region }),
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
