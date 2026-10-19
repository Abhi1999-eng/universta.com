/**
 * What the record editor's SEO inputs start with: what an editor wrote, and
 * nothing the page would use anyway.
 *
 * Until the editor stopped doing it, opening a record filled every SEO input
 * with the values the page used without them -- the record's own name, the
 * site's default description -- and saving stored those as though an editor
 * had typed them. The API already reads such a stored title or description
 * as not written: its `source` then says "fallback", "default" or "bulk"
 * rather than "manual". But an input that showed it would save it again, and
 * once the record was renamed the old name no longer matched and stuck as
 * the page title for good. So a stored title or description the page ignores
 * starts empty here, and so do the Open Graph and Twitter copies the old
 * editor made of it. The next save clears them, and the page follows the
 * record again. Anything an editor did write is kept as it is.
 */

type Row = Record<string, unknown>;

const FAMILIES = [
  { kind: 'title', main: 'seoTitle', keys: ['seoTitle', 'ogTitle', 'twitterTitle'] },
  { kind: 'description', main: 'metaDescription', keys: ['metaDescription', 'ogDescription', 'twitterDescription'] },
] as const;

const text = (value: unknown) => (typeof value === 'string' ? value : '');
const same = (value: string) => value.replace(/\s+/g, ' ').trim();

export function writtenSeoValues(stored: Row | null, resolved: Row | null, keys: readonly string[]): Record<string, string> {
  const values = Object.fromEntries(keys.map((key) => [key, stored ? text(stored[key]) : '']));
  const source = resolved && resolved.source && typeof resolved.source === 'object' ? (resolved.source as Row) : null;
  if (!stored || !resolved || !source) return values;
  for (const family of FAMILIES) {
    if (source[family.kind] === 'manual') continue;
    /* The stored value the page passed over, and what it shows instead. */
    const echoes = new Set([same(text(stored[family.main])), same(text(resolved[family.main]))].filter(Boolean));
    for (const key of family.keys) if (key in values && echoes.has(same(values[key]))) values[key] = '';
  }
  return values;
}
