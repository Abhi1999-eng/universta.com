const allowedTags = new Set([
  'p',
  'h2',
  'h3',
  'h4',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'strike',
  'ul',
  'ol',
  'li',
  'a',
  'blockquote',
  'hr',
  'br',
  'img',
]);
const escape = (value: string) =>
  value.replace(
    /[&"<>]/g,
    (char) =>
      ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' })[char] ?? char,
  );
const safeHref = (value: string) =>
  /^https:\/\//i.test(value) ||
  /^\/(?!\/)/.test(value) ||
  /^#[a-zA-Z0-9_-]+$/.test(value);
const safeImage = (value: string) =>
  /^https:\/\//i.test(value) ||
  /^\/api\/v1\/media\//.test(value) ||
  /^\/media\//.test(value);

/** Portable allowlisted HTML emitted by the shared Admin WYSIWYG. */
export function sanitizeRichText(value: unknown) {
  if (typeof value !== 'string') return value;
  return value
    .replace(/<(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<\/?[^>]+>/g, (tag) => {
      const match = tag.match(/^<\s*(\/?)\s*([a-z0-9]+)/i);
      if (!match || !allowedTags.has(match[2].toLowerCase())) return '';
      const closing = match[1] === '/';
      const name = match[2].toLowerCase();
      if (closing || !['a', 'img'].includes(name))
        return `<${closing ? '/' : ''}${name}>`;
      if (name === 'a') {
        const href = tag.match(/\shref\s*=\s*["']([^"']+)["']/i)?.[1] ?? '';
        return safeHref(href)
          ? `<a href="${escape(href)}" rel="noopener noreferrer">`
          : '<a>';
      }
      const src = tag.match(/\ssrc\s*=\s*["']([^"']+)["']/i)?.[1] ?? '';
      const alt = tag.match(/\salt\s*=\s*["']([^"']*)["']/i)?.[1] ?? '';
      return safeImage(src)
        ? `<img src="${escape(src)}" alt="${escape(alt)}">`
        : '';
    });
}
