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
  /** The consultant's own image, drawn as a round logo where a page asks
   *  for it. Absent from an API that does not send it. */
  logo?: string | null;
};

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const records = (value: unknown): Array<Record<string, unknown>> =>
  Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];

const unique = <T,>(items: T[], key: (item: T) => string) =>
  items.filter(
    (item, index) => items.findIndex((other) => key(other) === key(item)) === index,
  );

/**
 * What a service or a language is grouped by: its name, trimmed and in
 * lower case. The admin writes a service's slug and a language's code for
 * itself -- "visa-documentation-1" beside the seeded "visa-documentation",
 * an empty code beside "en" -- so neither can be trusted to say that two
 * consultants offer the same thing. The name the reader sees can.
 */
export function nameKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Whether an office's location is still live. The API is to send only
 * active ones, but an older one sent every link, so a location an admin
 * switched off kept its city in the filters and its office on the profile,
 * linking to a page that answers 404. A row that does not say its status
 * is taken as live.
 */
export function isLiveLocation(location: unknown): boolean {
  if (!location || typeof location !== 'object') return false;
  const row = location as Record<string, unknown>;
  if (row.status != null && row.status !== 'ACTIVE') return false;
  return !row.deletedAt;
}

/** A consultant record's office links whose location is live. */
export function liveLocationLinks(value: unknown): Array<Record<string, unknown>> {
  return records(value).filter((link) => isLiveLocation(link.location));
}

/** A service's address in a link, from its name alone, as the catalogue
 *  writes it: "Visa documentation" is `visa-documentation`. */
export function serviceSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * The address of a record's featured image, when it has one an <img> may
 * load: the API's `/media/...` path, which this site serves, or an
 * absolute web address. Anything else is no image.
 */
export function consultantLogo(record: unknown): string | null {
  const media = (record as { featuredMedia?: unknown } | null)?.featuredMedia;
  const url = text((media as { publicUrl?: unknown } | null | undefined)?.publicUrl);
  if (!url) return null;
  return /^\/(?!\/)/.test(url) || /^https?:\/\/[^/]/i.test(url) ? url : null;
}

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
      liveLocationLinks(row.locations).flatMap((link) => {
        const location = link.location as Record<string, unknown> | undefined;
        const city = text(location?.city);
        return city ? [city] : [];
      }),
      (city) => cityKey(city),
    ),
    services: unique(
      records(row.services).flatMap((service) => {
        const serviceName = text(service.name);
        const slug = text(service.slug) ?? (serviceName ? serviceSlug(serviceName) : null);
        return serviceName && slug ? [{ slug, name: serviceName }] : [];
      }),
      (service) => nameKey(service.name),
    ),
    languages: unique(
      records(row.languages).flatMap((language) => {
        const languageName = text(language.name);
        const code = text(language.code) ?? languageName;
        return languageName && code ? [{ code, name: languageName }] : [];
      }),
      (language) => nameKey(language.name),
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
    logo: consultantLogo(row),
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
  /** Destination slugs, for the worldwide directory: `?country=uk,australia`.
   *  A destination's own page never sets it -- every row there is that
   *  destination's. */
  destinations: string[];
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
  'country',
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
    destinations: list(params.get('country')).map((slug) => slug.toLowerCase()),
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
  if (state.destinations?.length) params.set('country', state.destinations.join(','));
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

/** Counts each value once per consultant, grouped by `key` -- the value
 *  itself unless a pick says otherwise. The first label and value seen for
 *  a key stand for it. */
function tally(
  rows: readonly CountryConsultantRow[],
  pick: (row: CountryConsultantRow) => Array<{ value: string; label: string; key?: string }>,
) {
  const counts = new Map<string, ConsultantFilterOption>();
  for (const row of rows) {
    const seen = new Set<string>();
    for (const { value, label, key = value } of pick(row)) {
      if (seen.has(key)) continue;
      seen.add(key);
      const entry = counts.get(key);
      if (entry) entry.count += 1;
      else counts.set(key, { value, label, count: 1 });
    }
  }
  return [...counts.values()].sort(byCount);
}

/** A language's value in a link: its code where any consultant recorded
 *  one, otherwise its name. Read over every row, so a code one record left
 *  empty is taken from another that has it. */
function languageValues(rows: readonly CountryConsultantRow[]) {
  const values = new Map<string, string>();
  for (const row of rows)
    for (const language of row.languages) {
      const key = nameKey(language.name);
      const code = language.code.toLowerCase();
      if (code !== key && !values.has(key)) values.set(key, code);
    }
  return (name: string) => values.get(nameKey(name)) ?? nameKey(name);
}

/** The service names a `?service=` list asks for. A value is the slug of a
 *  service's name or the slug a record holds -- an old link to
 *  `visa-documentation-1` still finds "Visa documentation" -- and either
 *  way every consultant offering a service of that name is included. */
function wantedServices(rows: readonly CountryConsultantRow[], values: readonly string[]) {
  const wanted = new Set<string>();
  if (!values.length) return wanted;
  for (const row of rows)
    for (const service of row.services)
      if (values.includes(service.slug) || values.includes(serviceSlug(service.name)))
        wanted.add(nameKey(service.name));
  return wanted;
}

/** The language names a `?language=` list asks for, by code or by name. */
function wantedLanguages(rows: readonly CountryConsultantRow[], values: readonly string[]) {
  const wanted = new Set<string>();
  if (!values.length) return wanted;
  const asked = values.map((value) => value.toLowerCase());
  for (const row of rows)
    for (const language of row.languages)
      if (asked.includes(language.code.toLowerCase()) || asked.includes(nameKey(language.name)))
        wanted.add(nameKey(language.name));
  return wanted;
}

/** What the list can be narrowed by, counted over the destination's
 * consultants, so no option is offered that would empty the list. */
export function consultantOptions(rows: readonly CountryConsultantRow[]) {
  const languageValue = languageValues(rows);
  return {
    destinations: tally(rows, (row) =>
      row.destinations.map((destination) => ({ value: destination.slug, label: destination.name })),
    ),
    cities: tally(rows, (row) =>
      row.cities.map((city) => ({ value: cityKey(city), label: city })),
    ),
    /* One option per name, however many slugs the records spread it
       over: "Visa documentation" once, listed by every consultant who
       offers it. */
    services: tally(rows, (row) =>
      row.services.map((service) => ({
        key: nameKey(service.name),
        value: serviceSlug(service.name) || service.slug,
        label: service.name,
      })),
    ),
    languages: tally(rows, (row) =>
      row.languages.map((language) => ({
        key: nameKey(language.name),
        value: languageValue(language.name),
        label: language.name,
      })),
    ),
    verified: rows.filter((row) => row.verified).length,
  };
}

/**
 * The address's services and languages as the filters' own values, so an
 * old link -- a slug the admin suffixed, a language by name where the list
 * uses its code -- ticks the box it means. A value no consultant here
 * carries is dropped rather than allowed to empty the list.
 */
export function canonicalConsultantFilters(
  rows: readonly CountryConsultantRow[],
  state: Pick<ConsultantListState, 'services' | 'languages'>,
) {
  const options = consultantOptions(rows);
  const pick = (list: ConsultantFilterOption[], wanted: Set<string>) => [
    ...new Set(
      list.filter((option) => wanted.has(nameKey(option.label))).map((option) => option.value),
    ),
  ];
  return {
    services: pick(options.services, wantedServices(rows, state.services)),
    languages: pick(options.languages, wantedLanguages(rows, state.languages)),
  };
}

export function narrowsConsultants(
  options: readonly ConsultantFilterOption[],
  total: number,
) {
  return options.length > 1 || (options.length === 1 && options[0]!.count < total);
}

/** The words a consultant is found by: the name, the cities, the services
 *  and the destinations it lists -- "Japan" finds every consultant the
 *  Destination filter counts under Japan. */
function searchText(row: CountryConsultantRow) {
  return [
    row.name,
    ...row.cities,
    ...row.services.map((service) => service.name),
    ...row.destinations.map((destination) => destination.name),
  ].join(' ');
}

/**
 * The consultants a state leaves, in the order it asks for. "Recommended"
 * is the catalogue's own order, which is the editor's; nothing is paid for.
 */
export function filterConsultants(
  rows: readonly CountryConsultantRow[],
  state: ConsultantListState,
): CountryConsultantRow[] {
  const services = wantedServices(rows, state.services);
  const languages = wantedLanguages(rows, state.languages);
  const shown = rows.filter((row) => {
    if (!matchesSubject(searchText(row), state.q)) return false;
    if (
      state.destinations.length &&
      !row.destinations.some((destination) => state.destinations.includes(destination.slug))
    )
      return false;
    if (
      state.cities.length &&
      !row.cities.some((city) => state.cities.includes(cityKey(city)))
    )
      return false;
    if (
      state.services.length &&
      !row.services.some((service) => services.has(nameKey(service.name)))
    )
      return false;
    if (
      state.languages.length &&
      !row.languages.some((language) => languages.has(nameKey(language.name)))
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
    state.destinations.length +
    state.cities.length +
    state.services.length +
    state.languages.length +
    (state.verified ? 1 : 0)
  );
}

export type ConsultantChip = {
  key: string;
  label: string;
  /** The list's state with this one choice undone. */
  next: ConsultantListState;
};

/**
 * The choices in force, one chip each, above the results: the search, then
 * each destination, city, service and language, then "Verified". Each
 * names what it removes by the label its filter shows.
 */
export function consultantChips(
  state: ConsultantListState,
  options: Pick<ReturnType<typeof consultantOptions>, 'destinations' | 'cities' | 'services' | 'languages'>,
  names: { destinations?: ReadonlyMap<string, string> } = {},
): ConsultantChip[] {
  const chips: ConsultantChip[] = [];
  const reset = { page: 1 };
  if (state.q) chips.push({ key: 'q', label: `\u201c${state.q}\u201d`, next: { ...state, ...reset, q: '' } });
  const label = (list: ConsultantFilterOption[], value: string) =>
    list.find((option) => option.value === value)?.label ?? value.replace(/-/g, ' ');
  for (const key of ['destinations', 'cities', 'services', 'languages'] as const)
    for (const value of state[key])
      chips.push({
        key: `${key}:${value}`,
        label:
          key === 'destinations' && names.destinations?.has(value)
            ? names.destinations.get(value)!
            : label(options[key], value),
        next: { ...state, ...reset, [key]: state[key].filter((entry) => entry !== value) },
      });
  if (state.verified)
    chips.push({ key: 'verified', label: 'Verified by Universta', next: { ...state, ...reset, verified: false } });
  return chips;
}
