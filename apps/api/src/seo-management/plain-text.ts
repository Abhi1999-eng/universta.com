/**
 * Rich text as a reader would say it aloud: tags gone, entities decoded,
 * runs of whitespace closed up. An emptied editor leaves "<p><br></p>",
 * which reads as nothing here.
 */
export function htmlToPlainText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return (
    value
      .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>/gi, ' ')
      /* A block ends a sentence's line; an inline tag sits inside a word. */
      .replace(
        /<\/?(p|div|li|ul|ol|h[1-6]|blockquote|tr|td|th|table|section|article)\b[^>]*>/gi,
        ' ',
      )
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#0*39;|&apos;/gi, "'")
      .replace(/&#(\d+);/g, (_, code: string) =>
        Number(code) <= 0x10ffff ? String.fromCodePoint(Number(code)) : ' ',
      )
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * The opening of a text, short enough for a search result's description:
 * whole words up to about `max` characters, with an ellipsis when cut.
 */
export function plainExcerpt(value: unknown, max = 160): string | null {
  const text = htmlToPlainText(value);
  if (!text) return null;
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  const words = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${words.replace(/[\s,;:.–—-]+$/, '')}…`;
}
