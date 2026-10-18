import { counsellingHref } from './counselling-link';
import { scholarshipListHref } from './country-scholarship-list';
import { rankSpecializations, type CountsHere } from './country-subject';
import { levelPageLinks } from './subject-levels';
import type { ProgrammeSummary } from './university-courses';

/**
 * What a field's page at one study level says about itself to a search
 * engine, and which of the field's specializations, the site's other
 * pages and the other subjects at the level it hands a reader on to.
 * Decided once here so the metadata, the page and the sitemap cannot
 * disagree.
 */

/** Below this many published programmes, a level page with nothing written
 *  about it is a thin page: reachable and followed, but not indexed. The
 *  sitemap uses the same figure, so it never lists a noindex page. */
export const LEVEL_PAGE_MIN_PROGRAMMES = 3;

/**
 * Whether a level page belongs in the index.
 *
 * A level page is a filtered list of the catalogue. Below three programmes,
 * with nothing written about it, it is a thin page; it stays reachable and
 * followed, and stays out of the index. A page an editor has written for
 * (published, an intro and three questions: the API's `hasOwnContent`)
 * stands on its own words whatever is listed. A failed read is not a count,
 * so it keeps the page out until the next crawl rather than vouching for a
 * list nobody saw. A narrowed address is a view of the page, not the page,
 * and a field offered at nothing shows six levels it does not claim. An
 * editor's or a template's robots=false -- on the level page, its subject or
 * its specialization -- always wins.
 */
export function levelPageIndexable({
  narrowed,
  claimed,
  robots,
  programmes,
  ownContent,
}: {
  narrowed: boolean;
  /** Whether the field claims its levels (see `levelPages`). */
  claimed: boolean;
  robots: ReadonlyArray<boolean | null | undefined>;
  /** The page's programme count; null when the read failed. */
  programmes: number | null;
  ownContent: boolean;
}): boolean {
  if (narrowed || !claimed) return false;
  if (robots.some((value) => value === false)) return false;
  return ownContent || (programmes ?? 0) >= LEVEL_PAGE_MIN_PROGRAMMES;
}

/** "a Master's", "an MBA", "a PhD", "an Honours degree": the level's name
 *  with the article it is read with. An initialism is read letter by letter
 *  (MBA -> "em", HND -> "aitch"), a word by its sound. */
export function withArticle(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';
  const word = trimmed.split(/\s+/)[0];
  let article: 'a' | 'an';
  if (/^[A-Z](?:[a-z]?[A-Z])/.test(word)) article = 'AEFHILMNORSX'.includes(word[0]) ? 'an' : 'a';
  else if (/^(uni|use|usu|eu|one|once)/i.test(word)) article = 'a';
  else if (/^(hour|honou?r|heir)/i.test(word)) article = 'an';
  else article = /^[aeiou]/i.test(word) ? 'an' : 'a';
  return `${article} ${trimmed}`;
}

/** "9 programmes", "1 university": the count, then the word it takes. */
function counted(value: number, one: string, many: string) {
  return `${value.toLocaleString('en-GB')} ${value === 1 ? one : many}`;
}

/**
 * The level page's meta description, promising only what the page shows:
 * its counts where they were read, nothing about fees where nothing is
 * listed, and no count at all where the read failed. The level's own
 * description (Admin, Course levels) is the same on every subject and says
 * nothing about the field; the counts do.
 */
export function levelPageDescription({
  level,
  field,
  summary,
}: {
  level: string;
  field: string;
  summary: Pick<ProgrammeSummary, 'programmes' | 'universities' | 'countries'> | null;
}): string {
  if (!summary) return `Study ${level} in ${field} abroad with Universta.`;
  if (!summary.programmes)
    return `No ${level} programme in ${field} is listed on Universta yet. See ${field} at the levels it is offered at.`;
  return `Compare ${counted(summary.programmes, 'programme', 'programmes')} for ${level} in ${field}${
    summary.universities ? ` at ${counted(summary.universities, 'university', 'universities')}` : ''
  }${
    summary.countries ? ` in ${counted(summary.countries, 'destination', 'destinations')}` : ''
  }, with the fees, intakes and entry requirements each one lists.`;
}

/**
 * The field's specializations at one level, each opening on its own page
 * at it.
 *
 * Only branches whose offered levels include this one, so every chip opens
 * a page that answers. `levels` is the API's union of an editor's ticks and
 * the levels of its published courses: the same rule the page itself is
 * gated on. A branch offered at nothing claims no level and is left out.
 * The ones with programmes come first, most first, then the rest by name;
 * a count of nought is not printed.
 */
export function specializationsAtLevel<
  T extends {
    id: string;
    name: string;
    slug: string;
    levels?: ReadonlyArray<{ code: string | null }> | null;
  },
>(
  branches: readonly T[] | null | undefined,
  code: string,
  { counts = null, except }: { counts?: CountsHere; except?: string } = {},
): Array<T & { count?: number }> {
  const wanted = code.toUpperCase();
  const rows = (branches ?? []).filter(
    (row) =>
      row.slug !== except &&
      (row.levels ?? []).some((level) => level.code?.toUpperCase() === wanted),
  );
  return rankSpecializations(rows, (row) => counts?.get(row.slug) ?? 0).map((row) => ({
    ...row,
    count: counts?.get(row.slug) || undefined,
  }));
}

/** One of the "Plan your Master's" links: a page elsewhere on the site. */
export type LevelPlanLink = { key: 'programmes' | 'scholarships' | 'universities' | 'destinations' | 'counselling'; label: string; href: string };

/**
 * "Plan your Master's": the site's own pages that help at this level, in
 * the order a reader plans one. Only routes that answer, narrowed to the
 * level where the page reads a level: the course finder takes the level's
 * code as `level`, the scholarship finder as `degreeLevel` (where no award
 * is tied to the level it drops the filter and lists them all; it never
 * 404s). The universities list has no level filter, so it is linked plain.
 * There is no intakes, cost or visa page of its own -- each destination
 * guide carries those parts -- so the destinations are linked instead.
 * Counselling knows the field and the page it was asked from.
 */
export function levelPlanLinks({
  level,
  subject,
  specialization,
  from,
}: {
  level: { code: string; name: string };
  subject: string;
  specialization?: string;
  /** The level page's own path, for counselling's way back. */
  from: string;
}): LevelPlanLink[] {
  const code = level.code.toUpperCase();
  return [
    { key: 'programmes', label: `Find ${level.name} programmes`, href: `/courses?level=${encodeURIComponent(code)}` },
    /* Asks the finder for the level without promising it: the finder drops a
       level no award is tied to yet and lists every award instead. */
    { key: 'scholarships', label: 'Find scholarships', href: `${scholarshipListHref('/scholarships', { levels: [code] })}#scholarships` },
    { key: 'universities', label: 'Browse universities', href: '/universities' },
    { key: 'destinations', label: 'Compare study destinations', href: '/study-abroad' },
    {
      key: 'counselling',
      label: 'Free counselling',
      href: counsellingHref({ source: specialization ? 'specialization' : 'subject', subject, specialization, from }),
    },
  ];
}

/**
 * The other subjects with a page at this level, each linked to it: "More
 * subjects at Master's".
 *
 * The subject list's own rule, as the /subjects cards link their levels
 * (`levelPageLinks`): a subject offered at the level among the catalogue's
 * active levels, and claiming it -- one offered at nothing shows six levels
 * it claims none of, so it is left out. Always the plain address, never the
 * noindex `?view=guides` copy. The subject being read is left out; the rest
 * keep the list's order, up to `max`.
 */
export function subjectsAtLevel(
  rows: ReadonlyArray<{ id: string; name: string; slug: string; levels?: ReadonlyArray<{ code: string | null; name: string }> | null }> | null | undefined,
  code: string,
  { except, catalogue, max = 12 }: { except?: string; catalogue?: ReadonlyArray<{ code: string }> | null; max?: number } = {},
): Array<{ id: string; name: string; href: string }> {
  const wanted = code.toUpperCase();
  return (rows ?? []).flatMap((row) => {
    if (row.slug === except) return [];
    const link = levelPageLinks(row.levels, { subject: row.slug }, catalogue).find((entry) => entry.code === wanted);
    return link ? [{ id: row.id, name: row.name, href: link.href }] : [];
  }).slice(0, max);
}
