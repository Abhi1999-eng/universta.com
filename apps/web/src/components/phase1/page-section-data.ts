/** How a catalogue-backed section's admin settings become a catalogue query.
 *
 * Kept apart from the renderer so the translation is testable on its own and
 * so this file stays free of React and of the app's module aliases. */

export type DirectoryItem = {
  /** Needed so hand-picked selections can be matched back to records. */
  slug: string;
  title: string;
  description: string;
  href: string | null;
};

/** What the admin chose in the builder's Content source controls. Absent
 * fields mean "no opinion", so a section saved before these controls existed
 * keeps its previous behaviour: newest records, capped by limit. */
export type DirectorySettings = {
  limit?: number;
  dataMode?: 'automatic' | 'manual';
  /** Only the filters the catalogue API genuinely supports are honoured. */
  filters?: { q?: string; country?: string };
  sort?: string;
  /** Hand-picked record slugs, in the order the admin arranged them. */
  picks?: string[];
};

/** Query for the automatic mode. Manual mode asks for a wider page and picks
 * out of it, because the catalogue list endpoints filter rather than accept a
 * set of slugs -- so the automatic filters are deliberately not sent, or they
 * would narrow the pool the picks are matched against. */
export function directoryQuery(
  settings: DirectorySettings,
  take: string,
): Record<string, string> {
  const manual = settings.dataMode === 'manual';
  const query: Record<string, string> = { limit: manual ? '50' : take };
  if (!manual) {
    if (settings.filters?.q) query.q = settings.filters.q;
    if (settings.filters?.country) query.country = settings.filters.country;
    if (settings.sort) query.sort = settings.sort;
  }
  return query;
}

/** Keeps only the hand-picked records, in the admin's chosen order. A pick
 * whose record has since been unpublished simply drops out rather than
 * leaving a gap or a link that no longer resolves. */
export function applyPicks(
  items: DirectoryItem[],
  settings: DirectorySettings,
): DirectoryItem[] {
  if (settings.dataMode !== 'manual') return items;
  const picks = settings.picks ?? [];
  if (!picks.length) return [];
  const bySlug = new Map(items.map((item) => [item.slug, item]));
  return picks
    .map((slug) => bySlug.get(slug))
    .filter((item): item is DirectoryItem => Boolean(item));
}
