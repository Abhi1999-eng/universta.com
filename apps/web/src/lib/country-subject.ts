/**
 * What a destination-and-subject page shows, and in what order.
 *
 * Small enough to inline and fiddly enough to get silently wrong, so it is
 * decided once here and tested rather than re-derived in each page.
 */

export type Specialization = {
  id: string;
  name: string;
  slug: string;
  publishedCourseCount?: number;
};

export type SubjectLink = { id: string; name: string; slug: string };

/**
 * Specializations with something published first, in descending count, then
 * the rest alphabetically.
 *
 * An empty specialization is not last because it is worse; it is last
 * because a reader clicking it finds nothing, and the ones that answer
 * should be the ones in reach. They stay on the page because the catalogue
 * covering a field unevenly is a fact about the catalogue, not a reason to
 * hide half a taxonomy.
 */
export function rankSpecializations<T extends Specialization>(
  rows: readonly T[],
  countOf: (row: T) => number = (row) => row.publishedCourseCount ?? 0,
): T[] {
  return [...rows].sort((left, right) => {
    const a = countOf(left);
    const b = countOf(right);
    if (a !== b) return b - a;
    return left.name.localeCompare(right.name);
  });
}

/** One destination's course count per specialization, by slug; null when
 *  it could not be read. */
export type CountsHere = ReadonlyMap<string, number> | null;

/**
 * How many courses one destination lists under each specialization of a
 * subject, by slug -- or null when that could not be read.
 *
 * The subject's own record counts its specializations across every
 * destination, and the destination's page printed those: "Strategic
 * Communication 7 courses" over a section that said the United Kingdom has
 * six courses in the whole subject, and Afghanistan, which has none, looked
 * as full as the UK. The course filters answer the question the page asks
 * -- this subject, this destination, per specialization -- so the counts
 * come from there.
 *
 * Null is not zero. When the read fails the page knows nothing about this
 * destination's specializations and says nothing, rather than falling back
 * to the worldwide figures that started this.
 */
export function specializationCountsHere(
  options: {
    subSubjects?: ReadonlyArray<{
      value: string;
      count: number;
      subject?: { slug: string } | null;
    }> | null;
  } | null,
  subjectSlug: string,
): CountsHere {
  if (!options?.subSubjects) return null;
  /* A specialization's slug is unique only inside its subject, so the
     filter's options can carry another subject's branch of the same name. */
  return new Map(
    options.subSubjects
      .filter(
        (option) => option.subject?.slug === subjectSlug && option.count > 0,
      )
      .map((option) => [option.value, option.count]),
  );
}

export function countrySubjectPage<
  S extends Specialization,
  O extends SubjectLink,
>(input: {
  specializations: readonly S[];
  others: readonly O[];
  subjectSlug: string;
  /** This destination's counts. Left out, the worldwide ones rank the list
   *  as they always did; null, nothing is counted and the list is A to Z. */
  countsHere?: CountsHere;
}): {
  specializations: Array<S & { here: number | null }>;
  /** How many of them have something listed here, when that is known. */
  taughtHere: number | null;
  others: O[];
} {
  const counts = input.countsHere;
  const here = (row: S) => (counts ? (counts.get(row.slug) ?? 0) : null);
  const ranked =
    counts === undefined
      ? rankSpecializations(input.specializations)
      : rankSpecializations(input.specializations, (row) => here(row) ?? 0);
  return {
    specializations: ranked.map((row) => ({ ...row, here: here(row) })),
    taughtHere: counts
      ? input.specializations.filter((row) => (counts.get(row.slug) ?? 0) > 0)
          .length
      : null,
    /* The subject being read is not one of the others, however the
       destination happens to have it listed. */
    others: input.others
      .filter((entry) => entry.slug !== input.subjectSlug)
      .slice(0, 8),
  };
}

/**
 * Whether a destination teaches a field, as far as the page can tell.
 *
 * "none" is the only answer that lets a page say so: both reads came back
 * and neither found a course. "unknown" -- both failed -- says nothing,
 * because a page that cannot reach the catalogue does not know that a
 * destination teaches nothing, and saying so would be a guess dressed as a
 * fact.
 */
export function programmesHere(
  levels: readonly unknown[] | null,
  courses: { data: readonly unknown[] } | null,
): 'levels' | 'list' | 'none' | 'unknown' {
  if (levels) return levels.length ? 'levels' : 'none';
  if (courses) return courses.data.length ? 'list' : 'none';
  return 'unknown';
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * The intakes a destination's courses in a field open in, as the figures
 * strip states them: the months themselves while there are few enough to
 * read at a glance, "5 intake months" once there are not. Months are
 * counted once however many intakes open in them, and in calendar order.
 */
export function intakeFigure(
  intakes: ReadonlyArray<{ label: string; startMonth: number | null; count: number }>,
): string | null {
  const months = new Map<string, number>();
  for (const intake of intakes) {
    if (intake.count <= 0) continue;
    const month = intake.startMonth;
    const known = month && month >= 1 && month <= 12;
    const key = known ? MONTHS[month - 1] : intake.label.trim();
    if (key && !months.has(key)) months.set(key, known ? month : 13);
  }
  if (!months.size) return null;
  if (months.size > 3) return `${months.size} intake months`;
  return [...months.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([label]) => label)
    .join(', ');
}

/** One cell of the figures strip under a destination-and-field heading. */
export type Figure = { label: string; value: string };

/**
 * The figures strip, from what this destination actually has: each figure
 * stands down on its own rather than printing a zero, and with nothing to
 * state there is no strip.
 */
export function figuresHere(input: {
  programmes: number | null;
  universities: number | null;
  specializations?: number | null;
  intakes: string | null;
}): Figure[] {
  const count = (value: number | null | undefined) =>
    value && value > 0 ? value.toLocaleString('en-GB') : null;
  /* "1 Programmes" read as a typo. */
  const label = (value: number | null | undefined, one: string, many: string) =>
    value === 1 ? one : many;
  return [
    {
      label: label(input.programmes, 'Programme', 'Programmes'),
      value: count(input.programmes),
    },
    {
      label: label(input.universities, 'University', 'Universities'),
      value: count(input.universities),
    },
    {
      label: label(input.specializations, 'Specialization taught', 'Specializations taught'),
      value: count(input.specializations),
    },
    { label: 'Intakes', value: input.intakes },
  ].filter((row): row is Figure => Boolean(row.value));
}

/**
 * An overview split into what is read straight away and what opens under
 * "More about…".
 *
 * The visible part runs up to and including the first paragraph, so a
 * heading travels with the paragraph under it. A first paragraph that only
 * repeats the short description -- which the hero has already printed --
 * is dropped rather than shown twice. Markup this cannot split cleanly is
 * left whole, in `rest`, and the page shows it the way it always did.
 */
export function overviewParts(
  html: string | null | undefined,
  shortDescription?: string | null,
): { lead: string | null; rest: string | null } {
  const value = html?.trim();
  if (!value) return { lead: null, rest: null };
  const blocks = value.match(
    /<(p|h[2-4]|ul|ol|blockquote)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
  );
  if (!blocks || blocks.join('').replace(/\s+/g, '') !== value.replace(/\s+/g, ''))
    return { lead: null, rest: value };
  const plain = (block: string) =>
    block.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const repeated = shortDescription?.replace(/\s+/g, ' ').trim();
  const kept =
    repeated && /^<p\b/i.test(blocks[0]) && plain(blocks[0]) === repeated
      ? blocks.slice(1)
      : blocks;
  const firstParagraph = kept.findIndex((block) => /^<p\b/i.test(block));
  if (firstParagraph < 0)
    return { lead: null, rest: kept.length ? kept.join('') : null };
  const lead = kept.slice(0, firstParagraph + 1).join('');
  const rest = kept.slice(firstParagraph + 1).join('');
  return { lead, rest: rest || null };
}

/**
 * Which subjects a destination's page shows, and whether they are its own.
 *
 * The links are derived from the courses published in a destination, so a
 * destination with no courses had no subjects and the page said so and
 * stopped. But the taxonomy is not per-country: the fields Universta knows
 * are the same everywhere, and what varies is which of them have programmes
 * behind them here. Falling back to the catalogue is what keeps a new
 * destination from being a dead end, and `listed` is how the page knows to
 * say the list is the catalogue's rather than its own.
 */
export function subjectsForCountry<T extends SubjectLink>(input: {
  linked: readonly T[];
  catalogue: readonly T[];
}): { subjects: T[]; listed: boolean } {
  return input.linked.length
    ? { subjects: [...input.linked], listed: true }
    : { subjects: [...input.catalogue], listed: false };
}
