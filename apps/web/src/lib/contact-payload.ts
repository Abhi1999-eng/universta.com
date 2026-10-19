export function contactPayload(form: FormData) {
  return {
    ...Object.fromEntries(form),
    privacyConsent: form.get("privacyConsent") === "true",
  };
}

/** The longest Subject a link may fill in. */
export const SUBJECT_PREFILL_MAX = 150;

/**
 * The Subject a link asks the contact form to start with -- "Role: <title>"
 * from a role page -- as one plain line: control characters and tags taken
 * out, spaces collapsed, cut to a sensible length. Anything else is ignored.
 */
export function prefilledSubject(value: unknown): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string") return null;
  const line = raw
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!line) return null;
  return line.length > SUBJECT_PREFILL_MAX ? line.slice(0, SUBJECT_PREFILL_MAX).trimEnd() : line;
}
