/** How a catalogue-backed section's admin settings become a catalogue query.
 *
 * Kept apart from the renderer so the translation is testable on its own and
 * so this file stays free of React and of the app's module aliases. */
import { plainExcerpt } from '../../lib/record-text';

export type DirectoryItem = {
  /** Needed so hand-picked selections can be matched back to records. */
  slug: string;
  /** The record's id: a testimonial has no slug, so its picks are ids. */
  id?: string;
  title: string;
  description: string;
  href: string | null;
  /** A testimonial, drawn as the zip's quote card: the words, the student
   *  and their role line. */
  quote?: {
    text: string;
    name: string | null;
    role: string | null;
    image?: { publicUrl?: unknown; altText?: unknown } | null;
  };
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
  /** Hand-picked records, in the order the admin arranged them: slugs, or
   *  ids for a record type with no slug (testimonials). */
  picks?: string[];
};

const words = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : '');

/** Where a record type's cards link; a type not listed has no page per record. */
export const DIRECTORY_HREF_PREFIX: Record<string, string> = {
  UNIVERSITY_DIRECTORY: '/universities',
  SCHOLARSHIP_DIRECTORY: '/scholarships',
  CONSULTANT_DIRECTORY: '/study-abroad-consultants',
  SUCCESS_STORIES: '/success-stories',
};

/**
 * One record from the public list as a section item.
 *
 * A testimonial has no name, title or slug: its student is the attribution,
 * the role line is the attribution note, and the words are the quote, so it
 * is drawn as the zip's quote card rather than as a card with an empty
 * title. A success story's journey is rich text with content variables; its
 * card shows a resolved, plain excerpt and links to the story.
 */
export function directoryItem(sectionType: string, item: Record<string, unknown>): DirectoryItem {
  const slug = words(item.slug);
  const id = words(item.id) || undefined;
  const prefix = DIRECTORY_HREF_PREFIX[sectionType];
  const href = prefix && slug ? `${prefix}/${slug}` : null;
  if (sectionType === 'TESTIMONIALS') {
    const name = words(item.attribution) || null;
    return {
      slug,
      id,
      title: name ?? '',
      description: words(item.quote),
      href: null,
      quote: {
        text: words(item.quote),
        name,
        role: words(item.attributionNote) || null,
        image: (item.imageMedia as { publicUrl?: unknown; altText?: unknown } | null | undefined) ?? null,
      },
    };
  }
  if (sectionType === 'SUCCESS_STORIES') {
    return {
      slug,
      id,
      title: words(item.title),
      description: plainExcerpt(item.journey, 180, 'successStory', item) ?? '',
      href,
    };
  }
  return {
    slug,
    id,
    title: words(item.name) || words(item.title),
    description:
      words(item.shortDescription) ||
      words(item.quote) ||
      words(item.journey) ||
      words(item.summary),
    href,
  };
}

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
 * leaving a gap or a link that no longer resolves. A pick is matched on the
 * record's slug, and on its id for a record that has none: the admin saves
 * a testimonial's id, since testimonials have no slug. */
export function applyPicks(
  items: DirectoryItem[],
  settings: DirectorySettings,
): DirectoryItem[] {
  if (settings.dataMode !== 'manual') return items;
  const picks = settings.picks ?? [];
  if (!picks.length) return [];
  const byKey = new Map<string, DirectoryItem>();
  for (const item of items) {
    if (item.id) byKey.set(item.id, item);
  }
  /* A slug wins over an id that happens to read the same. */
  for (const item of items) {
    if (item.slug) byKey.set(item.slug, item);
  }
  return picks
    .map((key) => byKey.get(key))
    .filter((item): item is DirectoryItem => Boolean(item));
}
