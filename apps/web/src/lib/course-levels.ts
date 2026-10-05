import type { Course, CourseLevelGroup } from '@/lib/catalog';
import { formatNumber } from '@/lib/format';

/**
 * What the "courses by level" block needs worked out before it draws
 * anything: where a level's section is on the page, where its full list
 * is, and what one course says about itself in a single line.
 */

/** How many courses a level shows before the rest fold away. Ten, because
 * that is a level a reader can take in; the rest are one press further. */
export const LEVEL_ROWS_SHOWN = 10;
/** How many the page asks the catalogue for, per level. Past this the
 * section ends in a link to the course list filtered to that level. */
export const LEVEL_ROWS_FETCHED = 30;

/** The section's address on the page: "UG" -> "level-ug". */
export function levelAnchor(code: string) {
  return `level-${code.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

/** The course list, filtered to what this section counted. */
export function levelCoursesHref({
  subject,
  subSubject,
  country,
  level,
}: {
  subject: string;
  subSubject?: string;
  country?: string;
  level?: string;
}) {
  const query = new URLSearchParams({
    ...(country ? { country } : {}),
    subject,
    ...(subSubject ? { subSubject } : {}),
    ...(level ? { level } : {}),
  });
  return `/courses?${query.toString()}`;
}

/** "3 years", "3–5 years", or nothing when no length is recorded. */
export function durationLabel(course: Pick<Course, 'duration'>) {
  const span = [course.duration?.min, course.duration?.max]
    .filter(Boolean)
    .map((value) => String(Number(value)));
  if (!span.length) return null;
  const amount = span[0] === span[span.length - 1] ? span[0] : span.join('–');
  /* The catalogue stores the unit as a plural -- YEARS, MONTHS -- and a
     one-year course read "1 years". */
  const plural = course.duration?.unit?.toLowerCase() ?? '';
  const unit = amount === '1' ? plural.replace(/s$/, '') : plural;
  return `${amount}${unit ? ` ${unit}` : ''}`;
}

/**
 * The quiet middle of a row: which branch of the subject the course belongs
 * to, how long it runs and how it is taught. Only what is recorded.
 */
export function courseRowMeta(
  course: Pick<Course, 'subSubject' | 'duration' | 'studyModes'>,
  { branch = true }: { branch?: boolean } = {},
) {
  return [
    branch ? course.subSubject?.name : null,
    durationLabel(course),
    course.studyModes?.map((mode) => mode.name).join(' / ') || null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * The figure at the end of a row. In a destination it is what that
 * destination charges; outside one it is how many destinations teach the
 * course. Nothing when neither is recorded -- never a guess.
 */
export function courseRowFigure(
  course: Pick<Course, 'selectedTuition' | 'availableCountryCount'>,
) {
  const tuition = course.selectedTuition;
  if (tuition?.min) {
    const low = formatNumber(tuition.min);
    const high = tuition.max ? formatNumber(tuition.max) : '';
    const amount = high && high !== low ? `${low}–${high}` : low;
    if (amount) return [tuition.currencyCode, amount].filter(Boolean).join(' ');
  }
  if (tuition) return null;
  const count = course.availableCountryCount;
  if (!count) return null;
  return `${count} ${count === 1 ? 'destination' : 'destinations'}`;
}

/** The whole of a subject's count, across the levels shown. */
export function levelTotal(groups: CourseLevelGroup[]) {
  return groups.reduce((sum, group) => sum + group.count, 0);
}
