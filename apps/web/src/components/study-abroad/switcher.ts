/**
 * The chip grid shared by the destination switchers.
 *
 * It lays chips into up to three equal tracks, which reads well at a
 * hundred and badly at one: a lone chip was stretched across a third of the
 * band with two empty columns beside it, so the section looked like
 * something that had failed to load rather than a destination list with one
 * entry in it. Below the column count the chips keep their own width and
 * pack to the start instead.
 */
export const SWITCHER_COLUMNS = 3;

export function switcherClass(count: number): string {
  return count < SWITCHER_COLUMNS ? 'switcher switcher--few' : 'switcher';
}

/** A destination as the subject and specialization records send it: with
 *  how many published programmes it teaches there, where that is known. */
export type CountedDestination = {
  id: string;
  name: string;
  slug: string;
  iso2Code?: string | null;
  courseCount?: number | null;
};

/**
 * The places that teach it first, most programmes first.
 *
 * The API already sends them in this order; this keeps the page right
 * against a record that predates the counts (which then arrives as it always
 * did) and against one that does not. The sort is stable, so countries with
 * the same count keep the order they came in -- the catalogue's.
 */
export function rankDestinations<T extends CountedDestination>(
  countries: readonly T[],
): T[] {
  return [...countries].sort(
    (a, b) => (b.courseCount ?? 0) - (a.courseCount ?? 0),
  );
}

/** The ones with a programme behind them. */
export function teachingDestinations<T extends CountedDestination>(
  countries: readonly T[],
): T[] {
  return countries.filter((country) => (country.courseCount ?? 0) > 0);
}

/** "1 programme", "6 programmes". */
export function programmeCount(count: number): string {
  return `${count} ${count === 1 ? 'programme' : 'programmes'}`;
}

/**
 * What a destinations band says about its chips: how many of them teach it,
 * since the rest list it with nothing behind it yet. `open` is the band's
 * own invitation, and `legacy` is the sentence it had before -- what a
 * record sent without counts still gets, rather than a claim it cannot back.
 */
export function destinationsLead({
  name,
  countries,
  open,
  legacy,
}: {
  name: string;
  countries: readonly CountedDestination[];
  open: string;
  legacy: string;
}): string {
  if (!countries.some((country) => country.courseCount != null)) return legacy;
  const teaching = teachingDestinations(countries).length;
  if (!teaching) return `No destination has a ${name} programme published yet. ${open}`;
  const rest = countries.length - teaching;
  return [
    `${teaching} ${teaching === 1 ? 'destination teaches' : 'destinations teach'} ${name}, and they come first, most programmes first.`,
    rest ? `${rest} more list it with no programme published yet.` : null,
    open,
  ]
    .filter(Boolean)
    .join(' ');
}

/** The band around a switcher that holds only a chip or two.
 *
 * The full furniture -- a three-line display title, a sticky aside, a lead
 * in its own column and 64px under all of it -- is built for a section with
 * something in it. Around one chip it is mostly air, and the band reads as
 * a page that failed to load rather than a short list. */
export function sparseBandClass(count: number): string {
  return count < SWITCHER_COLUMNS ? ' sec--sparse' : '';
}
