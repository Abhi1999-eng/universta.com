import { maxLength } from 'class-validator';

/**
 * A destination's study paths: the levels a student can enter at, and what
 * each one asks of them.
 *
 * The public guide used to print four of these on every country page --
 * Bachelor's, Master's, MBA and PhD, with a duration and an entry requirement
 * each -- from a list written into the web app. It was the same text for
 * every destination, it appeared on a country nobody had filled in, and no
 * editor could change a word of it. They are the country's own now: typed in
 * the country form, stored here, and absent from the page when there are none.
 *
 * One JSON document, for the reason the calculator is one: it is read and
 * written whole, never queried across countries, and has no relationships.
 * Everything that reaches the page passes through `parseStudyPaths`, so a
 * hand-edited or half-written document yields fewer rows rather than a broken
 * section.
 */
export type StudyPathEntry = {
  /** "Bachelor's", "Foundation year" -- the tab's label. */
  name: string;
  duration: string | null;
  /** What a student needs in order to enter at this level. */
  entry: string | null;
  summary: string | null;
};

export const MAX_STUDY_PATHS = 8;
export const STUDY_PATH_LIMITS = {
  name: 60,
  duration: 80,
  entry: 200,
  summary: 400,
} as const;

/* Measured the way the DTO measures. The request is checked with
   class-validator, which counts an emoji as one character; `String.length`
   counts it as two. Measured differently here, a field the request had just
   been told was fine was dropped on the way to the database -- and when the
   field was the name, the level went with it. */
function text(value: unknown, limit: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || !maxLength(trimmed, limit)) return null;
  return trimmed;
}

/**
 * The rows that can be shown, in the order they were given.
 *
 * A row without a name is dropped: the name is the tab, and a tab with
 * nothing on it cannot be pressed. A field that is the wrong type or too
 * long is left out of its row rather than taking the row with it.
 */
export function parseStudyPaths(value: unknown): StudyPathEntry[] {
  if (!Array.isArray(value)) return [];
  const rows: StudyPathEntry[] = [];
  for (const item of value as unknown[]) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const name = text(row.name, STUDY_PATH_LIMITS.name);
    if (!name) continue;
    rows.push({
      name,
      duration: text(row.duration, STUDY_PATH_LIMITS.duration),
      entry: text(row.entry, STUDY_PATH_LIMITS.entry),
      summary: text(row.summary, STUDY_PATH_LIMITS.summary),
    });
    if (rows.length === MAX_STUDY_PATHS) break;
  }
  return rows;
}
