import type { CatalogMutationError } from "./catalog.types";

/**
 * What a rejected catalogue write actually said.
 *
 * The API answers a failed validation with a generic headline and the real
 * reasons underneath it:
 *
 *     { code: "VALIDATION_ERROR",
 *       message: "Invalid catalog request",
 *       details: [{ property: "subjectIds", message: "each value in
 *                   subjectIds must be a UUID" }] }
 *
 * Every editor but one showed only the headline, so an author was told
 * "Invalid catalog request" and left to guess which of two hundred fields
 * the server had objected to. The details were in the payload the whole
 * time. These read them out, named by field.
 */

export type CatalogFieldError = { field: string; label: string; message: string };

/** Field names the API uses that a person would not recognise on sight. */
const FIELD_LABELS: Record<string, string> = {
  subjectIds: "Subjects",
  subSubjectIds: "Specializations",
  tagIds: "Tags",
  popularUniversityIds: "Popular universities",
  popularCourseIds: "Popular courses",
  studyModeIds: "Study modes",
  courseLevelId: "Course level",
  subjectId: "Subject",
  subSubjectId: "Specialization",
  countryId: "Country",
  continentId: "Continent",
  stateId: "State",
  cityId: "City",
  universityId: "University",
  genericCourseId: "Generic course",
  intakeId: "Intake",
  providerId: "Provider",
  iso2Code: "ISO2 code",
  iso3Code: "ISO3 code",
  seoTitle: "SEO title",
  metaDescription: "Meta description",
  expectedUpdatedAt: "Record version",
};

/**
 * "tuitionMin" -> "Tuition min"; "faqs.0.question" -> "Faqs 0 question".
 * Only reached for a field with no entry above, so it is a fallback, not the
 * place to add names to.
 */
function humanise(property: string): string {
  const words = property
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .join(" ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    // Sentence case, the way the editors label their own fields: "Tuition
    // min", not "Tuition Min".
    .toLowerCase();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : property;
}

export function catalogFieldLabel(property: string): string {
  return FIELD_LABELS[property] ?? humanise(property);
}

/** The per-field reasons behind a rejected write, in the order sent. */
export function catalogFieldErrors(cause: unknown): CatalogFieldError[] {
  const typed = cause as Partial<CatalogMutationError>;
  if (!Array.isArray(typed?.details)) return [];
  const seen = new Set<string>();
  const errors: CatalogFieldError[] = [];
  for (const item of typed.details) {
    if (!item || typeof item !== "object") continue;
    const detail = item as { property?: unknown; message?: unknown };
    if (typeof detail.message !== "string" || !detail.message.trim()) continue;
    const field = typeof detail.property === "string" ? detail.property : "";
    const key = `${field}:${detail.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    errors.push({
      field,
      label: field ? catalogFieldLabel(field) : "",
      message: detail.message.trim(),
    });
  }
  return errors;
}

/**
 * One line per field, each naming the field it is about.
 *
 * The server's own wording often repeats the raw property name ("each value
 * in subjectIds must be a UUID"), so the label is only prefixed when it adds
 * something the sentence does not already say.
 */
export function catalogErrorLines(cause: unknown): string[] {
  return catalogFieldErrors(cause).map(({ field, label, message }) => {
    if (!label) return message;
    const alreadyNamed =
      message.includes(field) || message.toLowerCase().includes(label.toLowerCase());
    return alreadyNamed ? message : `${label}: ${message}`;
  });
}

/**
 * The whole thing as one string, for the many places that show a single
 * line. Falls back to the headline, then to the thrown error, then to the
 * caller's wording.
 */
export function catalogErrorText(cause: unknown, fallback: string): string {
  const lines = catalogErrorLines(cause);
  if (lines.length) return lines.join(" · ");
  const typed = cause as Partial<CatalogMutationError>;
  return typed?.message ?? (cause instanceof Error ? cause.message : fallback);
}

/**
 * Why a subject cannot be deleted for good, from the counts the API sends
 * with SUBJECT_IN_USE: the courses that still use it, and the deleted ones
 * that still point at it. A deleted course is kept in the database and the
 * admin lists none, so "referenced by courses" alone sent editors looking
 * for courses that were nowhere to be seen. Null for any other failure, or
 * when the counts are missing, so the caller falls back to the headline.
 */
export function subjectInUseText(cause: unknown): string | null {
  const typed = cause as Partial<CatalogMutationError>;
  if (typed?.code !== "SUBJECT_IN_USE") return null;
  const details = (typed.details ?? null) as {
    liveCourses?: unknown;
    deletedCourses?: unknown;
  } | null;
  const live = details?.liveCourses;
  const deleted = details?.deletedCourses;
  if (typeof live !== "number" || typeof deleted !== "number") return null;
  const lines: string[] = [];
  if (live > 0)
    lines.push(
      live === 1
        ? "1 course still uses this subject. Move it to another subject first."
        : `${live} courses still use this subject. Move them to another subject first.`,
    );
  if (deleted > 0)
    lines.push(
      deleted === 1
        ? "1 deleted course still points at this subject; it must be removed from the database first."
        : `${deleted} deleted courses still point at this subject; they must be removed from the database first.`,
    );
  return lines.length ? lines.join(" ") : null;
}
