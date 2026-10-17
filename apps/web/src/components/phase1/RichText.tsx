type Props = { value: string; className?: string };
const allowedTags = new Set(['p', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'ul', 'ol', 'li', 'a', 'blockquote', 'hr', 'br', 'img']);
const alignedBlockTags = new Set(['p', 'h2', 'h3', 'h4', 'blockquote']);
const escape = (value: string) => value.replace(/[&"<>]/g, (char) => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' })[char] ?? char);
const safeHref = (value: string) => /^https:\/\//i.test(value) || /^\/(?!\/)/.test(value) || /^#[a-zA-Z0-9_-]+$/.test(value);
const safeImage = (value: string) => /^https:\/\//i.test(value) || /^\/api\/v1\/media\//.test(value) || /^\/media\//.test(value);

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
    const href = tag.match(/\shref\s*=\s*["']([^"']+)["']/i)?.[1] ?? '';
    return safeHref(href) ? `<a href="${escape(href)}" rel="noopener noreferrer">` : '<a>';
  }
  const src = tag.match(/\ssrc\s*=\s*["']([^"']+)["']/i)?.[1] ?? '';
  const alt = tag.match(/\salt\s*=\s*["']([^"']*)["']/i)?.[1] ?? '';
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
