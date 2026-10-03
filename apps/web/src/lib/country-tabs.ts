import type { AnyRecord } from '@/components/phase1/PhaseOneViews';
import { countryTabs, type CountryTab } from '@/components/study-abroad/CountryTabs';
import { phaseList } from '@/lib/phase1';

/**
 * The counts behind a destination's tab strip, read once per page.
 *
 * Each is a head count rather than a page of records -- `limit: 1` and the
 * total off the envelope -- because the strip needs the number, not the
 * rows. A failure leaves that tab reading zero, which drops it, rather than
 * taking down the page the reader actually asked for.
 */
export async function loadCountryTabs(
  countrySlug: string,
  subjects: number,
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
  const [universities, scholarships] = await Promise.all([
    total('universities'),
    total('scholarships'),
  ]);
  return countryTabs(countrySlug, { subjects, universities, scholarships });
}
