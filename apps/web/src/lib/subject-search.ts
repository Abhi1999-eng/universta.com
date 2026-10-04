/**
 * Whether a subject's name answers what somebody typed in the search box.
 *
 * The rule is the one applicationabroad.com uses for the same box, because
 * that site is the reference for how this one behaves: every word typed has
 * to begin a word of the name, in any order, and punctuation and case count
 * for nothing.
 *
 * That is deliberately not "the typed text appears somewhere in the name",
 * which is what this box did before. Substring matching answers "ing" with
 * six subjects that merely end in it and answers "oil gas" with none,
 * because the name says "Oil & Gas". Matching on the starts of words finds
 * Energy, Oil & Gas for "gas oil" and nothing for "ing" -- which is how a
 * person looking for a subject actually types.
 */

/** "Energy, Oil & Gas" -> ["energy", "oil", "gas"]. */
export function foldWords(value: string): string[] {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export function matchesSubject(name: string, query: string): boolean {
  const typed = foldWords(query);
  if (typed.length === 0) return true;
  const words = foldWords(name);
  return typed.every((part) => words.some((word) => word.startsWith(part)));
}
