/**
 * "Study in United Kingdom" is not a sentence anybody writes.
 *
 * A handful of country names are grammatically plural or descriptive and take
 * the definite article: the United Kingdom, the Netherlands, the Philippines.
 * Every other name does not, and putting "the" in front of Germany is just as
 * wrong in the other direction -- so this is a list rather than a rule.
 *
 * Matched on the ISO code where there is one, because the catalogue and an
 * editor may not spell the name the same way, with the name as the fallback.
 */
const TAKES_THE = new Set([
  'GB', // United Kingdom
  'US', // United States
  'NL', // Netherlands
  'PH', // Philippines
  'AE', // United Arab Emirates
  'CZ', // Czech Republic
  'DO', // Dominican Republic
  'BS', // Bahamas
  'MV', // Maldives
  'GM', // Gambia
  'CF', // Central African Republic
  'CD', // Democratic Republic of the Congo
  'CG', // Republic of the Congo
  'SD', // Sudan
  'VA', // Vatican / Holy See
  'KM', // Comoros
  'MH', // Marshall Islands
  'SB', // Solomon Islands
  'SC', // Seychelles
]);

/** Names that take it whatever code they arrive under, or arrive without one. */
const NAME_TAKES_THE = /^(the\s)|^(united (kingdom|states|arab emirates))$|^(netherlands|philippines|bahamas|maldives|gambia|comoros|seychelles|sudan|czech republic|dominican republic|ivory coast|solomon islands|marshall islands)$/i;

/**
 * The country's name as it reads inside a sentence: "in the United Kingdom",
 * "in Germany". A name that already starts with "the" is left alone.
 */
export function inCountry(
  name: string,
  iso2Code?: string | null,
): string {
  const trimmed = name.trim();
  if (/^the\s/i.test(trimmed)) return trimmed;
  const byCode = iso2Code ? TAKES_THE.has(iso2Code.trim().toUpperCase()) : false;
  return byCode || NAME_TAKES_THE.test(trimmed) ? `the ${trimmed}` : trimmed;
}
