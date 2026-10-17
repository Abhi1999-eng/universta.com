/**
 * Whether a specialization has anything of its own on its page.
 *
 * A specialization can be published with nothing written about it, and a
 * page with nothing of its own is not worth sending crawlers to: its page
 * is kept out of the index, and the sitemap leaves it out. An editor's own
 * description, in the record or in its SEO, counts as something written; a
 * bulk template's does not. The sitemap reads list rows, which carry the
 * descriptions but no sections, questions or SEO, so it can only ever say
 * no where the page would say yes -- never the reverse.
 */
export function specializationHasOwnWords(specialization: {
  shortDescription?: string | null;
  overview?: string | null;
  contentSections?: readonly unknown[] | null;
  faqs?: readonly unknown[] | null;
  seo?: { source?: { description?: string } } | null;
}): boolean {
  return Boolean(
    specialization.shortDescription?.trim() ||
      specialization.overview?.trim() ||
      specialization.contentSections?.length ||
      specialization.faqs?.length ||
      specialization.seo?.source?.description === 'manual',
  );
}
