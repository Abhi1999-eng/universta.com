import type { Metadata } from 'next';
import { inCountry } from './country-article';
import { resolvedMetadata, type ResolvedSeo } from './seo-management';

/**
 * The tab title and description of a university's profile and of each of
 * its courses.
 *
 * The catalogue's own defaults are the record's bare name and the site's
 * one description for every page, which say neither what the page is for
 * nor where. The behaviour reference titles a university "University of
 * Oxford | Courses, Fees & Admissions" and a course "MSc Computer Science
 * at University of Oxford | Fees, Eligibility & Intakes", and describes
 * each from the record. So unless an editor wrote a value -- one by one or
 * through a bulk rule -- the page builds its own: the title naming the
 * university, the description the record's own short description.
 */

/** Whether the value the catalogue sent is one an editor wrote. */
export function editorWrote(source: string | undefined) {
  return source === 'manual' || source === 'bulk';
}

export function universityPageMetadata({
  seo,
  title,
  description,
  canonical,
  names = [],
}: {
  seo: ResolvedSeo | null | undefined;
  /** The page's own title, used unless an editor wrote one. */
  title: string;
  /** The page's own description, used unless an editor wrote one. */
  description: string;
  canonical: string;
  /** The record's own names. A stored title that is only one of them is
   *  the default an editor's form opened on and saved back, not a title
   *  anyone chose, so it gives way like a default would. */
  names?: string[];
}): Metadata {
  const stored = seo?.seoTitle?.trim();
  const ownTitle =
    editorWrote(seo?.source?.title) && stored && !names.includes(stored)
      ? stored
      : null;
  const ownDescription =
    (editorWrote(seo?.source?.description) && seo?.metaDescription?.trim()) ||
    null;
  const finalTitle = ownTitle ?? title;
  const finalDescription = ownDescription ?? description;
  const meta = resolvedMetadata(
    seo
      ? {
          ...seo,
          seoTitle: finalTitle,
          metaDescription: finalDescription,
          canonicalUrl: canonical,
          /* The sharing card follows the page's own title and description
             when those are built here; what an editor wrote for it stays. */
          ...(ownTitle ? {} : { ogTitle: finalTitle, twitterTitle: finalTitle }),
          ...(ownDescription
            ? {}
            : { ogDescription: finalDescription, twitterDescription: finalDescription }),
        }
      : null,
    finalTitle,
    finalDescription,
    canonical,
  );
  /* `resolvedMetadata` finishes the title with the site name, and this
     route family's layout would add it again through its template. */
  return typeof meta.title === 'string'
    ? { ...meta, title: { absolute: meta.title } }
    : meta;
}

/** "University of Warwick | Courses, Fees & Admissions". */
export function universityTitle(name: string) {
  return `${name} | Courses, Fees & Admissions`;
}

/**
 * A university's own short description, or, without one, a sentence built
 * from what the record holds: where it is and how many of its courses the
 * catalogue profiles. Nothing is claimed that the page does not show.
 */
export function universityDescription(university: {
  name: string;
  shortDescription: string | null;
  city?: string | null;
  country: { name: string; iso2Code: string | null } | null;
  courses: number;
}) {
  const own = university.shortDescription?.trim();
  if (own) return own;
  const { name, city, country, courses } = university;
  const where = country
    ? city
      ? ` in ${city}, ${country.name}`
      : ` in ${inCountry(country.name, country.iso2Code)}`
    : city
      ? ` in ${city}`
      : '';
  const what = courses
    ? `${courses} ${courses === 1 ? 'course' : 'courses'}, intakes, entry requirements and visa guidance`
    : 'intakes, entry requirements and visa guidance';
  return `Study at ${name}${where}: ${what}.`;
}

/** "MSc Computer Science at University of Warwick | Fees, Eligibility & Intakes". */
export function offeringTitle(course: string, university: string) {
  return `${course} at ${university} | Fees, Eligibility & Intakes`;
}
