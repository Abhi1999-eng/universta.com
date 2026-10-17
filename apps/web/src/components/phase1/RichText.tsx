type Props = { value: string; className?: string };
const allowedTags = new Set(['p', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'ul', 'ol', 'li', 'a', 'blockquote', 'hr', 'br', 'img']);
const alignedBlockTags = new Set(['p', 'h2', 'h3', 'h4', 'blockquote']);
const escape = (value: string) => value.replace(/[&"<>]/g, (char) => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' })[char] ?? char);
/* A leading slash makes a link internal only when a second one does not
   follow it: a browser reads `/\` as `//` too, the start of another host. */
const safeHref = (value: string) => /^https:\/\//i.test(value) || /^\/(?![/\\])/.test(value) || /^#[a-zA-Z0-9_-]+$/.test(value);
const safeImage = (value: string) => /^https:\/\//i.test(value) || /^\/api\/v1\/media\//.test(value) || /^\/media\//.test(value);

const NAMED_ENTITIES: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' };

/**
 * An attribute value as the browser reads it, so it is checked as that and
 * written back once: the API's sanitiser has usually escaped it already, and
 * escaping `&amp;` a second time sent an image's `?w=1&amp;amp;h=2` to the
 * wrong address. One pass, so `&amp;lt;` stays the text `&lt;`. Any `&` it
 * leaves -- an entity it does not know -- is escaped on the way out and
 * reaches the page as the text it is, never as a character the check did
 * not see. A code point no browser accepts is left as text the same way.
 */
function attributeValue(raw: string) {
  const decoded = raw.replace(/&(?:#(\d{1,7})|#x([0-9a-f]{1,6})|([a-z]+));/gi, (entity, dec, hex, name) => {
    if (name) return NAMED_ENTITIES[name.toLowerCase()] ?? entity;
    const code = dec ? Number(dec) : parseInt(hex, 16);
    return code > 0 && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff) ? String.fromCodePoint(code) : entity;
  });
  /* As the address parser reads it: tabs and line breaks anywhere are
     dropped, and so are control characters and spaces at either end. A tab
     between two slashes otherwise passed as one slash and opened another
     host. */
  return decoded.replace(/[\t\n\r]/g, '').replace(/^[\u0000- ]+|[\u0000- ]+$/g, '');
}

/**
 * The allowlisted HTML of a rich-text value, every kept tag rebuilt from
 * its name and checked attributes alone, so no handler or script address
 * survives on one.
 *
 * The text between the tags keeps every character but `<`. A tag cut off
 * at the end of a value -- `<p>Intro</p><img src=x onerror="..."` -- has
 * no `>` for the tag pass to find, so it used to reach the page as written
 * and the browser parsed it into a live <img onerror>. Escaped, it reads
 * as the text it is.
 */
export function safeRichText(value: string) {
  return sanitised(value, (text) => text.replace(/</g, '&lt;'));
}

/** The value's tags rebuilt by `safeTag`, unsafe elements dropped whole,
 *  and the text between the tags passed through `text`. */
function sanitised(value: string, text: (part: string) => string) {
  return value
    .replace(/<(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .split(/(<\/?[^>]+>)/g)
    .map((part, index) => (index % 2 ? safeTag(part) : text(part)))
    .join('');
}

function safeTag(tag: string) {
  const match = tag.match(/^<\s*(\/?)\s*([a-z0-9]+)/i);
  if (!match || !allowedTags.has(match[2].toLowerCase())) return '';
  const name = match[2].toLowerCase();
  const closing = match[1] === '/';
  if (closing) return `</${name}>`;
  if (alignedBlockTags.has(name)) {
    const alignment = safeAlignment(tag);
    return alignment ? `<${name} style="text-align: ${alignment}">` : `<${name}>`;
  }
  if (!['a', 'img'].includes(name)) return `<${name}>`;
  if (name === 'a') {
    const href = attributeValue(tag.match(/\shref\s*=\s*["']([^"']+)["']/i)?.[1] ?? '');
    return safeHref(href) ? `<a href="${escape(href)}" rel="noopener noreferrer">` : '<a>';
  }
  const src = attributeValue(tag.match(/\ssrc\s*=\s*["']([^"']+)["']/i)?.[1] ?? '');
  const alt = attributeValue(tag.match(/\salt\s*=\s*["']([^"']*)["']/i)?.[1] ?? '');
  return safeImage(src) ? `<img src="${escape(src)}" alt="${escape(alt)}">` : '';
}

/**
 * Schema.org text fields must stay text even when the corresponding visible
 * page field is authored as rich text. Sanitise first so dropped unsafe nodes
 * cannot contribute their content, then remove the remaining presentation
 * markup without maintaining a second HTML allowlist.
 */
export function richTextToPlainText(value: string) {
  /* Text, never markup: a `<` in it is kept as written, not escaped as the
     page's HTML needs it, so a reader is not shown "&lt;". */
  return sanitised(value, (text) => text)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(?:p|h2|h3|h4|li|blockquote)>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function safeAlignment(tag: string) {
  const style = tag.match(/\sstyle\s*=\s*["']([^"']+)["']/i)?.[1] ?? '';
  const alignment = style.match(/(?:^|;)\s*text-align\s*:\s*(left|center|right)\s*(?:;|$)/i)?.[1]?.toLowerCase();
  return alignment === 'left' || alignment === 'center' || alignment === 'right' ? alignment : null;
}

/** Every rich-text block carries `rich-text` alongside whatever class the caller
 * passes. Tailwind's Preflight strips list markers and flattens headings across
 * the whole document, so authored lists and headings rendered as plain text on
 * the public page; that class is the hook the stylesheet restores them through,
 * without touching the site's own navigation and card lists. */
export function RichText({ value, className }: Props) {
  const classes = className ? `rich-text ${className}` : 'rich-text';
  if (!/<\/?[a-z][^>]*>/i.test(value))
    return <p className={classes} style={{ whiteSpace: 'pre-line' }}>{value}</p>;
  return <div className={classes} dangerouslySetInnerHTML={{ __html: safeRichText(value) }} />;
}
