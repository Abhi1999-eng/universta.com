import { nameKey, type CountryConsultantRow } from './country-consultant-list';
import { cityKey } from './university-list';

/**
 * What a consultant's own record may say on its pages, read defensively:
 * the API that serves it is older than some of these rules, so each one
 * holds whatever the record carries.
 */

/**
 * An address a link may point at: absolute, http or https, with a host.
 *
 * The admin accepted whatever was typed into Website URL and Source URL,
 * and a profile rendered "www.example.test" as a link relative to itself
 * (a 404 on our own site) and a note like "Checked by phone with the
 * office" as a link to nowhere. Anything else is shown as text, not
 * linked.
 */
export function externalHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  try {
    const url = new URL(trimmed);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname ? trimmed : null;
  } catch {
    return null;
  }
}

/** An address as a reader reads it: without the scheme. */
export function displayUrl(value: string): string {
  return value.trim().replace(/^https?:\/\//i, '');
}

/**
 * Whether a consultant is verified, and when.
 *
 * A date means something only beside VERIFIED. Records that are PENDING
 * or UNVERIFIED can still carry an old date -- a check that was later
 * withdrawn, a seed -- and printing it read "Not yet verified ... Last
 * verified 1 Oct 2026". A verified record with no date says so, rather
 * than "Not verified" beside a Verified badge.
 */
export function consultantVerification(
  status: unknown,
  verifiedAt: unknown,
): { verified: boolean; verifiedAt: string | null } {
  const verified = status === 'VERIFIED';
  const date =
    verified && typeof verifiedAt === 'string' && verifiedAt.trim() && !Number.isNaN(Date.parse(verifiedAt))
      ? verifiedAt.trim()
      : null;
  return { verified, verifiedAt: date };
}

/** How many "Consultants with a similar profile" a profile suggests. */
export const SIMILAR_CONSULTANTS = 3;

/* What a shared trait is worth when two consultants are compared: an
   office in the same city is something a student can act on, a shared
   destination is the reason they are looking, and a service is common
   enough that it only separates consultants already alike. */
const WEIGHT = { city: 3, destination: 2, service: 1 } as const;

/**
 * The other consultants a profile suggests, from the published list.
 *
 * `similar` is "Consultants with a similar profile": up to three that
 * share most with this one by city, destination and service. Each shares
 * at least a city or a destination -- a service alone, which most
 * consultants list, does not make two alike -- and a tie keeps the
 * catalogue's order. Nothing is paid for and nothing else is weighed.
 *
 * `others` is "Other consultants for these destinations": everyone else
 * who lists one of this consultant's destinations, in alphabetical order,
 * leaving out the similar ones so no consultant is suggested twice.
 */
export function consultantNeighbours(
  self: CountryConsultantRow,
  rows: readonly CountryConsultantRow[],
): { similar: CountryConsultantRow[]; others: CountryConsultantRow[] } {
  const cities = new Set(self.cities.map(cityKey));
  const destinations = new Set(self.destinations.map((entry) => entry.slug));
  const services = new Set(self.services.map((service) => nameKey(service.name)));
  const seen = new Set<string>([self.slug]);
  const candidates = rows.filter((row) => {
    if (seen.has(row.slug)) return false;
    seen.add(row.slug);
    return true;
  });
  const shared = (row: CountryConsultantRow) => ({
    cities: new Set(row.cities.map(cityKey).filter((key) => cities.has(key))).size,
    destinations: new Set(row.destinations.map((entry) => entry.slug).filter((slug) => destinations.has(slug))).size,
    services: new Set(row.services.map((service) => nameKey(service.name)).filter((key) => services.has(key))).size,
  });

  const similar = candidates
    .map((row, index) => {
      const count = shared(row);
      const score =
        count.cities || count.destinations
          ? count.cities * WEIGHT.city + count.destinations * WEIGHT.destination + count.services * WEIGHT.service
          : 0;
      return { row, index, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, SIMILAR_CONSULTANTS)
    .map((entry) => entry.row);

  const chosen = new Set(similar.map((row) => row.slug));
  const others = candidates
    .filter((row) => !chosen.has(row.slug) && row.destinations.some((entry) => destinations.has(entry.slug)))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { similar, others };
}
