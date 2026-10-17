import type { LevelPageDetail, LevelPageOwner, LevelPageStatus, LevelSource } from './catalog.types';
import { faqBlank, faqUsed, type FaqDraft } from './editorial/ContentBlocks';
import { richTextOrEmpty } from '@/features/shared/rich-text-value';
import { seoPayload, unifiedSeoConfigured, type UnifiedSeoDraft } from '@/features/shared/UnifiedSeoFields';

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
 * lets the editor say what to shorten, rather than "Invalid catalog request". */
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

export type LevelPageContent = { intro: string; admissionNote: string; careersNote: string };

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
 * - SEO left blank is sent as null, which removes a stored record.
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
    admissionNote: richTextOrEmpty(content.admissionNote),
    careersNote: richTextOrEmpty(content.careersNote),
    status,
    faqs: levelPageFaqs(faqs),
    seo: unifiedSeoConfigured(seo) ? seoPayload(seo) : null,
    expectedUpdatedAt: page?.updatedAt ?? null,
  };
}

/** The size the proxy will measure, in bytes rather than characters. */
export function levelPageBytes(payload: unknown) {
  return new TextEncoder().encode(JSON.stringify(payload)).byteLength;
}
