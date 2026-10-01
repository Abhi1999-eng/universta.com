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

/** The band around a switcher that holds only a chip or two.
 *
 * The full furniture -- a three-line display title, a sticky aside, a lead
 * in its own column and 64px under all of it -- is built for a section with
 * something in it. Around one chip it is mostly air, and the band reads as
 * a page that failed to load rather than a short list. */
export function sparseBandClass(count: number): string {
  return count < SWITCHER_COLUMNS ? ' sec--sparse' : '';
}
