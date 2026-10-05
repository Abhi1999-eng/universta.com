/**
 * The letters in a university's monogram.
 *
 * The first letter of the first two words gave "UO" to Oxford, Cambridge,
 * Edinburgh and Manchester alike, so a row of four cards carried four
 * identical marks. Most names open with the same few words -- University,
 * College, Institute, of, the -- and those say nothing about which one it
 * is, so they are passed over and the letters come from the words that do.
 *
 *   University of Oxford                          -> OXF
 *   London School of Economics and Political ...  -> LSE
 *   Indian Institute of Technology Delhi          -> ITD
 *
 * One telling word gives its opening three letters; several give the first
 * letter of up to three of them. A name made of nothing but those common
 * words keeps the old rule, so it still gets a mark.
 */
const COMMON = new Set([
  'university',
  'universität',
  'universitat',
  'université',
  'universite',
  'universidad',
  'universidade',
  'università',
  'universita',
  'universiteit',
  'universitet',
  'universitas',
  'college',
  'institute',
  'of',
  'the',
  'and',
  'for',
  'at',
  'in',
  'de',
  'del',
  'des',
  'di',
  'du',
  'la',
  'le',
  'der',
  'die',
  'das',
  'und',
  'y',
  '&',
]);

const words = (name: string) =>
  name
    .split(/[\s\-–—/,()]+/)
    .map((word) => word.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, ''))
    .filter((word) => /^\p{L}/u.test(word));

/** The opening letters of one word, passing over a letter that repeats the
 * one before it: Aalborg is ALB and Aalto ALT, where a plain first three
 * would have given both AAL, side by side in an A-Z list. */
function opening(word: string) {
  const letters = [...word.replace(/[^\p{L}]/gu, '').toUpperCase()];
  const kept: string[] = [];
  for (const letter of letters) {
    if (kept.length === 3) break;
    if (kept.length && kept[kept.length - 1] === letter) continue;
    kept.push(letter);
  }
  return kept.join('');
}

export function universityInitials(name: string): string {
  const all = words(name);
  const telling = all.filter((word) => !COMMON.has(word.toLowerCase()));
  if (telling.length === 1) return opening(telling[0]!);
  if (telling.length > 1)
    return telling
      .slice(0, 3)
      .map((word) => word[0]!.toUpperCase())
      .join('');
  return (
    all
      .slice(0, 2)
      .map((word) => word[0]!.toUpperCase())
      .join('') || name.trim().slice(0, 2).toUpperCase()
  );
}
