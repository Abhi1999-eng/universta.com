/**
 * Where a university's pages are.
 *
 * The behaviour reference files a university under its country for
 * everything below the profile: a country's universities at
 * /study-abroad/<country>/universities, a university's courses at
 * /study-abroad/<country>/universities/<university>/courses, and one course
 * under that. The profile itself stays flat, at /universities/<university>,
 * and the nested address for it redirects there. Every link to these pages
 * goes through here, so the shape is written once.
 */

/** A university's own page. */
export function universityHref(universitySlug: string) {
  return `/universities/${universitySlug}`;
}

/** Every university in one destination. */
export function countryUniversitiesHref(countrySlug: string) {
  return `/study-abroad/${countrySlug}/universities`;
}

/** Every course one university teaches. */
export function universityCoursesHref(countrySlug: string, universitySlug: string) {
  return `${countryUniversitiesHref(countrySlug)}/${universitySlug}/courses`;
}

/** One course at one university. */
export function offeringHref(
  countrySlug: string,
  universitySlug: string,
  offeringSlug: string,
) {
  return `${universityCoursesHref(countrySlug, universitySlug)}/${offeringSlug}`;
}
