import type { AnyRecord } from '@/components/phase1/PhaseOneViews';
import { countryTabs, type CountryTab } from '@/components/study-abroad/CountryTabs';
import { phaseList } from '@/lib/phase1';
import { getSubjects } from '@/lib/catalog';

/**
 * The counts behind a destination's tab strip, read once per page.
 *
 * Each is a head count rather than a page of records -- `limit: 1` and the
 * total off the envelope -- because the strip needs the number, not the
 * rows. A failure leaves that tab reading zero, which drops it, rather than
 * taking down the page the reader actually asked for.
 *
 * The subject count is resolved here rather than taken from the caller,
 * because it has a fallback and the callers did not all apply it: a
 * destination with no subject links of its own shows the catalogue's, so
 * the guide was saying there were none while the page one click away was
 * listing thirty, and the tab that led there did not appear at all.
 */
export async function loadCountryTabs(
  countrySlug: string,
  linkedSubjects: number,
): Promise<CountryTab[]> {
  const total = (resource: string) =>
    destinationTotal(countrySlug, resource).then((value) => value ?? 0);
  const [universities, scholarships, catalogue] = await Promise.all([
    total('universities'),
    total('scholarships'),
    linkedSubjects
      ? Promise.resolve(0)
      : getSubjects({ limit: '1' })
          .then((result) => {
            const value = Number(
              (result.meta as { total?: unknown } | null)?.total,
            );
            return Number.isFinite(value) ? value : 0;
          })
          .catch(() => 0),
  ]);
  return countryTabs(countrySlug, {
    subjects: linkedSubjects || catalogue,
    universities,
    scholarships,
  });
}

/**
 * How many of one resource a destination lists -- universities,
 * scholarships, consultants -- or null when the catalogue did not say.
 *
 * `meta` is untyped on this client, so the total is read defensively: a
 * resource that answers without one is unknown rather than NaN, which would
 * render as a tab labelled "NaN".
 */
export function destinationTotal(countrySlug: string, resource: string): Promise<number | null> {
  return phaseList<AnyRecord>(resource, { country: countrySlug, limit: '1' })
    .then((result) => {
      const value = Number((result.meta as { total?: unknown } | null)?.total);
      return Number.isFinite(value) ? value : null;
    })
    .catch(() => null);
}

/**
 * The counts the strip was built from, for a page that links to the same
 * places from somewhere else on it. A tab that is not shown has nothing
 * behind it, which is exactly when the link should not be offered either.
 */
export function tabCounts(tabs: CountryTab[]): {
  universities: number;
  scholarships: number;
} {
  const count = (key: CountryTab['key']) =>
    tabs.find((tab) => tab.key === key)?.count ?? 0;
  return {
    universities: count('universities'),
    scholarships: count('scholarships'),
  };
}
