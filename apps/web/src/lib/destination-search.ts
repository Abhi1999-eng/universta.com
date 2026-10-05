import type { Destination } from './study-abroad';
import { foldWords, matchesSubject } from './subject-search';

/**
 * How the destination directory answers what somebody types, and which
 * destinations it opens on.
 *
 * The search follows the behaviour reference's own box: every word typed has
 * to begin a word of the destination, in any order. Matching anywhere inside
 * the name answered "uni" with Tunisia and "uk" with Ukraine alone, and
 * nothing at all for "usa" -- because nobody writes "United Kingdom" when
 * they mean the UK. So a destination is also found by its ISO code and by
 * the few short names people actually type for it.
 */

/**
 * Short names a reader types for a country that its own name does not start
 * with. Keyed on the ISO code, so a renamed record keeps its aliases. Search
 * terms only: nothing here is shown on the page.
 */
const ALIASES: Readonly<Record<string, readonly string[]>> = {
  GB: ['uk', 'britain', 'great britain'],
  US: ['usa', 'america'],
  AE: ['uae'],
};

/** Everything a destination can be found by: its name, its code, its aliases. */
export function destinationTerms(
  entry: Pick<Destination, 'name' | 'iso2Code'>,
): string {
  const code = entry.iso2Code?.trim().toUpperCase() ?? '';
  return [entry.name, code, ...(ALIASES[code] ?? [])].join(' ');
}

/** Whether a destination answers what was typed. An empty box matches all. */
export function matchesDestination(
  entry: Pick<Destination, 'name' | 'iso2Code'>,
  query: string,
): boolean {
  return matchesSubject(destinationTerms(entry), query);
}

/**
 * The destination Enter should open, or null when the box does not point at
 * one.
 *
 * The reference opens the only match. When several remain, one of them can
 * still be what was meant -- "uk" leaves Ukraine beside the United Kingdom,
 * "india" may leave a territory with India in its name -- so a match whose
 * whole name, code or alias is exactly what was typed opens too, provided it
 * is the only such match. A destination without a guide has nowhere to go.
 */
export function destinationToOpen(
  matches: readonly Destination[],
  query: string,
): Destination | null {
  const typed = foldWords(query).join(' ');
  if (!typed) return null;
  const linkable = matches.filter((entry) => entry.slug);
  if (matches.length === 1) return linkable[0] ?? null;
  const exact = linkable.filter((entry) => {
    const code = entry.iso2Code?.trim().toUpperCase() ?? '';
    return [entry.name, code, ...(ALIASES[code] ?? [])].some(
      (term) => term && foldWords(term).join(' ') === typed,
    );
  });
  return exact.length === 1 ? exact[0] : null;
}

/** How many destinations the "Popular destinations" row holds. */
export const POPULAR_SHOWN = 12;

/**
 * The destinations the directory opens on, before the alphabetical run by
 * region.
 *
 * An editor marks a destination popular; the catalogue carries no order
 * among the ones marked. The row puts those with the most published on
 * Universta -- universities and courses -- first, so the first card a reader
 * opens is the one with the most behind it, and the names break a tie.
 */
export function popularDestinations(
  entries: readonly Destination[],
  limit = POPULAR_SHOWN,
): Destination[] {
  const depth = (entry: Destination) =>
    entry.counts.universities + entry.counts.courses;
  return entries
    .filter((entry) => entry.isPopular && entry.slug)
    .sort(
      (left, right) =>
        depth(right) - depth(left) || left.name.localeCompare(right.name),
    )
    .slice(0, limit);
}

/** A region as the address carries it: "North America" is `north-america`. */
export function regionKey(region: string): string {
  return region
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * The region an address asks for, as the directory names it, or "all" when
 * it asks for none the directory knows. Either form is read: `?region=asia`
 * and `?region=Asia` are the same request.
 */
export function regionFromParam(
  value: string | null | undefined,
  regions: readonly string[],
): string {
  if (!value) return 'all';
  const key = regionKey(value);
  return regions.find((region) => regionKey(region) === key) ?? 'all';
}
