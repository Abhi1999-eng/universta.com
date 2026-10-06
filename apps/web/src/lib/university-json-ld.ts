import { isValidElement, type ReactNode } from 'react';
import { siteOrigin } from './site-origin';

/**
 * Structured data for a university's pages: its profile, its course list
 * and each course.
 *
 * Each block is built from what the page already shows -- the breadcrumb
 * trail it draws, the questions it answers, the record it reads -- so the
 * data never says more than the page does, and a field the record lacks is
 * left out rather than filled. The design's university and course pages
 * carry a BreadcrumbList, the institution or course and a FAQPage; the
 * behaviour reference describes a university as a CollegeOrUniversity with
 * its own site as `sameAs`.
 */

type Data = Record<string, unknown>;

export type Crumb = { label: string; href?: string };

/** The page's breadcrumb trail; the last step, unlinked, is the page. */
export function breadcrumbJsonLd(trail: Crumb[], here: string, origin = siteOrigin): Data {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((step, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: step.label,
      item: new URL(step.href ?? here, origin).toString(),
    })),
  };
}

/** The text a reader sees in an answer, links and all, without the markup. */
export function plainText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(plainText).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) return plainText(node.props.children);
  return '';
}

/** The questions a page answers, or nothing when it answers none. */
export function faqJsonLd(
  faqs: Array<{ question: string; answer: string }>,
): Data | null {
  const answered = faqs
    .map((faq) => ({
      question: faq.question.trim(),
      answer: faq.answer.replace(/\s+/g, ' ').trim(),
    }))
    .filter((faq) => faq.question && faq.answer);
  if (!answered.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: answered.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  };
}

/**
 * The institution, from its record: its name and page, its own website,
 * the year it was founded, and where its first campus is.
 */
export function universityJsonLd(
  university: {
    name: string;
    slug: string;
    shortDescription: string | null;
    websiteUrl: string | null;
    establishedYear: number | null;
    city?: string | null;
    region?: string | null;
    country: { name: string; iso2Code: string | null } | null;
  },
  origin = siteOrigin,
): Data {
  const { city, region, country } = university;
  const address =
    city || region || country
      ? {
          '@type': 'PostalAddress',
          ...(city ? { addressLocality: city } : {}),
          ...(region ? { addressRegion: region } : {}),
          ...(country ? { addressCountry: country.iso2Code ?? country.name } : {}),
        }
      : null;
  return {
    '@context': 'https://schema.org',
    '@type': 'CollegeOrUniversity',
    name: university.name,
    url: new URL(`/universities/${university.slug}`, origin).toString(),
    ...(university.websiteUrl ? { sameAs: university.websiteUrl } : {}),
    ...(university.shortDescription ? { description: university.shortDescription } : {}),
    ...(university.establishedYear
      ? { foundingDate: String(university.establishedYear) }
      : {}),
    ...(address ? { address } : {}),
  };
}
