import type { CatalogLevel, LevelPageDetail, LevelPageOwner, LevelPageRow, LevelPageStatus, LevelSource, OfferedLevel } from './catalog.types';
import { faqBlank, faqUsed, type FaqDraft } from './editorial/ContentBlocks';
import { richTextOrEmpty } from '@/features/shared/rich-text-value';
import { seoPayload, unifiedSeoWanted, type UnifiedSeoDraft } from '@/features/shared/UnifiedSeoFields';

/**
 * What the level-pages card and the level-page editor share: where each one
 * lives, what a page is called, and the one request that saves it.
 *
 * Whether a page is ready for search engines is the API's call (`searchReady`
 * on each row). The editor still needs its own count for the hint it shows
 * while the page is being written and is not saved yet, which is all
 * LEVEL_PAGE_MIN_FAQS is for here.
 */

/** Active FAQs a published page with an intro needs before search engines are
 * told to index it ahead of any programmes. The API holds the rule. */
export const LEVEL_PAGE_MIN_FAQS = 3;
/** The most FAQs one page saves; the API refuses more. */
export const LEVEL_PAGE_MAX_FAQS = 30;
/** The admin's proxy refuses a body over 64 KB. Stopping a little short of it
 * lets the editor say what to shorten, rather than only that it is too large. */
export const LEVEL_PAGE_MAX_BYTES = 60_000;

export function ownerEditorHref(owner: LevelPageOwner, id: string) {
  return owner === 'subject' ? `/subjects/${id}` : `/specializations/${id}`;
}

export function levelPageEditorHref(owner: LevelPageOwner, id: string, levelId: string) {
  return `${ownerEditorHref(owner, id)}/level-pages/${levelId}`;
}

/** The id of the card on the owner's editor, so the editor can send an
 * operator straight back to it. */
export function levelPagesAnchor(owner: LevelPageOwner) {
  return `${owner}-level-pages`;
}

/** "Master's in Computing", or the specialization's name on its own pages. */
export function levelPageTitle(detail: Pick<LevelPageDetail, 'level' | 'subject' | 'specialization'>) {
  return `${detail.level.name} in ${detail.specialization?.name ?? detail.subject.name}`;
}

/** The levels a row of the admin subject or specialization list shows: the
 * ones the site offers it at, which is more than its own ticks -- a subject
 * with no ticks of its own whose specializations tick Bachelor's read "—"
 * here and "Bachelor's" on the site. A row from an API that does not send
 * the offered set yet falls back to the ticks. */
export function listedLevelNames(row: { offeredLevels?: OfferedLevel[]; courseLevels?: CatalogLevel[] }): string[] {
  return (row.offeredLevels ?? row.courseLevels ?? []).map((level) => level.name);
}

/** The tooltip on the lists' Levels column: where those levels come from. */
export const LEVELS_COLUMN_TITLE: Record<LevelPageOwner, string> = {
  subject: 'The study levels the site offers each subject at: the levels ticked on it, the levels ticked on its published specializations, and the levels of its published courses.',
  specialization: 'The study levels the site offers each specialization at: the levels ticked on it and the levels of its published courses.',
};

const SOURCE_LABELS: Record<LevelSource, string> = {
  TICKED: 'Ticked here',
  SPECIALIZATION: 'From a specialization',
  COURSES: 'Has published courses',
};

/** Why a level has a page here, in the card's words, so an editor can tell a
 * level they ticked from one that a specialization or a course brought in. */
export function levelSourcesHint(sources: LevelSource[]) {
  return (['TICKED', 'SPECIALIZATION', 'COURSES'] as const)
    .filter((source) => sources.includes(source))
    .map((source) => SOURCE_LABELS[source])
    .join(' · ');
}

/** What a page still lacks to be indexed on its own words, e.g.
 * ['an intro', '2 more FAQs']; empty once it has enough. */
export function searchGap(hasIntro: boolean, activeFaqs: number): string[] {
  const gap: string[] = [];
  if (!hasIntro) gap.push('an intro');
  const missing = LEVEL_PAGE_MIN_FAQS - activeFaqs;
  if (missing > 0) gap.push(`${missing} more FAQ${missing === 1 ? '' : 's'}`);
  return gap;
}

/** The same set of ids, in any order. */
export function sameIds(a: string[], b: string[]) {
  const left = new Set(a);
  const right = new Set(b);
  return left.size === right.size && [...left].every((id) => right.has(id));
}

/** A level's part of its pages' address, as the API names it (PG ->
 * "masters"). The admin's level list sends it; the fallback mirrors the
 * API's rule for a list read before it did. */
export function levelSlug(level: { code: string; slug?: string }) {
  if (level.slug) return level.slug;
  const named: Record<string, string> = { UG: 'bachelors', PG: 'masters', PHD: 'phd' };
  return named[level.code.toUpperCase()] ?? level.code.toLowerCase();
}

/**
 * Where a row of the Level pages card stands against the ticks above it:
 * - `saved`: as stored; any tick change leaves it offered either way.
 * - `new`: ticked here and not saved yet; its page can be written once the
 *   ticks are saved.
 * - `returning`: a page kept from before its level stopped being offered,
 *   ticked again; back on the site once saved.
 * - `leaving`: offered only because it was ticked, and now unticked; off the
 *   site once saved (what was written is kept).
 */
export type LiveLevelState = 'saved' | 'new' | 'returning' | 'leaving';
export interface LiveLevelRow {
  level: { id: string; name: string };
  /** The public address, or null while a new record has no slug yet. */
  path: string | null;
  page: LevelPageRow['page'];
  /** On the site as things are saved now. */
  offered: boolean;
  /** Why it will be offered once the ticks are saved. */
  sources: LevelSource[];
  state: LiveLevelState;
  /** Its tick here differs from the saved one. */
  unsaved: boolean;
}

/**
 * The card's rows as the ticks stand now, not only as they were last saved:
 * the API says what is offered as stored, and the ticks above say what the
 * editor is about to save. A level ticked here appears at once, a level
 * unticked is marked as leaving, and a level a specialization or a course
 * brings in stays whatever its tick.
 *
 * `levels` is the active level list the ticks are drawn from, in its order.
 * While it is empty (its read failed) the ticks can't be named, so the rows
 * stay as the API sent them.
 */
export function liveLevelRows({
  rows,
  levels,
  ticked,
  savedTicked,
  basePath,
}: {
  rows: LevelPageRow[];
  levels: Array<{ id: string; code: string; name: string; slug?: string }>;
  ticked: string[];
  savedTicked: string[];
  basePath: string | null;
}): LiveLevelRow[] {
  const asSaved = (row: LevelPageRow): LiveLevelRow => ({
    level: { id: row.level.id, name: row.level.name },
    path: row.path,
    page: row.page,
    offered: row.offered,
    sources: row.sources,
    state: 'saved',
    unsaved: false,
  });
  if (!levels.length) return rows.map(asSaved);
  const now = new Set(ticked);
  const before = new Set(savedTicked);
  const known = new Map(levels.map((level, index) => [level.id, { level, index }]));
  const seen = new Set<string>();
  const live: LiveLevelRow[] = rows.map((row) => {
    seen.add(row.level.id);
    const id = row.level.id;
    /* Only an active level offers anything; a tick on one switched off
       since is left as the API reads it. */
    if (!known.has(id)) return asSaved(row);
    /* Only a tick moved since the last save changes a row. Rows read before
       that save (the card reads them again after it) are otherwise taken as
       they were sent, as the card always did while re-reading. */
    if (now.has(id) === before.has(id)) return asSaved(row);
    const others = row.sources.filter((source) => source !== 'TICKED');
    const sources: LevelSource[] = now.has(id) ? ['TICKED', ...others] : others;
    const willOffer = sources.length > 0;
    return {
      ...asSaved(row),
      sources,
      state: !row.offered && willOffer ? 'returning' : row.offered && !willOffer ? 'leaving' : 'saved',
      unsaved: true,
    };
  });
  for (const id of ticked) {
    const entry = known.get(id);
    /* A tick saved already but not in the rows yet: the rows were read before
       that save, and the re-read brings it. */
    if (!entry || seen.has(id) || before.has(id)) continue;
    live.push({
      level: { id, name: entry.level.name },
      path: basePath ? `${basePath}/${levelSlug(entry.level)}` : null,
      page: null,
      offered: false,
      sources: ['TICKED'],
      state: 'new',
      unsaved: true,
    });
  }
  /* Offered (or about to be) first, each group in the levels' own order;
     the API sorts its rows the same way. */
  const willOffer = (row: LiveLevelRow) => row.sources.length > 0 && row.state !== 'leaving';
  const place = (row: LiveLevelRow) => known.get(row.level.id)?.index ?? Number.MAX_SAFE_INTEGER;
  return live
    .map((row, index) => ({ row, index }))
    .sort((a, b) => Number(willOffer(b.row)) - Number(willOffer(a.row)) || place(a.row) - place(b.row) || a.index - b.index)
    .map(({ row }) => row);
}

/** The written parts of a level page, each shown as its own section on the
 * site and hidden while empty. Only the intro (with the FAQs) counts towards
 * search; any of them is enough to publish. */
export type LevelPageContent = {
  intro: string;
  studyTopics: string;
  admissionNote: string;
  careersNote: string;
  industries: string;
  employers: string;
  lookingAhead: string;
};

/** A new FAQ on a level page. Its display order starts blank, which means
 * "where it sits on screen", so an added FAQ stays at the bottom. */
export const levelPageFaqBlank = (): FaqDraft => ({ ...faqBlank(), displayOrder: '' });

/**
 * The FAQs to send, in the order the page will show them, numbered 0..n-1.
 *
 * A display order typed in wins, 0 included; a blank one is the row's place
 * on screen. Rows that tie keep their screen order. The API sorts by display
 * order and then by id, and every save gives the FAQs new ids, so a tie sent
 * to it would come back in any order: numbering them here leaves none.
 */
export function levelPageFaqs(faqs: FaqDraft[]) {
  return faqs
    .filter(faqUsed)
    .map((row, index) => ({ row, index, order: row.displayOrder.trim() === '' ? index : Number(row.displayOrder) }))
    .sort((a, b) => a.order - b.order || a.index - b.index)
    .map(({ row }, displayOrder) => ({
      question: row.question.trim(),
      answer: row.answer.trim(),
      status: row.status,
      displayOrder,
    }));
}

/**
 * The one PUT that saves a level page: its text, its status, every FAQ and its
 * SEO, under one version.
 *
 * - The FAQ list replaces the stored one whole, so a removed row is simply
 *   left out and no FAQ ids are sent: they change on every save.
 * - SEO left blank, with both robots ticks on, is sent as null, which
 *   removes a stored record. A robots tick taken off with nothing written
 *   is sent as a record of its own (see unifiedSeoWanted).
 * - `expectedUpdatedAt` is the page's version, or null before the first save,
 *   which tells the API "there is no page yet": a page another tab wrote in
 *   the meantime is then refused as changed rather than overwritten.
 */
export function levelPagePayload({
  content,
  faqs,
  seo,
  intent,
  page,
}: {
  content: LevelPageContent;
  faqs: FaqDraft[];
  seo: UnifiedSeoDraft;
  intent: 'draft' | 'publish';
  page: { updatedAt: string } | null;
}) {
  const status: LevelPageStatus = intent === 'publish' ? 'PUBLISHED' : 'DRAFT';
  return {
    intro: richTextOrEmpty(content.intro),
    studyTopics: richTextOrEmpty(content.studyTopics),
    admissionNote: richTextOrEmpty(content.admissionNote),
    careersNote: richTextOrEmpty(content.careersNote),
    industries: richTextOrEmpty(content.industries),
    employers: richTextOrEmpty(content.employers),
    lookingAhead: richTextOrEmpty(content.lookingAhead),
    status,
    faqs: levelPageFaqs(faqs),
    seo: unifiedSeoWanted(seo) ? seoPayload(seo) : null,
    expectedUpdatedAt: page?.updatedAt ?? null,
  };
}

/** Whether a save has anything to show once published: any written part or
 * an active FAQ. The API refuses to publish a page with none. */
export function levelPageHasWords(payload: ReturnType<typeof levelPagePayload>) {
  const { intro, studyTopics, admissionNote, careersNote, industries, employers, lookingAhead } = payload;
  return [intro, studyTopics, admissionNote, careersNote, industries, employers, lookingAhead].some(Boolean)
    || payload.faqs.some((row) => row.status === 'ACTIVE');
}

/** The size the proxy will measure, in bytes rather than characters. */
export function levelPageBytes(payload: unknown) {
  return new TextEncoder().encode(JSON.stringify(payload)).byteLength;
}
