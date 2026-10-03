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
  /* `meta` is untyped on this client, so the total is read defensively:
     a resource that answers without one counts as zero rather than as NaN,
     which would render as a tab labelled "NaN". */
  const total = (resource: string) =>
    phaseList<AnyRecord>(resource, { country: countrySlug, limit: '1' })
      .then((result) => {
        const value = Number((result.meta as { total?: unknown } | null)?.total);
        return Number.isFinite(value) ? value : 0;
      })
      .catch(() => 0);
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
