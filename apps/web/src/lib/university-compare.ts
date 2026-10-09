/** The ZIP's university comparison holds five; other comparisons keep their own limits. */
export const UNIVERSITY_COMPARE_LIMIT = 5;

export type CompareUniversity = {
  name: string;
  slug: string;
  country: string | null;
  countrySlug: string | null;
  institutionType: string | null;
  shortDescription: string | null;
  campuses: number;
  offerings: number;
  accreditations: string[];
  verifiedAt: string | null;
  cities?: string[];
  qsRanking?: number | null;
};

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' ? value as Record<string, unknown> : null;
const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

export function universityCompareSlugs(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))]
    .slice(0, UNIVERSITY_COMPARE_LIMIT);
}

export function readUniversityCompareSlugs(params: Record<string, string | string[] | undefined>): string[] {
  const raw = params.items;
  return universityCompareSlugs((Array.isArray(raw) ? raw : raw ? [raw] : []).flatMap((value) => value.split(',')));
}

export function universityCompareHref(values: readonly string[]): string {
  const slugs = universityCompareSlugs(values);
  return slugs.length ? `/compare/universities?items=${slugs.map(encodeURIComponent).join(',')}` : '/compare/universities';
}

/** Only fields actually held by a university record; programme tuition is not a university fee. */
export function toCompareUniversity(value: unknown): CompareUniversity | null {
  const row = record(value);
  const name = text(row?.name);
  const slug = text(row?.slug);
  if (!row || !name || !slug) return null;
  const country = record(row.country);
  const counts = record(row._count);
  // A retired campus must not become the university's location or count.
  // Older read shapes omit state, so those still carry their recorded city.
  const campuses = (Array.isArray(row.campuses) ? row.campuses : []).filter((entry) => {
    const campus = record(entry);
    const status = text(campus?.status);
    return campus && !campus.deletedAt && (!status || status === 'ACTIVE');
  });
  const accreditations = Array.isArray(row.accreditations) ? row.accreditations : [];
  const ranking = typeof row.qsRanking === 'number' && Number.isInteger(row.qsRanking) && row.qsRanking > 0
    ? row.qsRanking : null;
  return {
    name, slug,
    country: text(country?.name),
    countrySlug: text(country?.slug),
    institutionType: text(row.institutionType),
    shortDescription: text(row.shortDescription),
    campuses: campuses.length,
    offerings: typeof counts?.offerings === 'number' && counts.offerings >= 0 ? counts.offerings : 0,
    accreditations: accreditations.flatMap((entry) => text(record(entry)?.name) ? [text(record(entry)?.name)!] : []),
    verifiedAt: text(row.verifiedAt),
    cities: [...new Set(campuses.flatMap((entry) => text(record(entry)?.city) ? [text(record(entry)?.city)!] : []))],
    qsRanking: ranking,
  };
}
