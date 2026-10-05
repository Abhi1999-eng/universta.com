import { richTextToPlainText } from '@/components/phase1/RichText';
import { formatNumber } from '@/lib/format';

/**
 * What a university's page works out from its record before it draws
 * anything: which courses lead, which subjects it is strongest in, how its
 * overview divides into the design's numbered highlights, and what its
 * offerings say about intakes and fees.
 *
 * Kept apart from the page so each rule can be tested on its own, and so
 * the rule is written once rather than inside a component's markup.
 */

/** The parts of an offering these rules read. */
export type ProfileOffering = {
  name: string;
  subject: { name: string; slug: string } | null;
  courseLevel: {
    code: string | null;
    name: string;
    /** The level's place in the catalogue's order of levels, if known. */
    order?: number | null;
  } | null;
  tuition?: {
    min: string | null;
    max: string | null;
    currencyCode: string | null;
    period: string | null;
  } | null;
  intakes?: Array<{
    key: string;
    name: string;
    month: number | null;
    deadline: string | null;
  }>;
};

/** How many of a university's courses its own page shows. The behaviour
 * reference shows six and sends the rest to the full list. */
export const COURSES_SHOWN = 6;

/** How many subjects the "Popular subjects here" row names. */
export const SUBJECT_CHIPS_SHOWN = 8;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function monthName(month: number | null | undefined) {
  return month && month >= 1 && month <= 12 ? MONTHS[month - 1]! : null;
}

/**
 * The order a university's courses are shown in.
 *
 * Bachelor's first, because that is where the behaviour reference starts
 * (Oxford's six are all undergraduate; Toronto's BSc leads two MScs). After
 * it, the other levels in the catalogue's own order of levels -- the order
 * the client set and Admin keeps -- and A to Z inside each level, so the
 * same university lists the same way on every visit. The catalogue's own
 * display order was 0 on every offering, which made the old order
 * whatever the database returned.
 */
export function orderOfferings<T extends ProfileOffering>(
  offerings: readonly T[],
  nameOf: (offering: T) => string = (offering) => offering.name,
): T[] {
  const rank = (offering: T) => {
    const level = offering.courseLevel;
    if (!level) return [2, Number.MAX_SAFE_INTEGER] as const;
    if (level.code === 'UG') return [0, 0] as const;
    return [1, level.order ?? Number.MAX_SAFE_INTEGER] as const;
  };
  return [...offerings].sort((left, right) => {
    const [leftGroup, leftOrder] = rank(left);
    const [rightGroup, rightOrder] = rank(right);
    if (leftGroup !== rightGroup) return leftGroup - rightGroup;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    const byLevel = (left.courseLevel?.name ?? '').localeCompare(
      right.courseLevel?.name ?? '',
    );
    if (byLevel) return byLevel;
    return nameOf(left).localeCompare(nameOf(right));
  });
}

/**
 * The subjects a university teaches most, with how many of its courses sit
 * in each: the zip's "Popular subjects here" row. Counted from the courses
 * on the page, so a chip never claims a subject the list below it does not
 * show.
 */
export function popularSubjects(
  offerings: readonly ProfileOffering[],
  limit = SUBJECT_CHIPS_SHOWN,
): Array<{ name: string; slug: string; count: number }> {
  const counts = new Map<string, { name: string; slug: string; count: number }>();
  for (const offering of offerings) {
    const subject = offering.subject;
    if (!subject?.slug) continue;
    const entry = counts.get(subject.slug) ?? { ...subject, count: 0 };
    entry.count += 1;
    counts.set(subject.slug, entry);
  }
  return [...counts.values()]
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
    .slice(0, limit);
}

/** The degree levels a university's courses run at, in the order above. */
export function levelsTaught(offerings: readonly ProfileOffering[]) {
  const seen = new Map<string, number>();
  for (const offering of orderOfferings(offerings)) {
    const name = offering.courseLevel?.name;
    if (name) seen.set(name, (seen.get(name) ?? 0) + 1);
  }
  return [...seen.entries()].map(([name, count]) => ({ name, count }));
}

const normalise = (text: string) => text.replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * An overview split the way the design lays one out: an opening, then
 * numbered highlights.
 *
 * Every overview in the catalogue is written as a run of paragraphs broken
 * up by sub-headings ("What it is strong in", "Being taught here"...), and
 * almost every one opens with the same sentence as the university's short
 * description -- which the hero has already shown, and which the section
 * head shows again as its lead. Printed whole under that lead, the page
 * said its first sentence three times in a row.
 *
 * So the opening paragraph is dropped when it only repeats the short
 * description, and each sub-heading becomes one of the design's numbered
 * highlights with the text under it as its body. Nothing else is cut: an
 * overview without sub-headings comes back as one opening, as it was.
 */
export function splitOverview(
  html: string,
  shortDescription: string | null,
): { intro: string | null; highlights: Array<{ title: string; body: string }> } {
  const parts = html.split(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
  let intro = parts[0] ?? '';
  const highlights: Array<{ title: string; body: string }> = [];
  for (let index = 1; index < parts.length; index += 2) {
    const title = richTextToPlainText(parts[index] ?? '');
    const body = (parts[index + 1] ?? '').trim();
    if (title) highlights.push({ title, body });
    /* A heading with nothing readable in it keeps its text where it was. */
    else intro += body;
  }

  if (shortDescription) {
    const opening = intro.match(/^\s*<p[^>]*>([\s\S]*?)<\/p>/i);
    if (
      opening &&
      normalise(richTextToPlainText(opening[0])) === normalise(shortDescription)
    )
      intro = intro.slice(opening[0].length);
  }
  const rest = intro.trim();
  return {
    intro: rest && richTextToPlainText(rest) ? rest : null,
    highlights,
  };
}

/** "GBP 24,000–36,000", or the single figure when there is no range. */
export function moneyRange(
  min: string | number | null | undefined,
  max: string | number | null | undefined,
  currencyCode: string | null | undefined,
) {
  const low = formatNumber(min ?? null);
  if (!low) return null;
  const high = formatNumber(max ?? null);
  const amount = high && high !== low ? `${low}–${high}` : low;
  return [currencyCode, amount].filter(Boolean).join(' ');
}

/** "per year", "per semester", "in total"; nothing for a period not named. */
export function tuitionPeriod(value: string | null | undefined) {
  return (
    (
      {
        PER_YEAR: 'per year',
        PER_SEMESTER: 'per semester',
        PER_MONTH: 'per month',
        TOTAL: 'in total',
      } as Record<string, string>
    )[value ?? ''] ?? null
  );
}

/**
 * What a year costs at this university, level by level, from the fees its
 * courses record. A level appears only when at least one of its courses
 * states a fee, and it says how many of its courses that is, so a range
 * read off two courses out of nine does not pass for the whole level.
 */
export function tuitionByLevel(offerings: readonly ProfileOffering[]) {
  const rows = new Map<
    string,
    {
      level: string;
      currencyCode: string | null;
      period: string | null;
      min: number;
      max: number;
      priced: number;
      courses: number;
    }
  >();
  const perLevel = new Map<string, number>();
  for (const offering of offerings)
    if (offering.courseLevel)
      perLevel.set(
        offering.courseLevel.name,
        (perLevel.get(offering.courseLevel.name) ?? 0) + 1,
      );
  for (const offering of orderOfferings(offerings)) {
    const tuition = offering.tuition;
    const low = Number(tuition?.min);
    if (!tuition?.min || !Number.isFinite(low) || !offering.courseLevel) continue;
    const high = Number(tuition.max);
    const level = offering.courseLevel.name;
    /* A level priced in two currencies is two rows: adding pounds to euros
       would make a range that is true of neither. */
    const key = `${level}|${tuition.currencyCode ?? ''}|${tuition.period ?? ''}`;
    const row = rows.get(key) ?? {
      level,
      currencyCode: tuition.currencyCode,
      period: tuition.period,
      min: low,
      max: low,
      priced: 0,
      courses: perLevel.get(level) ?? 0,
    };
    row.min = Math.min(row.min, low);
    row.max = Math.max(row.max, Number.isFinite(high) && high > 0 ? high : low);
    row.priced += 1;
    rows.set(key, row);
  }
  return [...rows.values()];
}

/**
 * The intakes a university's courses list, one entry per intake, with how
 * many courses start in it and the next deadline any of them records.
 *
 * The next deadline is the earliest one still to come. A deadline that has
 * gone by is not a date anyone can still apply to, and taking the earliest
 * of all of them hid the courses still open behind one already closed. Only
 * when every deadline in the intake has passed is the last of them kept,
 * marked as passed -- the rule the course's own page follows.
 */
export function intakeSummary(
  offerings: readonly ProfileOffering[],
  today: Date = new Date(),
) {
  /* Deadlines are dates; compared as YYYY-MM-DD, a deadline of today is
     still open, whatever time of day the record was stamped with. */
  const floor = today.toISOString().slice(0, 10);
  const intakes = new Map<
    string,
    {
      key: string;
      name: string;
      month: number | null;
      courses: number;
      deadlines: string[];
    }
  >();
  for (const offering of offerings) {
    for (const intake of offering.intakes ?? []) {
      const entry = intakes.get(intake.key) ?? {
        key: intake.key,
        name: intake.name,
        month: intake.month,
        courses: 0,
        deadlines: [],
      };
      entry.courses += 1;
      if (intake.deadline) entry.deadlines.push(intake.deadline);
      intakes.set(intake.key, entry);
    }
  }
  return [...intakes.values()]
    .map(({ deadlines, ...entry }) => {
      const sorted = [...deadlines].sort();
      const upcoming = sorted.find((value) => value.slice(0, 10) >= floor);
      const deadline = upcoming ?? sorted[sorted.length - 1] ?? null;
      return { ...entry, deadline, passed: Boolean(deadline && !upcoming) };
    })
    .sort(
      (left, right) =>
        (left.month ?? 13) - (right.month ?? 13) || left.name.localeCompare(right.name),
    );
}

/** "1 May 2027", fixed to UTC so the server and the browser agree. The
 * course list and the course pages write their dates with the same rule. */
export { dateLabel as deadlineLabel } from './university-courses';

/** "Full time" for FULL_TIME: the catalogue stores the code, not the words. */
export function studyModeLabel(value: string | null | undefined) {
  if (!value) return null;
  const words = value.toLowerCase().replace(/_/g, ' ').trim();
  return words ? words[0]!.toUpperCase() + words.slice(1) : null;
}

