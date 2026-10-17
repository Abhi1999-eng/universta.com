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
const alignedBlockTags = new Set(['p', 'h2', 'h3', 'h4', 'blockquote']);
/* An apostrophe too: the site's renderer reads a value to the first quote
   of either kind, so a bare one cut "Tom's" short there; `&#39;` reads the
   same to a browser. */
const escape = (value: string) =>
  value.replace(
    /[&"'<>]/g,
    (char) =>
      ({
        '&': '&amp;',
        '"': '&quot;',
        "'": '&#39;',
        '<': '&lt;',
        '>': '&gt;',
      })[char] ?? char,
  );
/* A leading slash makes a link internal only when a second one does not
   follow it: a browser reads `/\` as `//` too, the start of another host. */
const safeHref = (value: string) =>
  /^https:\/\//i.test(value) ||
  /^\/(?![/\\])/.test(value) ||
  /^#[a-zA-Z0-9_-]+$/.test(value);
const safeImage = (value: string) =>
  /^https:\/\//i.test(value) ||
  /^\/api\/v1\/media\//.test(value) ||
  /^\/media\//.test(value);

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
};

/**
 * An attribute value as the browser reads it, so it is checked as that and
 * written back escaped once. The editor hands its links over already
 * escaped -- `?a=1&amp;b=2` -- and escaping that again stored
 * `?a=1&amp;amp;b=2`, one more layer on every save, which sent an image to
 * the wrong address. Decoded first, a second pass over saved content
 * changes nothing.
 *
 * One pass, so `&amp;lt;` stays the text `&lt;`; an entity it does not know
 * is left as written and escaped on the way out, so it reaches the page as
 * the text it is, never as a character the check did not see. A code point
 * no browser accepts is left as text the same way. The same rule as the
 * site's renderer (apps/web RichText `attributeValue`).
 */
function attributeValue(raw: string) {
  const decoded = raw.replace(
    /&(?:#(\d{1,7})|#x([0-9a-f]{1,6})|([a-z]+));/gi,
    (entity, dec: string, hex: string, name: string) => {
      if (name) return NAMED_ENTITIES[name.toLowerCase()] ?? entity;
      const code = dec ? Number(dec) : parseInt(hex, 16);
      return code > 0 && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff)
        ? String.fromCodePoint(code)
        : entity;
    },
  );
  /* As the address parser reads it: tabs and line breaks anywhere are
     dropped, and so are control characters and spaces at either end.
     Decoding can bring them out -- `/&#9;/host` is `//host` to a browser --
     so they go before the check, not after it. */
  const kept = decoded.replace(/[\t\n\r]/g, '');
  let start = 0;
  let end = kept.length;
  while (start < end && kept.charCodeAt(start) <= 0x20) start += 1;
  while (end > start && kept.charCodeAt(end - 1) <= 0x20) end -= 1;
  return kept.slice(start, end);
}

const ATTRIBUTES = {
  href: /\shref\s*=\s*(?:"([^"]*)"|'([^']*)')/i,
  src: /\ssrc\s*=\s*(?:"([^"]*)"|'([^']*)')/i,
  alt: /\salt\s*=\s*(?:"([^"]*)"|'([^']*)')/i,
};

/** A quoted attribute's value, decoded: read to the quote that opened it,
 *  so an apostrophe inside double quotes no longer cuts it short. */
function attribute(tag: string, name: keyof typeof ATTRIBUTES) {
  const match = tag.match(ATTRIBUTES[name]);
  return attributeValue(match?.[1] ?? match?.[2] ?? '');
}

/** Portable allowlisted HTML emitted by the shared Admin WYSIWYG. */
export function sanitizeRichText(value: unknown) {
  if (typeof value !== 'string') return value;
  /* Every tag kept is rebuilt from scratch below -- only `style`
     text-align, a checked `href` or `src` and an `alt` are copied across,
     decoded, checked as decoded and escaped once, so no `on...` handler
     ever survives and an address spelled in entities is checked as the
     browser reads it -- and so holds no "<" or ">" of its own. The tag
     pass only sees a tag closed with ">", though: one left open at the
     end, '<p>Intro</p><img src=x onerror="alert(1)"', came through as
     written and a browser read it as an <img> with its handler. Any "<"
     that does not start a kept tag is text, and is escaped as text. */
  return value
    .replace(/<(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<\/?[^>]+>/g, (tag) => {
      const match = tag.match(/^<\s*(\/?)\s*([a-z0-9]+)/i);
      if (!match || !allowedTags.has(match[2].toLowerCase())) return '';
      const closing = match[1] === '/';
      const name = match[2].toLowerCase();
      if (closing) return `</${name}>`;
      if (alignedBlockTags.has(name)) {
        const alignment = safeAlignment(tag);
        return alignment
          ? `<${name} style="text-align: ${alignment}">`
          : `<${name}>`;
      }
      if (!['a', 'img'].includes(name)) return `<${name}>`;
      if (name === 'a') {
        const href = attribute(tag, 'href');
        return safeHref(href)
          ? `<a href="${escape(href)}" rel="noopener noreferrer">`
          : '<a>';
      }
      const src = attribute(tag, 'src');
      const alt = attribute(tag, 'alt');
      return safeImage(src)
        ? `<img src="${escape(src)}" alt="${escape(alt)}">`
        : '';
    })
    .replace(/<(?![a-z/][^<>]*>)/gi, '&lt;');
}

function safeAlignment(tag: string) {
  const style = tag.match(/\sstyle\s*=\s*["']([^"']+)["']/i)?.[1] ?? '';
  const alignment = style
    .match(/(?:^|;)\s*text-align\s*:\s*(left|center|right)\s*(?:;|$)/i)?.[1]
    ?.toLowerCase();
  return alignment === 'left' || alignment === 'center' || alignment === 'right'
    ? alignment
    : null;
}
