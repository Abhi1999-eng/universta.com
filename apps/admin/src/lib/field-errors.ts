/**
 * Shared client-side helper for turning a save/publish failure into a
 * field-level error, plus scrolling and focusing the offending control.
 *
 * The API's exception filter (`AppExceptionFilter`) always returns
 * `{ code, message, details }`, but `details` is null for the catalog error
 * helpers in active use (`catalogConflict`/`catalogBadRequest` in
 * catalog.errors.ts) -- there is no per-field payload to read. `code` is
 * the only stable signal, so known codes are mapped explicitly here; for
 * everything else a small set of message-fragment heuristics is used as a
 * fallback so a real field name still gets highlighted where one is named
 * in the message. Anything that matches neither is left unmapped and must
 * be shown as a global message by the caller -- never silently attached to
 * the wrong field.
 */

export type BackendError = { code?: string; message?: string } | null | undefined;

/** Known error codes -> the form field(s) they belong to. Extend this map
 * as new typed codes are wired into field-level display; do not guess. */
const CODE_FIELD_MAP: Record<string, string[]> = {
  COURSE_MAPPING_SOURCE_REQUIRED: ['sourceReference', 'verifiedAt'],
  COURSE_MAPPING_SOURCE_INVALID: ['sourceReference'],
  COURSE_MAPPING_VERIFICATION_INVALID: ['verifiedAt'],
  COUNTRY_MAPPING_SOURCE_REQUIRED: ['sourceReference', 'verifiedAt'],
  COUNTRY_MAPPING_SOURCE_INVALID: ['sourceReference'],
  COUNTRY_MAPPING_VERIFICATION_INVALID: ['verifiedAt'],
};

/** Fallback for untyped/unmapped codes: a field name mentioned in the raw
 * message. Order matters -- first match wins. */
const MESSAGE_FIELD_HINTS: Array<[RegExp, string]> = [
  [/\bslug\b/i, 'slug'],
  [/\btitle\b/i, 'title'],
  [/\bname\b/i, 'name'],
  [/\buniversity\b/i, 'universityId'],
  [/\bcourse level\b/i, 'courseLevelId'],
  [/\bgeneric course\b|\bcourse\b/i, 'genericCourseId'],
  [/\bsubject\b/i, 'subjectId'],
  [/\bcountry\b/i, 'countryId'],
  [/\bhttps\b|\bsource\b/i, 'sourceReference'],
  [/\bverif/i, 'verifiedAt'],
];

/** Returns every field name a given backend error should attach to, or an
 * empty array when the error carries no identifiable field (a genuine
 * global/server error). */
export function fieldsForError(error: BackendError): string[] {
  if (!error) return [];
  if (error.code && CODE_FIELD_MAP[error.code]) return CODE_FIELD_MAP[error.code];
  const message = error.message ?? '';
  for (const [pattern, field] of MESSAGE_FIELD_HINTS) {
    if (pattern.test(message)) return [field];
  }
  return [];
}

/** Merges a backend error into an existing field-error map, attaching the
 * same message to every field the error maps to. Returns the merged map and
 * the first field name found (for scroll/focus), or null if unmapped. */
export function mergeBackendError(
  current: Record<string, string>,
  error: BackendError,
): { next: Record<string, string>; firstField: string | null } {
  const fields = fieldsForError(error);
  if (fields.length === 0) return { next: current, firstField: null };
  const message = error?.message ?? 'This value is invalid.';
  const next = { ...current };
  for (const field of fields) next[field] = message;
  return { next, firstField: fields[0] };
}

/** Scrolls to and focuses the control marked `data-field={name}`, opening
 * no containing tab/section by itself -- callers that have tabbed UI should
 * switch to the right tab before calling this. Returns whether a control
 * was found. */
export function scrollToAndFocusField(name: string): boolean {
  if (typeof document === 'undefined') return false;
  const el = document.querySelector<HTMLElement>(`[data-field="${name}"]`);
  if (!el) return false;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (typeof (el as HTMLInputElement).focus === 'function') {
    (el as HTMLInputElement).focus({ preventScroll: true });
  }
  return true;
}

/** Given a client-side or merged field-error map, returns the first field
 * name in insertion order, or null if the map is empty. */
export function firstFieldError(errors: Record<string, string>): string | null {
  const keys = Object.keys(errors);
  return keys.length ? keys[0] : null;
}
