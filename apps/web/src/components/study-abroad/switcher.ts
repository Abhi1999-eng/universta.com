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
