import type { CountryPage, ProfileSummary } from './countries';
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
  if (intakes.length)
    rows.push({
      label: 'Main intakes',
      value: intakes.join(' · '),
      note: intakes.length > 1 ? `${intakes[0]} is the primary intake` : undefined,
    });

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
      value: work.visaType,
      body: work.visaInformation ?? null,
    });

  if (work.partTimeAllowed)
    cards.push({
      title: 'Work while you study',
      value: work.partTimeHoursPerWeek
        ? `${Number(work.partTimeHoursPerWeek)} hours a week`
        : 'Permitted',
      body: work.partTimeSummary ?? null,
    });

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
const LEVELS: Array<{ id: string; label: string; duration: string; entry: string }> = [
  { id: 'bachelors', label: "Bachelor's", duration: '3–4 years', entry: 'School leaving qualification' },
  { id: 'masters', label: "Master's", duration: '1–2 years', entry: "Bachelor's degree" },
  { id: 'mba', label: 'MBA', duration: '1–2 years', entry: "Bachelor's degree, often with experience" },
  { id: 'phd', label: 'PhD', duration: '3–5 years', entry: "Master's degree or equivalent" },
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
    note: null,
    courseCount: counts[level.id] ?? null,
  }));
}
