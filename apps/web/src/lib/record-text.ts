import { richTextToPlainText } from '@/components/phase1/RichText';
import { resolveContentVariables, type ContentVariableContext } from '../../../../packages/content-variables';

/**
 * A record's own words as plain text: the rich-text editor's tags taken out,
 * the entities it writes (`&amp;`, `&nbsp;`) read back as the characters
 * they stand for, and any content variable the field offers -- `{eventTitle}`,
 * `{universityName}` -- filled in from the record, as its own page does.
 *
 * Shared by the cards, the search descriptions and the Website Builder
 * sections, so a summary reads the same wherever it is printed.
 */

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…' };

function decodeEntities(value: string) {
  return value.replace(/&(?:#(\d{1,7})|#x([0-9a-f]{1,6})|([a-z]+));/gi, (entity, dec, hex, name) => {
    if (name) return ENTITIES[name.toLowerCase()] ?? entity;
    const code = dec ? Number(dec) : parseInt(hex, 16);
    return code > 0 && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff) ? String.fromCodePoint(code) : entity;
  });
}

/** The value as one line of plain text, or null when it says nothing --
 *  an empty editor saves `<p><br></p>`, which is not a story. */
export function plainText(
  value: unknown,
  context?: ContentVariableContext,
  source?: Record<string, unknown>,
): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const resolved = context ? resolveContentVariables(context, value, source ?? {}) : value;
  const words = decodeEntities(/<\/?[a-z][^>]*>/i.test(resolved) ? richTextToPlainText(resolved) : resolved)
    .replace(/\s+/g, ' ')
    .trim();
  return words || null;
}

/** About `length` characters of the text, cut at a word where one is near
 *  and closed with an ellipsis; text that fits is returned whole. */
export function excerpt(value: string, length = 155): string {
  if (value.length <= length) return value;
  const cut = value.slice(0, length - 1);
  const space = cut.lastIndexOf(' ');
  const words = space > length * 0.6 ? cut.slice(0, space) : cut;
  return `${words.replace(/[\s,;:.–—-]+$/, '')}…`;
}

/** Plain text cut to an excerpt, in one step. */
export function plainExcerpt(
  value: unknown,
  length = 155,
  context?: ContentVariableContext,
  source?: Record<string, unknown>,
): string | null {
  const words = plainText(value, context, source);
  return words ? excerpt(words, length) : null;
}
