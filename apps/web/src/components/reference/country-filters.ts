/**
 * The listing's filter state is an address, not component state: a visitor must
 * be able to refresh, go back, and paste the link to someone else. Everything
 * that decides what the URL says lives here, as plain functions, so the rules
 * can be checked without a browser.
 */

/** Every filter the drawer owns, in the order it presents them. */
export const FILTER_KEYS = [
  // Kept from the listing's existing structured filters.
  'budgetBand',
  'ieltsOptional',
  'subjects',
  'intakes',
  'ieltsMax',
  'currency',
  'tuitionMax',
  'livingMax',
  'postStudyWork',
  'postStudyWorkMonthsMin',
  'partTimeWork',
  'workHoursMin',
  'applicationFee',
  'universitiesMin',
] as const;

export type FilterKey = (typeof FILTER_KEYS)[number];
export type FilterDraft = Record<FilterKey, string>;

export const IELTS_CHOICES = ['5.5', '6.0', '6.5', '7.0'];
export const UNIVERSITY_CHOICES = ['1', '2', '3', '5'];

export const SORTS: Array<[string, string]> = [
  ['recommended', 'Recommended'],
  ['tuition', 'Tuition: low to high'],
  ['living', 'Living cost: low to high'],
  ['universities', 'Most universities'],
];

/** Amounts are only comparable inside one currency, so they travel with it. */
const CURRENCY_BOUND: FilterKey[] = ['tuitionMax', 'livingMax'];

export function draftFromFilters(filters: Record<string, string>): FilterDraft {
  return Object.fromEntries(
    FILTER_KEYS.map((key) => [key, filters[key] ?? '']),
  ) as FilterDraft;
}

/** OR within a group: a comma-separated list the API reads as alternatives. */
export function toggleValue(current: string, value: string): string {
  const chosen = current ? current.split(',').filter(Boolean) : [];
  return (
    chosen.includes(value)
      ? chosen.filter((entry) => entry !== value)
      : [...chosen, value]
  ).join(',');
}

export function hasValue(current: string, value: string): boolean {
  return (current ? current.split(',') : []).includes(value);
}

function href(pathname: string, params: URLSearchParams): string {
  return `${pathname}${params.size ? `?${params}` : ''}#regions`;
}

/** Applies staged choices. Paging always restarts: page 3 of the old result
 * set says nothing about the new one. */
export function commitHref(
  pathname: string,
  search: string,
  next: Record<string, string | null>,
): string {
  const params = new URLSearchParams(search);
  for (const [key, value] of Object.entries(next)) {
    if (value === null || value === '') params.delete(key);
    else params.set(key, value);
  }
  params.delete('page');
  return href(pathname, params);
}

/** Removes one chip. Inside a group only that value goes; the rest stay. */
export function dropHref(
  pathname: string,
  search: string,
  key: string,
  value?: string,
): string {
  const params = new URLSearchParams(search);
  const current = params.get(key) ?? '';
  if (value && current.includes(',')) {
    const rest = current.split(',').filter((entry) => entry && entry !== value);
    if (rest.length) params.set(key, rest.join(','));
    else params.delete(key);
  } else params.delete(key);
  // An amount with no currency would be an unanswerable question.
  if (key === 'currency') for (const bound of CURRENCY_BOUND) params.delete(bound);
  params.delete('page');
  return href(pathname, params);
}

export type Chip = { key: string; value: string; label: string };

/** What the visitor sees narrowing their results, in the order applied. */
export function activeChips(
  filters: Record<string, string>,
  names: {
    subjects?: Map<string, string>;
    intakes?: Map<string, string>;
  } = {},
): Chip[] {
  const chips: Chip[] = [];
  const add = (key: string, value: string, label: string) =>
    chips.push({ key, value, label });

  const BUDGETS: Record<string, string> = {
    BUDGET_FRIENDLY: 'Budget friendly',
    MID_RANGE: 'Mid range',
    PREMIUM: 'Premium',
  };
  if (filters.budgetBand)
    add(
      'budgetBand',
      filters.budgetBand,
      BUDGETS[filters.budgetBand] ?? filters.budgetBand,
    );
  if (filters.ieltsOptional === 'true')
    add('ieltsOptional', 'true', 'IELTS optional or waived');
  for (const slug of (filters.subjects ?? '').split(',').filter(Boolean))
    add('subjects', slug, names.subjects?.get(slug) ?? slug);
  for (const slug of (filters.intakes ?? '').split(',').filter(Boolean))
    add('intakes', slug, `${names.intakes?.get(slug) ?? slug} intake`);
  if (filters.ieltsMax)
    add('ieltsMax', filters.ieltsMax, `IELTS ≤ ${filters.ieltsMax}`);
  if (filters.currency)
    add('currency', filters.currency, `In ${filters.currency}`);
  if (filters.tuitionMax)
    add('tuitionMax', filters.tuitionMax, `Tuition ≤ ${filters.tuitionMax}`);
  if (filters.livingMax)
    add('livingMax', filters.livingMax, `Living ≤ ${filters.livingMax}`);
  if (filters.postStudyWork)
    add(
      'postStudyWork',
      filters.postStudyWork,
      filters.postStudyWork === 'true' ? 'Post-study work' : 'No post-study work',
    );
  if (filters.postStudyWorkMonthsMin)
    add(
      'postStudyWorkMonthsMin',
      filters.postStudyWorkMonthsMin,
      `${filters.postStudyWorkMonthsMin}+ months work`,
    );
  if (filters.partTimeWork)
    add(
      'partTimeWork',
      filters.partTimeWork,
      filters.partTimeWork === 'true'
        ? 'Work while studying'
        : 'No work while studying',
    );
  if (filters.workHoursMin)
    add(
      'workHoursMin',
      filters.workHoursMin,
      `${filters.workHoursMin}+ hours a week`,
    );
  if (filters.applicationFee)
    add(
      'applicationFee',
      filters.applicationFee,
      filters.applicationFee === 'none'
        ? 'No application fee'
        : 'Has application fee',
    );
  if (filters.universitiesMin)
    add(
      'universitiesMin',
      filters.universitiesMin,
      `${filters.universitiesMin}+ universities`,
    );
  return chips;
}

/** How many filters the button badge reports: three subjects read as three. */
export function activeFilterCount(filters: Record<string, string>): number {
  return FILTER_KEYS.reduce(
    (total, key) =>
      total + (filters[key] ? filters[key].split(',').filter(Boolean).length : 0),
    0,
  );
}

/** The staged count query, carrying only the listing's own vocabulary. */
export function stagedCountQuery(
  filters: Record<string, string>,
  draft: FilterDraft,
): string {
  const search = new URLSearchParams();
  if (filters.q) search.set('q', filters.q);
  if (filters.region) search.set('continent', filters.region);
  for (const key of FILTER_KEYS) if (draft[key]) search.set(key, draft[key]);
  return search.toString();
}
