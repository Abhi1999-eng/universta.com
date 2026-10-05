/**
 * Study levels in the order a student climbs them.
 *
 * The public course-levels list is already in that order (Foundation,
 * Pathway, Diploma, Bachelor's ... PhD), so it is the key: a page hands its
 * codes in, and any list of levels is put into the same order. Without it a
 * bar built by merging each subject's levels kept whichever it met first,
 * and the subjects page opened on "PhD, Bachelor's, Master's".
 *
 * A level the key does not know keeps its place after the known ones, in the
 * order it came, rather than being dropped.
 */
export function sortByLevelOrder<T extends { code?: string | null }>(
  levels: readonly T[],
  order: readonly string[],
): T[] {
  if (!order.length) return [...levels];
  const rank = new Map(order.map((code, index) => [code.toUpperCase(), index]));
  const at = (level: T) =>
    rank.get(String(level.code ?? '').toUpperCase()) ?? order.length;
  return [...levels].sort((a, b) => at(a) - at(b));
}

/** The distinct levels across several lists, in climbing order. */
export function mergeLevels<T extends { code?: string | null }>(
  lists: ReadonlyArray<readonly T[] | null | undefined>,
  order: readonly string[],
  key: (level: T) => string = (level) => String(level.code ?? ''),
): T[] {
  const seen = new Map<string, T>();
  for (const list of lists)
    for (const level of list ?? [])
      if (!seen.has(key(level))) seen.set(key(level), level);
  return sortByLevelOrder([...seen.values()], order);
}
