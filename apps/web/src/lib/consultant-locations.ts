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

/** The page's heading and the title it falls back to. */
export function locationHeading(location: { name?: unknown; city?: unknown; state?: unknown }): string {
  return `Study abroad consultants in ${locationPlaceLabel(location)}`;
}
