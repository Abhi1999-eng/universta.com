import { sanitizeRichText } from '../common/rich-text';

/**
 * What a study level's own page is, without a database: its address, when
 * it has enough of its own words to stand in search, and the record the SEO
 * resolver reads. The subjects service, the level-pages service, the SEO
 * resolver and the course-levels service all read these, so each rule lives
 * once.
 */

/* The `seo_metadata` row of a level page is filed under this owner type,
   with the page row's id as the owner id. */
export const SUBJECT_LEVEL_PAGE_SEO_OWNER = 'SUBJECT_LEVEL_PAGE';

/* A page needs an intro and this many live questions before its own words
   are enough for search to list it with no programmes behind it. The admin
   keeps the same number for its live hint while a page is unsaved. */
export const LEVEL_PAGE_MIN_FAQS = 3;

export const LEVEL_PAGE_STATUSES = ['DRAFT', 'PUBLISHED'] as const;
export type LevelPageStatus = (typeof LEVEL_PAGE_STATUSES)[number];

/* Why a field is offered at a level: ticked on the record itself, ticked on
   one of the subject's published specializations, or standing behind a
   published course. */
export const LEVEL_SOURCES = ['TICKED', 'SPECIALIZATION', 'COURSES'] as const;
export type LevelSource = (typeof LEVEL_SOURCES)[number];

/* The readable address a level's page has on the site; any other level is
   addressed by its code. Must stay the same as LEVEL_SLUGS in apps/web
   subject-levels.ts, or canonical URLs, the admin's links and the sitemap
   point at pages that do not exist. */
export const PUBLIC_LEVEL_SLUGS: Record<string, string> = {
  FOUNDATION: 'foundation',
  PATHWAY: 'pathway',
  UG: 'bachelors',
  PG: 'masters',
  MBA: 'mba',
  PHD: 'phd',
};

export function publicLevelSlug(code: string): string {
  return PUBLIC_LEVEL_SLUGS[code.toUpperCase()] ?? code.toLowerCase();
}

/**
 * Whether a level answers to the last part of a page's address: its code
 * ("PG"), its readable slug ("masters"), or "undergraduate" for Bachelor's.
 * The same rule as the web's findSubjectLevel.
 */
export function matchesLevelParam(
  level: { code: string | null },
  value: string,
): boolean {
  if (!level.code) return false;
  const wanted = value.trim().toLowerCase();
  const alias = wanted === 'undergraduate' ? 'bachelors' : wanted;
  return (
    publicLevelSlug(level.code) === alias || level.code.toLowerCase() === alias
  );
}

/** A level page's public address: /subjects/computing/masters, or
 * /subjects/computing/artificial-intelligence/masters for a specialization. */
export function levelPagePath(input: {
  subjectSlug: string;
  specializationSlug?: string | null;
  levelCode: string;
}): string {
  const field = `/subjects/${encodeURIComponent(input.subjectSlug)}${
    input.specializationSlug
      ? `/${encodeURIComponent(input.specializationSlug)}`
      : ''
  }`;
  return `${field}/${encodeURIComponent(publicLevelSlug(input.levelCode))}`;
}

/**
 * Rich text as it is stored: trimmed and sanitised the way a course's
 * overview is (courses.service sanitizeCourseRichText), and null when nothing
 * would show -- an editor who clears a field leaves "<p> </p>" or "<p><br></p>"
 * behind, which is not something written. A picture counts as content.
 */
export function richTextOrNull(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const clean = String(sanitizeRichText(trimmed)).trim();
  if (!clean) return null;
  return visibleText(clean) || /<img\s/i.test(clean) ? clean : null;
}

/** The words a reader would see in sanitised HTML. */
export function visibleText(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;|&#xa0;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Whether a page has enough of its own words to be worth listing in search
 * with no programmes behind it: published, with an intro and at least three
 * live questions. The admin's "Search-ready" chip and the public page's
 * `hasOwnContent` both come from here.
 */
export function hasOwnContent(page: {
  status: string;
  hasIntro: boolean;
  activeFaqCount: number;
}): boolean {
  return (
    page.status === 'PUBLISHED' &&
    page.hasIntro &&
    page.activeFaqCount >= LEVEL_PAGE_MIN_FAQS
  );
}

/**
 * The record the SEO resolver reads for a level page (entity type
 * `levelPage`): its fallback title "Master's in Computer Science", the
 * variables a bulk template may use, and what its canonical address is
 * built from. A page nobody has written yet still has one, keyed by its
 * subject and level, so the template applies to it too.
 */
export function levelPageSeoRecord(input: {
  pageId: string | null;
  subject: { id: string; name: string; slug: string };
  specialization: { id: string; name: string; slug: string } | null;
  level: {
    id: string;
    code: string;
    name: string;
    description: string | null;
  };
}): Record<string, unknown> {
  const levelSlug = publicLevelSlug(input.level.code);
  return {
    id:
      input.pageId ??
      `${input.subject.id}:${input.specialization?.id ?? ''}:${input.level.id}`,
    name: `${input.level.name} in ${(input.specialization ?? input.subject).name}`,
    slug: levelSlug,
    levelSlug,
    subject: { name: input.subject.name, slug: input.subject.slug },
    specialization: input.specialization
      ? { name: input.specialization.name, slug: input.specialization.slug }
      : null,
    courseLevel: { name: input.level.name, code: input.level.code },
    description: input.level.description,
  };
}
