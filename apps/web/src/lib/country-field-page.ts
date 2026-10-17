import type { CountryFieldPageRow } from './catalog';
import { formatNumber } from './format';

/**
 * A field in one destination -- /study-abroad/{country}/{subject} and
 * /study-abroad/{country}/{subject}/{specialization} -- as its two pages and
 * the sitemap describe it.
 *
 * The pages and the sitemap have to agree on which of these pages ask to be
 * indexed, and the rule sits here so they read it from one place.
 */

/**
 * Whether a country subject or country specialization page asks to be
 * indexed. The page is indexed whole; a searched, filtered, sorted or
 * further-loaded programme list is a slice of it, kept out of the index with
 * its links still followed. Nothing else on the page changes the answer --
 * not what is listed there, and not the field's own robots setting, which
 * governs the field's own page.
 */
export function countryFieldIndexed({ narrowed }: { narrowed: boolean }): boolean {
  return !narrowed;
}

const counted = (count: number, one: string, many: string) =>
  `${formatNumber(count)} ${count === 1 ? one : many}`;

/** "a, b and c". */
function listed(parts: string[]) {
  return parts.length < 2
    ? parts.join('')
    : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/**
 * The page's meta description.
 *
 * It was the field's short description, the same on every destination: a
 * subject published in two hundred destinations had two hundred pages
 * telling a search engine the same sentence. Each now names its own
 * destination and says what the page shows there. A count is named only
 * when there is something to count: "0 programmes" would read as a fact
 * about the destination when it is a gap in the catalogue.
 *
 * The field's own SEO description is not used, even where an editor or a
 * bulk template wrote one: it was written for the field's page, which
 * covers every destination, and after the destination it read "Study AI
 * in Japan. Compare AI degrees abroad: ...". A destination and a field
 * together have no SEO record of their own, so this sentence is always
 * the page's.
 */
export function countryFieldDescription(input: {
  field: string;
  /** "Japan", "the United Kingdom": the destination, as the page names it. */
  where: string;
  /** A specialization's subject, which its page names in the opening line. */
  subject?: string | null;
  /** The universities' programmes listed here, and at how many
   *  universities; null where they could not be read. */
  programmes?: number | null;
  universities?: number | null;
  /** The field's specializations, which a subject's page lists. */
  specializations?: number | null;
  /** The questions the page answers. */
  faqs?: number | null;
}): string {
  const opening = `Study ${input.field} in ${input.where}`;
  const programmes = input.programmes ?? 0;
  const universities = input.universities ?? 0;
  const specializations = input.specializations ?? 0;
  const shows = [
    ...(programmes > 0
      ? [
          counted(programmes, 'programme', 'programmes') +
            (universities > 0
              ? ` at ${counted(universities, 'university', 'universities')}`
              : ''),
        ]
      : []),
    ...(specializations > 0
      ? [counted(specializations, 'specialization', 'specializations')]
      : []),
    'the study levels it is offered at',
    ...((input.faqs ?? 0) > 0 ? ['answers to common questions'] : []),
    'advice on applying',
  ];
  const within = input.subject ? `, a specialization within ${input.subject}` : '';
  return `${opening}${within}: ${listed(shows)}.`;
}

/**
 * The country subject and country specialization pages the sitemap lists,
 * each with when it last changed.
 *
 * The rows are the pages the site renders -- published destination, under
 * no region or a live one as its guide requires, published field, the
 * pair's link active -- read in one call. Each is
 * listed at its bare address, which its page indexes (`countryFieldIndexed`
 * with nothing narrowed); a row the page would not index is left out by the
 * same rule. A row missing a slug names no page and is skipped.
 */
export function countryFieldPaths(
  rows: readonly CountryFieldPageRow[],
): Array<{ path: string; lastModified?: string }> {
  if (!countryFieldIndexed({ narrowed: false })) return [];
  return rows.flatMap((row) => {
    if (!row.countrySlug || !row.subjectSlug) return [];
    const path = `/study-abroad/${row.countrySlug}/${row.subjectSlug}${
      row.specializationSlug ? `/${row.specializationSlug}` : ''
    }`;
    return [row.updatedAt ? { path, lastModified: row.updatedAt } : { path }];
  });
}
