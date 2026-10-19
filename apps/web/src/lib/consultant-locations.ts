/**
 * The places consultants have offices in, at
 * /study-abroad-consultants/locations/<slug>.
 *
 * A location record is named by whoever entered it -- "Heidelberg advisory
 * centre" -- while the page is about the place, so the heading names the
 * city (and the state, when there is one) and keeps the record's own name
 * beside it.
 */

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

/** "Heidelberg", "Heidelberg, Baden-Württemberg", or the record's own name
 *  when it has no city. */
export function locationPlaceLabel(location: { name?: unknown; city?: unknown; state?: unknown }): string {
  const city = text(location.city);
  const state = text(location.state);
  if (!city) return text(location.name) ?? 'this location';
  return state && state.toLowerCase() !== city.toLowerCase() ? `${city}, ${state}` : city;
}

export type ConsultantOffice = {
  slug: string;
  name: string;
  city: string | null;
  state: string | null;
  countryId: string | null;
  countrySlug: string | null;
};

/**
 * Every live office location the published consultants have, once each,
 * in the order they are first met: the location pages the sitemap
 * announces and a city's page links to. A location counts only when it
 * says it is ACTIVE and is not archived -- its own page answers 404
 * otherwise.
 */
export function liveConsultantOffices(consultants: readonly unknown[]): ConsultantOffice[] {
  const offices = new Map<string, ConsultantOffice>();
  for (const consultant of consultants) {
    const links = (consultant as { locations?: unknown } | null)?.locations;
    if (!Array.isArray(links)) continue;
    for (const link of links) {
      const location = (link as { location?: Record<string, unknown> } | null)?.location;
      const slug = text(location?.slug);
      if (!location || !slug || location.status !== 'ACTIVE' || location.deletedAt) continue;
      if (offices.has(slug)) continue;
      const country = location.country as Record<string, unknown> | null | undefined;
      offices.set(slug, {
        slug,
        name: text(location.name) ?? slug,
        city: text(location.city),
        state: text(location.state),
        countryId: text(location.countryId) ?? text(country?.id),
        countrySlug: text(country?.slug),
      });
    }
  }
  return [...offices.values()];
}

/** A location page's address. */
export function consultantLocationHref(slug: string): string {
  return `/study-abroad-consultants/locations/${slug}`;
}

/** The page's heading and the title it falls back to. */
export function locationHeading(location: { name?: unknown; city?: unknown; state?: unknown }): string {
  return `Study abroad consultants in ${locationPlaceLabel(location)}`;
}

/** How many other places "Nearby and related" names. */
export const NEARBY_SHOWN = 8;

const same = (a: string | null, b: string | null) => Boolean(a && b && a.toLowerCase() === b.toLowerCase());

/**
 * The other live offices to offer under a location's consultants: those in
 * the same state (and the same country, when both say), or, with no state,
 * the same country, or, with neither, the same city. Never the location
 * itself, each place once, A to Z by place and then by name.
 */
export function nearbyOffices(
  location: { slug: string; city?: unknown; state?: unknown; countrySlug?: string | null },
  offices: readonly ConsultantOffice[],
  limit = NEARBY_SHOWN,
): ConsultantOffice[] {
  const city = text(location.city);
  const state = text(location.state);
  const country = location.countrySlug ?? null;
  const near = (office: ConsultantOffice) => {
    if (office.slug === location.slug) return false;
    if (state) return same(office.state, state) && (!country || !office.countrySlug || office.countrySlug === country);
    if (country) return office.countrySlug === country;
    return same(office.city, city);
  };
  return offices
    .filter(near)
    .sort((a, b) => locationPlaceLabel(a).localeCompare(locationPlaceLabel(b)) || a.name.localeCompare(b.name))
    .slice(0, limit);
}
