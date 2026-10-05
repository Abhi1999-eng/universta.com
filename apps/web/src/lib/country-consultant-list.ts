import { matchesSubject } from './subject-search';
import { cityKey } from './university-list';

/**
 * One destination's consultants, at /study-abroad/<country>/consultants.
 *
 * The behaviour reference ends a guide's consultants block with "View all
 * consultants" to a page under the destination: the consultants who list
 * it, with a search, filters and "Load more", and the cities they are in.
 * The guide here sent the same reader to the worldwide directory in another
 * design, with the destination one filter among many.
 *
 * Every consultant the destination has is read once and narrowed in the
 * browser, so every count beside a filter is true. The address keeps each
 * choice under the names the worldwide directory already reads -- `city`,
 * `service`, `language`, `verified`, `sort` -- so the guide's city links,
 * written for that directory, mean the same here.
 */

/** The page's own address. */
export function countryConsultantsHref(countrySlug: string) {
  return `/study-abroad/${countrySlug}/consultants`;
}

/** Cards shown first, and added by each "Load more": the reference's step. */
export const CONSULTANT_STEP = 18;

export type CountryConsultantRow = {
  id: string;
  name: string;
  slug: string;
  summary: string | null;
  verified: boolean;
  /** When the verification was recorded, for "Recently verified". */
  verifiedAt: number | null;
  /** Where the consultant sees students, in the order the record lists them. */
  cities: string[];
  services: Array<{ slug: string; name: string }>;
  languages: Array<{ code: string; name: string }>;
  /** Every destination the consultant lists. */
  destinations: Array<{ slug: string; name: string }>;
};

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const records = (value: unknown): Array<Record<string, unknown>> =>
  Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];

const unique = <T,>(items: T[], key: (item: T) => string) =>
  items.filter(
    (item, index) => items.findIndex((other) => key(other) === key(item)) === index,
  );

/** One list-endpoint row, or null when it has no page to link to. */
export function toConsultantRow(record: unknown): CountryConsultantRow | null {
  if (!record || typeof record !== 'object') return null;
  const row = record as Record<string, unknown>;
  const slug = text(row.slug);
  const name = text(row.name);
  if (!slug || !name) return null;
  const verifiedAt = text(row.verifiedAt);
  return {
    id: text(row.id) ?? slug,
    name,
    slug,
    summary: text(row.shortDescription),
    verified: row.verificationStatus === 'VERIFIED',
    verifiedAt:
      row.verificationStatus === 'VERIFIED' && verifiedAt
        ? new Date(verifiedAt).getTime() || null
        : null,
    cities: unique(
      records(row.locations).flatMap((link) => {
        const location = link.location as Record<string, unknown> | undefined;
        const city = text(location?.city);
        return city ? [city] : [];
      }),
      (city) => cityKey(city),
    ),
    services: unique(
      records(row.services).flatMap((service) => {
        const serviceName = text(service.name);
        const serviceSlug = text(service.slug);
        return serviceName && serviceSlug ? [{ slug: serviceSlug, name: serviceName }] : [];
      }),
      (service) => service.slug,
    ),
    languages: unique(
      records(row.languages).flatMap((language) => {
        const languageName = text(language.name);
        const code = text(language.code) ?? languageName;
        return languageName && code ? [{ code, name: languageName }] : [];
      }),
      (language) => language.code.toLowerCase(),
    ),
    destinations: unique(
      records(row.countries).flatMap((link) => {
        const country = link.country as Record<string, unknown> | undefined;
        const countryName = text(country?.name);
        const countrySlug = text(country?.slug);
        return countryName && countrySlug ? [{ slug: countrySlug, name: countryName }] : [];
      }),
      (country) => country.slug,
    ),
  };
}

export function toConsultantRows(rows: readonly unknown[]): CountryConsultantRow[] {
  return rows.flatMap((row) => {
    const consultant = toConsultantRow(row);
    return consultant ? [consultant] : [];
  });
}

export type ConsultantSort = 'recommended' | 'verified' | 'name-asc';

export const CONSULTANT_SORTS: ReadonlyArray<{ value: ConsultantSort; label: string }> = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'verified', label: 'Recently verified' },
  { value: 'name-asc', label: 'Name A-Z' },
];

export type ConsultantListState = {
  q: string;
  /** City keys: "New Delhi" is `new-delhi`. */
  cities: string[];
  services: string[];
  languages: string[];
  verified: boolean;
  sort: ConsultantSort;
  page: number;
};

export const CONSULTANT_PARAMS = [
  'q',
  'city',
  'service',
  'language',
  'verified',
  'sort',
  'page',
] as const;

type Params = { get(name: string): string | null };

const list = (value: string | null) =>
  value
    ? [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))]
    : [];

export function readConsultantState(params: Params): ConsultantListState {
  const sort = params.get('sort');
  const page = Number.parseInt(params.get('page') ?? '', 10);
  return {
    q: (params.get('q') ?? '').trim().slice(0, 100),
    /* Read as keys whichever way they arrive: the guide's links used to
       carry the name -- `?city=Adelaide` -- and the list writes the key. */
    cities: [...new Set(list(params.get('city')).map(cityKey).filter(Boolean))],
    services: list(params.get('service')),
    languages: list(params.get('language')).map((code) => code.toLowerCase()),
    verified: params.get('verified') === 'true',
    sort: CONSULTANT_SORTS.some((option) => option.value === sort)
      ? (sort as ConsultantSort)
      : 'recommended',
    page: Number.isFinite(page) && page > 1 ? Math.min(page, 200) : 1,
  };
}

export function consultantListHref(path: string, state: Partial<ConsultantListState>) {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.cities?.length) params.set('city', state.cities.join(','));
  if (state.services?.length) params.set('service', state.services.join(','));
  if (state.languages?.length) params.set('language', state.languages.join(','));
  if (state.verified) params.set('verified', 'true');
  if (state.sort && state.sort !== 'recommended') params.set('sort', state.sort);
  if (state.page && state.page > 1) params.set('page', String(state.page));
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

export function isNarrowedConsultantList(
  searchParams: Record<string, string | string[] | undefined>,
) {
  return CONSULTANT_PARAMS.some((key) => {
    const value = searchParams[key];
    return Array.isArray(value) ? value.length > 0 : Boolean(value);
  });
}

export type ConsultantFilterOption = { value: string; label: string; count: number };

const byCount = (a: ConsultantFilterOption, b: ConsultantFilterOption) =>
  b.count - a.count || a.label.localeCompare(b.label);

function tally(
  rows: readonly CountryConsultantRow[],
  pick: (row: CountryConsultantRow) => Array<{ value: string; label: string }>,
) {
  const counts = new Map<string, ConsultantFilterOption>();
  for (const row of rows) {
    for (const { value, label } of pick(row)) {
      const entry = counts.get(value);
      if (entry) entry.count += 1;
      else counts.set(value, { value, label, count: 1 });
    }
  }
  return [...counts.values()].sort(byCount);
}

/** What the list can be narrowed by, counted over the destination's
 * consultants, so no option is offered that would empty the list. */
export function consultantOptions(rows: readonly CountryConsultantRow[]) {
  return {
    cities: tally(rows, (row) =>
      row.cities.map((city) => ({ value: cityKey(city), label: city })),
    ),
    services: tally(rows, (row) =>
      row.services.map((service) => ({ value: service.slug, label: service.name })),
    ),
    languages: tally(rows, (row) =>
      row.languages.map((language) => ({
        value: language.code.toLowerCase(),
        label: language.name,
      })),
    ),
    verified: rows.filter((row) => row.verified).length,
  };
}

export function narrowsConsultants(
  options: readonly ConsultantFilterOption[],
  total: number,
) {
  return options.length > 1 || (options.length === 1 && options[0]!.count < total);
}

/** The words a consultant is found by: the name, the cities and the services. */
function searchText(row: CountryConsultantRow) {
  return [row.name, ...row.cities, ...row.services.map((service) => service.name)].join(' ');
}

/**
 * The consultants a state leaves, in the order it asks for. "Recommended"
 * is the catalogue's own order, which is the editor's; nothing is paid for.
 */
export function filterConsultants(
  rows: readonly CountryConsultantRow[],
  state: ConsultantListState,
): CountryConsultantRow[] {
  const shown = rows.filter((row) => {
    if (!matchesSubject(searchText(row), state.q)) return false;
    if (
      state.cities.length &&
      !row.cities.some((city) => state.cities.includes(cityKey(city)))
    )
      return false;
    if (
      state.services.length &&
      !row.services.some((service) => state.services.includes(service.slug))
    )
      return false;
    if (
      state.languages.length &&
      !row.languages.some(
        (language) =>
          state.languages.includes(language.code.toLowerCase()) ||
          state.languages.includes(language.name.toLowerCase()),
      )
    )
      return false;
    if (state.verified && !row.verified) return false;
    return true;
  });
  const sorted = [...shown];
  if (state.sort === 'name-asc') sorted.sort((a, b) => a.name.localeCompare(b.name));
  if (state.sort === 'verified')
    sorted.sort(
      (a, b) =>
        (b.verifiedAt ?? -1) - (a.verifiedAt ?? -1) || a.name.localeCompare(b.name),
    );
  return sorted;
}

export function activeConsultantFilters(state: ConsultantListState) {
  return (
    state.cities.length +
    state.services.length +
    state.languages.length +
    (state.verified ? 1 : 0)
  );
}
