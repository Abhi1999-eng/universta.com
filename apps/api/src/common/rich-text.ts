const allowedTags = new Set([
  'p',
  'h2',
  'h3',
  'h4',
  'strong',
  'b',
  'em',
  'i',
  'ul',
  'ol',
  'li',
  'a',
  'blockquote',
  'hr',
  'br',
]);

/** A deliberately small HTML subset emitted by the Admin editor. */
export function sanitizeRichText(value: unknown) {
  if (typeof value !== 'string') return value;
  return value.replace(/<\/?[^>]+>/g, (tag) => {
    const match = tag.match(/^<\s*(\/?)\s*([a-z0-9]+)/i);
    if (!match || !allowedTags.has(match[2].toLowerCase())) return '';
    const closing = match[1] === '/';
    const name = match[2].toLowerCase();
    if (closing || name !== 'a') return `<${closing ? '/' : ''}${name}>`;
    const href = tag.match(/\shref\s*=\s*["']([^"']+)["']/i)?.[1] ?? '';
    return /^https?:\/\//i.test(href)
      ? `<a href="${href.replace(/"/g, '')}" rel="noopener noreferrer">`
      : '<a>';
  });
}
