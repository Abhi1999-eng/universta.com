/**
 * What four study levels were called before the catalogue took the client's
 * names for them (migration 20261005090000_course_level_names).
 *
 * A bulk sheet names a level by its code or by its name, and a downloaded
 * sheet writes the name -- so every sheet downloaded before the rename says
 * "Undergraduate" where the level is now "Bachelor's". Without these, such a
 * sheet stopped importing the day the names changed. A name a level actually
 * has is always tried first; these are only the fallback.
 */
const FORMER_LEVEL_NAMES: Readonly<Record<string, string>> = {
  undergraduate: 'UG',
  postgraduate: 'PG',
  'master of business administration': 'MBA',
  'doctor of philosophy': 'PHD',
};

/** The code a former level name stands for, or null. */
export function formerLevelCode(
  term: string | null | undefined,
): string | null {
  return FORMER_LEVEL_NAMES[term?.trim().toLowerCase() ?? ''] ?? null;
}

/** Every former name with the code it now resolves to. */
export function formerLevelNames(): Array<{ name: string; code: string }> {
  return Object.entries(FORMER_LEVEL_NAMES).map(([name, code]) => ({
    name,
    code,
  }));
}
