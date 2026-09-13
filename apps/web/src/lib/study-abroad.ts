import { getCountryPage, type CountryPage } from './countries';

/**
 * Data for the Study Abroad experience.
 *
 * The country detail page reuses the existing country page bundle wholesale --
 * profiles, sections, documents, FAQs and SEO all already come from there, and
 * a second country read would only be a second thing to keep correct. Only the
 * directory needs an endpoint of its own, because it describes destinations the
 * catalogue has no record for.
 */

const baseUrl = process.env.API_BASE_URL ?? 'http://127.0.0.1:4000';

export type DirectoryRegion = string;

export interface Destination {
  name: string;
  /** Null for a destination with no guide yet; such a card does not navigate. */
  slug: string | null;
  iso2Code: string | null;
  isPopular: boolean;
  isAvailable: boolean;
  region: DirectoryRegion | null;
  summary: string | null;
  /** The three-band flag accent, or null for a record outside the world list. */
  bands: readonly [string, string, string] | null;
}

export interface DestinationDirectory {
  available: Destination[];
  comingSoon: Destination[];
  regions: DirectoryRegion[];
  counts: { available: number; popular: number; total: number };
}

interface Envelope<T> {
  data: T | null;
  error: { code: string; message: string } | null;
}

export async function getDestinations(): Promise<DestinationDirectory> {
  const response = await fetch(new URL('/api/v1/countries/destinations', baseUrl), {
    cache: 'no-store',
    headers: { accept: 'application/json' },
  });
  const body = (await response.json()) as Envelope<DestinationDirectory>;
  if (!response.ok || body.error || !body.data)
    throw new Error(body.error?.message ?? 'Destination directory unavailable');
  return body.data;
}

/** The country guide, or null when nothing is published at that slug. */
export async function getStudyAbroadCountry(slug: string): Promise<CountryPage | null> {
  try {
    return await getCountryPage(slug);
  } catch {
    return null;
  }
}

/** Destinations to offer at the foot of a country guide. */
export function otherDestinations(
  directory: DestinationDirectory,
  currentSlug: string,
  limit = 6,
): Destination[] {
  const others = directory.available.filter((entry) => entry.slug !== currentSlug);
  const popular = others.filter((entry) => entry.isPopular);
  return (popular.length >= limit ? popular : others).slice(0, limit);
}
