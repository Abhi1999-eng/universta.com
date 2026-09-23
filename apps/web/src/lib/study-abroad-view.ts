import type { CountryPage, ProfileSummary } from './countries';
import type { Destination } from './study-abroad';
import type { StudyPath } from '@/components/study-abroad/CountrySections';

/**
 * Turning the country bundle into the rows and cards the approved design shows.
 *
 * Every value here comes from a published figure. Where a figure is missing the
 * row is omitted rather than filled with an estimate, which is what keeps the
 * snapshot panel from ever being half empty — the same rule the rest of the
 * country experience already follows.
 */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function monthNames(months: number[]): string[] {
  return months
    .filter((month) => Number.isInteger(month) && month >= 1 && month <= 12)
    .sort((a, b) => a - b)
    .map((month) => MONTHS[month - 1]);
}

function money(symbol: string, value: string | null | undefined): string | null {
  if (!value) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return `${symbol}${Math.round(numeric).toLocaleString('en-US')}`;
}

function range(
  symbol: string,
  min: string | null | undefined,
  max: string | null | undefined,
): string | null {
  const low = money(symbol, min);
  const high = money(symbol, max);
  if (low && high && low !== high) return `${low} – ${high}`;
  return low ?? high;
}

export type SnapshotRow = { label: string; value: string; note?: string };

/** The "Country snapshot" panel: only rows with a published figure behind them. */
export function countrySnapshot(page: CountryPage): SnapshotRow[] {
  const { country, profiles } = page;
  const symbol = country.currency?.symbol ?? '';
  const rows: SnapshotRow[] = [];

  const tuition = range(symbol, profiles.cost?.tuitionMin, profiles.cost?.tuitionMax);
  if (tuition)
    rows.push({
      label: 'Typical tuition',
      value: tuition,
      note: 'Per year, international rate',
    });

  /* Living costs are published per month; the design shows a yearly figure, so
   * the period is honoured rather than assumed. */
  const livingPeriod = profiles.cost?.livingCostPeriod ?? 'PER_MONTH';
  const multiplier = livingPeriod === 'PER_MONTH' ? 12 : 1;
  const livingMin = profiles.cost?.livingCostMin
    ? String(Number(profiles.cost.livingCostMin) * multiplier)
    : null;
  const livingMax = profiles.cost?.livingCostMax
    ? String(Number(profiles.cost.livingCostMax) * multiplier)
    : null;
  const living = range(symbol, livingMin, livingMax);
  if (living)
    rows.push({ label: 'Typical living cost', value: living, note: 'Per year, indicative' });

  const intakes = monthNames(country.configuration?.intakeMonths ?? []);
  /* No note naming a primary. Nothing marks one -- the editor states intakes
     as months and nothing more -- so this called the earliest month in the
     year the primary intake, which is an order, not a fact, and the cards
     below it badged that same month "Secondary". */
  if (intakes.length)
    rows.push({ label: 'Main intakes', value: intakes.join(' · ') });

  if (country.officialLanguage)
    rows.push({
      label: 'Language',
      value: country.officialLanguage,
      note: acceptedTestsNote(country),
    });

  if (profiles.work?.postStudyWorkAvailable || profiles.work?.partTimeAllowed) {
    const hours = profiles.work?.partTimeHoursPerWeek;
    const notes: string[] = [];
    if (profiles.work?.partTimeAllowed && hours) notes.push(`${Number(hours)} hrs/week in term`);
    if (profiles.work?.postStudyWorkAvailable) notes.push('post-study work available');
    rows.push({
      label: 'Work options',
      value: 'Available',
      note: notes.length ? notes.join(', ') : undefined,
    });
  }

  if (country.capitalCity) rows.push({ label: 'Capital', value: country.capitalCity });

  return rows;
}

function acceptedTestsNote(country: CountryPage['country']): string | undefined {
  const tests = country.configuration?.acceptedTests ?? [];
  if (!tests.length) return undefined;
  return tests.map((test) => test.label).join(' · ');
}

export type WorkCard = { title: string; value: string | null; body: string | null };

/** The work and visa cards, each one only rendered when it has something to say. */
export function workSummary(profiles: ProfileSummary): WorkCard[] {
  const work = profiles.work;
  if (!work) return [];
  const cards: WorkCard[] = [];

  if (work.visaType)
    cards.push({
      title: 'Student visa',
      value: work.visaProcessingTime
        ? `${work.visaType} · ${work.visaProcessingTime} processing`
        : work.visaType,
      body: work.visaInformation ?? null,
    });

  if (work.partTimeAllowed) {
    /* Both hour figures the editor enters, not just the term-time one: a
       destination that allows full-time work in the holidays says so. */
    const term = work.partTimeHoursPerWeek
      ? `${Number(work.partTimeHoursPerWeek)} hours a week`
      : null;
    const breaks = work.partTimeHoursDuringBreaks
      ? `${Number(work.partTimeHoursDuringBreaks)} in breaks`
      : null;
    cards.push({
      title: 'Work while you study',
      value: [term, breaks].filter(Boolean).join(' · ') || 'Permitted',
      body: work.partTimeSummary ?? null,
    });
  }

  if (work.postStudyWorkAvailable) {
    const months = work.postStudyWorkMaxMonths ?? work.postStudyWorkMinMonths;
    cards.push({
      title: 'Post-study work',
      value: months ? `${months} months` : 'Available',
      body: work.postStudyWorkSummary ?? null,
    });
  }

  if (work.immigrationPathwayStrength)
    cards.push({
      title: 'Route to residency',
      value: `${work.immigrationPathwayStrength.toLowerCase()} pathway`,
      body: work.immigrationPathwaySummary ?? null,
    });

  if (work.proofOfFundsSummary)
    cards.push({ title: 'Proof of funds', value: null, body: work.proofOfFundsSummary });

  return cards;
}

/**
 * The study-path tabs.
 *
 * The levels come from what the catalogue actually publishes for this country,
 * so a destination with no postgraduate courses does not advertise a
 * postgraduate tab. Durations are the conventional ones for the level and are
 * labelled as typical, not as a promise about any particular programme.
 */
const LEVELS: Array<{ id: string; label: string; duration: string; entry: string; summary: string }> = [
  {
    id: 'bachelors',
    label: "Bachelor's",
    duration: '3–4 years',
    entry: 'School leaving qualification',
    summary: 'Undergraduate study, usually beginning straight after school.',
  },
  {
    id: 'masters',
    label: "Master's",
    duration: '1–2 years',
    entry: "Bachelor's degree",
    summary: "Postgraduate study after a bachelor's degree, taught or research-led, often ending in a thesis.",
  },
  {
    id: 'mba',
    label: 'MBA',
    duration: '1–2 years',
    entry: "Bachelor's degree, often with experience",
    summary: 'A postgraduate business degree, usually asking for work experience alongside a first degree.',
  },
  {
    id: 'phd',
    label: 'PhD',
    duration: '3–5 years',
    entry: "Master's degree or equivalent",
    summary: 'Doctoral research under supervision, leading to a thesis.',
  },
];

export function studyPathsFor(page: CountryPage): StudyPath[] {
  const statistics = page.country.statistics as
    | Record<string, number | null>
    | null
    | undefined;
  const derived = (page.country as { derived?: { statistics?: Record<string, number | null> } })
    .derived?.statistics;
  const counts: Record<string, number | null> = {
    bachelors: statistics?.ugCoursesCount ?? derived?.ugCoursesCount ?? null,
    masters: statistics?.pgCoursesCount ?? derived?.pgCoursesCount ?? null,
    mba: statistics?.mbaCoursesCount ?? derived?.mbaCoursesCount ?? null,
    phd: statistics?.phdCoursesCount ?? derived?.phdCoursesCount ?? null,
  };

  /* With no published course counts the tabs still describe the levels, because
   * the entry requirements and durations are useful on their own. */
  return LEVELS.map((level) => ({
    id: level.id,
    label: level.label,
    duration: level.duration,
    entry: level.entry,
    summary: level.summary,
    note: null,
    courseCount: counts[level.id] ?? null,
  }));
}

/**
 * Which sections get the paper band, by position.
 *
 * A guide alternates paper and white, and that alternation is positional: it
 * belongs to the run of sections, not to any one of them. It cannot be
 * assigned statically here because the editorial run differs in length per
 * country and most sections stand down when the country has nothing to put in
 * them, so any fixed choice reads correctly on one country and puts two
 * identical bands side by side on the next.
 *
 * Callers pass the ids that will actually render, in order, leaving out the
 * navy bands: those separate whatever sits either side of them, so the two
 * neighbours may share a colour.
 */
export function alternatingBands(renderedIds: string[]): (id: string) => boolean {
  const bands = new Map(renderedIds.map((id, index) => [id, index % 2 === 0]));
  return (id: string) => bands.get(id) ?? false;
}

/** Lower-cased with accents dropped, so "cote" finds Côte d'Ivoire. */
function normalise(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * The header selector's search, matched the way the approved design matches.
 *
 * A name matches from the start of any of its words, so "zea" finds New
 * Zealand and "bissau" finds Guinea-Bissau; the ISO code matches exactly, and
 * the slug from its start. Matching anywhere inside a name made "ger" return
 * Algeria, Niger and Nigeria beside Germany. Destinations with a guide come
 * first because those are the ones the student can open.
 *
 * With no query the list is the guides, in the order the directory gives them.
 */
export function searchDestinations<
  T extends Pick<Destination, 'name' | 'slug' | 'iso2Code' | 'isAvailable'>,
>(entries: T[], query: string): T[] {
  const needle = normalise(query.trim());
  if (!needle) return entries.filter((entry) => entry.isAvailable);
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const wordStart = new RegExp(`(^|[^a-z0-9])${escaped}`);
  return entries
    .filter(
      (entry) =>
        wordStart.test(normalise(entry.name)) ||
        normalise(entry.iso2Code ?? '') === needle ||
        normalise(entry.slug ?? '').startsWith(needle),
    )
    .sort(
      (a, b) => Number(b.isAvailable) - Number(a.isAvailable) || a.name.localeCompare(b.name),
    );
}

/**
 * The guide's section numbers, by position: "01", "02" and so on.
 *
 * The design numbers its run of sections from 01. Like the bands, the numbers
 * belong to the run rather than to any one section -- a number fixed to a
 * section would skip wherever a section before it stands down -- so the page
 * passes the numbered sections that will actually render, in order.
 */
export function sectionNumbers(ids: string[]): (id: string) => string | null {
  const numbers = new Map(ids.map((id, index) => [id, String(index + 1).padStart(2, '0')]));
  return (id: string) => numbers.get(id) ?? null;
}

const PERIOD_UNIT: Record<string, string> = {
  PER_YEAR: 'per year',
  PER_MONTH: 'per month',
  PER_TERM: 'per term',
  ONE_TIME: 'one time',
};

export type CostRow = { label: string; value: string; unit: string | null };
export type CostBreakdown = {
  total: string | null;
  rows: CostRow[];
  /** What the yearly total is made of, each part a yearly range; empty when
   * there is no total. */
  parts: Array<{ label: string; value: string }>;
};

/**
 * The cost dashboard: one row per published range, and a yearly total only
 * when both halves of it are published in periods that convert to a year.
 * A total built from one half would understate the cost, so it is left out.
 */
export function costBreakdown(cost: ProfileSummary['cost']): CostBreakdown {
  if (!cost) return { total: null, rows: [], parts: [] };
  const symbol = cost.currencySymbol ?? '';
  const livingPeriod = cost.livingCostPeriod ?? 'PER_MONTH';
  const rows: CostRow[] = [];
  const add = (label: string, min?: string | null, max?: string | null, period?: string) => {
    const value = range(symbol, min, max);
    if (value) rows.push({ label, value, unit: period ? (PERIOD_UNIT[period] ?? null) : null });
  };
  add('Tuition', cost.tuitionMin, cost.tuitionMax, cost.tuitionPeriod);
  add('Living expenses', cost.livingCostMin, cost.livingCostMax, livingPeriod);
  add('Application fee', cost.applicationFeeMin, cost.applicationFeeMax, 'ONE_TIME');

  const yearly = { PER_YEAR: 1, PER_MONTH: 12 } as Record<string, number>;
  const tuitionFactor = yearly[cost.tuitionPeriod];
  const livingFactor = yearly[livingPeriod];
  const bound = (value: string | null | undefined, factor: number) =>
    value && Number.isFinite(Number(value)) ? Number(value) * factor : null;
  let total: string | null = null;
  const parts: CostBreakdown['parts'] = [];
  if (tuitionFactor && livingFactor) {
    const tuitionLow = bound(cost.tuitionMin ?? cost.tuitionMax, tuitionFactor);
    const tuitionHigh = bound(cost.tuitionMax ?? cost.tuitionMin, tuitionFactor);
    const livingLow = bound(cost.livingCostMin ?? cost.livingCostMax, livingFactor);
    const livingHigh = bound(cost.livingCostMax ?? cost.livingCostMin, livingFactor);
    if (tuitionLow !== null && tuitionHigh !== null && livingLow !== null && livingHigh !== null) {
      total = range(symbol, String(tuitionLow + livingLow), String(tuitionHigh + livingHigh));
      parts.push(
        { label: 'Tuition', value: range(symbol, String(tuitionLow), String(tuitionHigh))! },
        { label: 'Living', value: range(symbol, String(livingLow), String(livingHigh))! },
      );
    }
  }
  return { total, rows, parts };
}

export type LanguageRow = {
  test: string;
  requirement: { label: string; tone: 'req' | 'ok' | 'cond' | 'neutral' };
  minimum: string | null;
  notes: string | null;
};

const REQUIREMENT: Record<string, LanguageRow['requirement']> = {
  REQUIRED: { label: 'Required', tone: 'req' },
  OPTIONAL: { label: 'Accepted', tone: 'ok' },
  VARIES: { label: 'Varies by programme', tone: 'cond' },
  NOT_REQUIRED: { label: 'Not required', tone: 'neutral' },
};

/** The language table: one row per English test the profile says anything about. */
export function languageRows(language: ProfileSummary['language']): LanguageRow[] {
  if (!language) return [];
  const tests: Array<[string, string | undefined, string | null | undefined, string | null | undefined]> = [
    ['IELTS Academic', language.ieltsRequirement, language.ieltsMinScore, language.ieltsNotes],
    ['TOEFL iBT', language.toeflRequirement, language.toeflMinScore, language.toeflNotes],
    ['PTE Academic', language.pteRequirement, language.pteMinScore, language.pteNotes],
    ['Duolingo English Test', language.duolingoRequirement, language.duolingoMinScore, language.duolingoNotes],
  ];
  return tests
    .filter(([, requirement]) => requirement && REQUIREMENT[requirement])
    .map(([test, requirement, minimum, notes]) => ({
      test,
      requirement: REQUIREMENT[requirement!],
      minimum: minimum ? String(Number(minimum)) : null,
      notes: notes ?? null,
    }));
}

export type IntakeCard = {
  id: string;
  name: string;
  /** The month teaching starts, 1-12, for placing the intake on the timeline. */
  month: number | null;
  primary: boolean;
  starts: string | null;
  opening: string | null;
  deadline: string | null;
  notes: string | null;
};

type IntakeEntry = ProfileSummary['intakes'][number] & {
  isMajor?: boolean;
  applicationOpeningMonth?: number | null;
  applicationDeadlineMonth?: number | null;
};

/**
 * The intake cards. The primary intake is the one the editor marked major;
 * application timing prefers the editor's note and falls back to the month.
 */
export function intakeCards(intakes: ProfileSummary['intakes'] | undefined): IntakeCard[] {
  return ((intakes ?? []) as IntakeEntry[]).map((entry) => {
    const intake = entry.intake ?? entry;
    const start = intake.startMonth ? monthNames([intake.startMonth])[0] : null;
    const end = intake.endMonth ? monthNames([intake.endMonth])[0] : null;
    const month = (value: number | null | undefined) => (value ? monthNames([value])[0] : null);
    return {
      id: entry.id,
      name: intakeTitle(intake.name),
      month: intake.startMonth ?? null,
      primary: Boolean(entry.isMajor),
      starts: start ? (end && end !== start ? `${start} – ${end}` : start) : null,
      opening: entry.applicationOpeningNote ?? month(entry.applicationOpeningMonth),
      deadline: entry.applicationDeadlineNote ?? month(entry.applicationDeadlineMonth),
      notes: entry.notes ?? null,
    };
  });
}

/**
 * How many columns a row of steps takes on a wide screen. The layout used to
 * be six columns whatever the count, so three visa steps left half the width
 * empty and eight application steps wrapped six and two. Up to five sit on
 * one row; beyond that, rows of four or three, whichever divides evenly.
 */
export function journeyColumns(count: number): number {
  if (count <= 5) return Math.max(count, 1);
  if (count % 4 === 0) return 4;
  if (count % 3 === 0) return 3;
  return 4;
}

/* An intake record named for its month alone ("September") is titled the way
   the cards for selected months without a record are ("February intake"), so
   one guide never shows both styles side by side. */
const MONTH_ONLY =
  /^(january|february|march|april|may|june|july|august|september|october|november|december)$/i;
function intakeTitle(name: string): string {
  const trimmed = name.trim();
  return MONTH_ONLY.test(trimmed) ? `${trimmed} intake` : name;
}

/**
 * The intakes a guide shows: the months the editor selected for the country,
 * each with its intake record's details where one exists.
 *
 * The month selection is what the country editor edits, so it decides which
 * intakes appear. The intake records are not edited there; they only enrich a
 * selected month with a name, a primary flag and application timing. A record
 * for a month the editor did not select is left out, and a selected month with
 * no record still gets its card. With no selection at all, the records stand
 * on their own.
 */
export function guideIntakes(selectedMonths: number[] | undefined, records: IntakeCard[]): IntakeCard[] {
  const selected = [...new Set((selectedMonths ?? []).filter((month) => month >= 1 && month <= 12))].sort(
    (a, b) => a - b,
  );
  if (!selected.length) return records;
  return selected.map((month) => {
    const record = records.find((entry) => entry.month === month);
    if (record) return record;
    const name = monthNames([month])[0];
    return {
      id: `month-${month}`,
      name: `${name} intake`,
      month,
      primary: false,
      starts: name,
      opening: null,
      deadline: null,
      notes: null,
    };
  });
}

/**
 * The counts line under a card's name, leaving out whatever is zero -- a card
 * that says "0 consultants" states an absence the student cannot act on.
 *
 * Two facts, not four. This card is a chip: a flag, a name and a badge in
 * roughly 220px. The approved countries listing could afford the full set
 * because its card was a column with room to breathe; pouring the same string
 * in here wrapped it to three lines and made the grid's rows lurch between
 * 56px and 140px. Scholarships and consultants are a click away on the guide,
 * which is where the student is going anyway.
 */
export function destinationCounts(entry: Destination): string | null {
  const { universities, courses, scholarships, consultants } = entry.counts;
  const parts: string[] = [];
  if (universities)
    parts.push(`${universities} ${universities === 1 ? 'university' : 'universities'}`);
  if (courses) parts.push(`${courses} ${courses === 1 ? 'course' : 'courses'}`);
  /* Only when there is room: a destination with no universities or courses
     still deserves to say what it does have. */
  if (parts.length < 2 && scholarships)
    parts.push(`${scholarships} ${scholarships === 1 ? 'scholarship' : 'scholarships'}`);
  if (parts.length < 2 && consultants)
    parts.push(`${consultants} ${consultants === 1 ? 'consultant' : 'consultants'}`);
  return parts.length ? parts.slice(0, 2).join(' · ') : null;
}

/**
 * The guides the homepage leads with: popular ones first, then the rest in the
 * directory's own order. The full list of destinations has a page of its own,
 * so the homepage shows a short row of the ones a student is likeliest to
 * want rather than all two hundred.
 */
export function featuredDestinations(available: Destination[], limit = 8): Destination[] {
  const guides = available.filter((entry) => entry.slug);
  return [...guides.filter((entry) => entry.isPopular), ...guides.filter((entry) => !entry.isPopular)].slice(
    0,
    limit,
  );
}
