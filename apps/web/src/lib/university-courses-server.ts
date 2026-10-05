import { cache } from 'react';
import { phaseDetail, phaseUniversityCourses } from './phase1';
import { firstCity, toCountry, type CountryRef } from './university-courses';

/**
 * The server's reads for a university's course pages.
 *
 * Wrapped in React's `cache` so the metadata and the page of one request
 * share a read rather than asking the API twice for the same thing.
 */

export const loadCourseList = cache(
  async (universitySlug: string, search: string) => {
    try {
      return await phaseUniversityCourses<Record<string, unknown>>(
        universitySlug,
        undefined,
        Object.fromEntries(new URLSearchParams(search)),
      );
    } catch {
      return null;
    }
  },
);

export const loadOffering = cache(
  async (universitySlug: string, offeringSlug: string) => {
    try {
      return await phaseUniversityCourses<Record<string, unknown>>(
        universitySlug,
        offeringSlug,
      );
    } catch {
      return null;
    }
  },
);

/**
 * Where a university is: its country, for the address its course pages sit
 * under, and its first campus city. Asked of the course list, which carries
 * both; the profile is the fallback for an API that does not yet.
 */
export async function universityPlace(
  universitySlug: string,
): Promise<{ name: string; slug: string; country: CountryRef; city: string | null } | null> {
  const list = await loadCourseList(universitySlug, 'limit=1');
  const listed = list?.university as Record<string, unknown> | undefined;
  const fromList = toCountry(listed?.country);
  if (listed && fromList)
    return {
      name: String(listed.name),
      slug: String(listed.slug),
      country: fromList,
      city: firstCity(listed),
    };
  try {
    const profile = await phaseDetail<Record<string, unknown>>(
      'universities',
      universitySlug,
    );
    const country = toCountry(profile.country);
    return country
      ? {
          name: String(profile.name),
          slug: String(profile.slug),
          country,
          city: firstCity(profile),
        }
      : null;
  } catch {
    return null;
  }
}
