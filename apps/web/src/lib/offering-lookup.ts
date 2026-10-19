/**
 * Which of a university's programmes an address under its courses names.
 *
 * The full slug answers first. The behaviour reference addresses a course
 * by its short name -- .../courses/msc-computer-science -- where this
 * catalogue's slugs carry the university as well, and they carry it in two
 * spellings: the older "<university>-<course>" and the admin's
 * "<course>-at-the-<university>". Both are tried. Failing those, the short
 * name is read as the course the programme is an instance of: the
 * university's one live programme of that course is the page meant. Two or
 * more are not guessed between, and the address stays a 404.
 *
 * The page redirects permanently to whatever slug answers, so every short
 * form ends up on the one canonical address.
 */

type Row = Record<string, unknown>;

export type OfferingLookup = {
  /** The programme with this exact slug at the university, or null. */
  load: (universitySlug: string, offeringSlug: string) => Promise<Row | null>;
  /** The slugs of the university's live programmes of a course, by the
   *  course's own slug: up to two, which is enough to tell one from many. */
  ofCourse: (universitySlug: string, courseSlug: string) => Promise<string[]>;
};

export function shortOfferingSlugs(universitySlug: string, offeringSlug: string) {
  const tried: string[] = [];
  if (!offeringSlug.startsWith(`${universitySlug}-`))
    tried.push(`${universitySlug}-${offeringSlug}`);
  if (!offeringSlug.endsWith(`-at-the-${universitySlug}`))
    tried.push(`${offeringSlug}-at-the-${universitySlug}`);
  return tried;
}

export async function findOffering(
  universitySlug: string,
  offeringSlug: string,
  lookup: OfferingLookup,
): Promise<Row | null> {
  const exact = await lookup.load(universitySlug, offeringSlug);
  if (exact) return exact;
  for (const slug of shortOfferingSlugs(universitySlug, offeringSlug)) {
    const row = await lookup.load(universitySlug, slug);
    if (row) return row;
  }
  const matches = await lookup.ofCourse(universitySlug, offeringSlug).catch(() => []);
  if (matches.length !== 1 || matches[0] === offeringSlug) return null;
  return lookup.load(universitySlug, matches[0]!);
}

/** The programmes API's answer reduced to the slugs it lists. */
export function programmeSlugs(answer: unknown): string[] {
  const rows = (answer as { data?: unknown } | null)?.data;
  const total = (answer as { meta?: { total?: unknown } } | null)?.meta?.total;
  const slugs = (Array.isArray(rows) ? rows : []).flatMap((row) => {
    const slug = (row as Row | null)?.slug;
    return typeof slug === 'string' && slug ? [slug] : [];
  });
  /* A total above what was read means more than one, whatever was read. */
  return typeof total === 'number' && total > slugs.length ? [...slugs, ''] : slugs;
}
