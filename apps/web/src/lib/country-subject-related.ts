import type { AnyRecord } from '@/components/phase1/PhaseOneViews';
import type { RelatedGroup } from '@/components/study-abroad/DiscoveryBands';
import { phaseList } from '@/lib/phase1';
import { awardLabel, benefitLabel } from '@/lib/scholarship-card';
import { universityHref } from '@/lib/university-links';

/**
 * The cross-links a field's page in one destination closes on: who teaches
 * it there, the funding open to students going there, and the people who
 * advise them.
 *
 * Each is read on its own and a failure costs that group, never the page:
 * the closing band leaves out a group with nothing in it. Each group's
 * count is the list's own total, not the handful it names -- "Scholarships
 * for the United Kingdom 5" over seven read as all of them.
 */

const baseUrl = process.env.API_BASE_URL ?? 'http://127.0.0.1:4000';

/** How many a scholarship or consultant group names. The design's band
 *  names five of each. */
const NAMED = 5;
/** How many universities a group names, as the subject's own group does. */
const UNIVERSITIES_NAMED = 6;

/** The list's total, never fewer than it named: an older API that sends no
 *  total, or a short one, would otherwise print a count under its list. */
export function listTotal(meta: unknown, named: number): number {
  const counted = Number((meta as { total?: unknown } | null)?.total);
  return Number.isFinite(counted) ? Math.max(counted, named) : named;
}

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

/** A scholarship as a row of the band: its title, and what it is worth or,
 *  when no figure is recorded, what it covers. */
export function scholarshipItems(rows: readonly AnyRecord[]): RelatedGroup['items'] {
  return rows
    .filter((row) => text(row.slug) && text(row.title))
    .map((row) => ({
      id: String(row.id ?? row.slug),
      name: text(row.title)!,
      href: `/scholarships/${text(row.slug)}`,
      note: awardLabel(row.amount, row.currencyCode) ?? benefitLabel(row.benefitType),
    }));
}

/** A consultant as a row of the band: its name, where it is, and whether
 *  Universta has verified it -- the design's own second line, because a
 *  reader choosing between advisers should not have to open each to learn
 *  which ones are. */
export function consultantItems(rows: readonly AnyRecord[]): RelatedGroup['items'] {
  return rows
    .filter((row) => text(row.slug) && text(row.name))
    .map((row) => {
      const listed = (row as { locations?: unknown }).locations;
      const locations = Array.isArray(listed)
        ? (listed as Array<{ location?: { city?: unknown } | null } | null>)
        : [];
      const city = locations
        .map((entry) => text(entry?.location?.city))
        .find(Boolean);
      const verified =
        row.verificationStatus === 'VERIFIED' ? 'Verified' : 'Not yet verified';
      return {
        id: String(row.id ?? row.slug),
        name: text(row.name)!,
        href: `/study-abroad-consultants/${text(row.slug)}`,
        note: [city, verified].filter(Boolean).join(' · '),
      };
    });
}

/** The scholarships open to students going to one destination. */
export async function scholarshipsGroup(
  countrySlug: string,
  where: string,
): Promise<RelatedGroup> {
  const title = `Scholarships for ${where}`;
  return phaseList<AnyRecord>('scholarships', {
    country: countrySlug,
    limit: String(NAMED),
  })
    .then((result) => {
      const items = scholarshipItems(result.data);
      return { title, items, total: listTotal(result.meta, items.length) };
    })
    .catch(() => ({ title, items: [] }));
}

/** The consultants who advise students going to one destination. They
 *  carry no subject, so the group is the destination's, said as such. */
export async function consultantsGroup(
  countrySlug: string,
  where: string,
): Promise<RelatedGroup> {
  const title = `Consultants for ${where}`;
  return phaseList<AnyRecord>('consultants', {
    country: countrySlug,
    limit: String(NAMED),
  })
    .then((result) => {
      const items = consultantItems(result.data);
      return { title, items, total: listTotal(result.meta, items.length) };
    })
    .catch(() => ({ title, items: [] }));
}

type TeachingUniversity = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
};

/**
 * The universities that teach one specialization in one destination, and
 * how many there are -- null when that could not be read, so the figures
 * strip can leave the cell out instead of stating a zero it does not know.
 *
 * The university list narrows to a subject and not to a branch of one, so
 * it answered "Software Engineering in the United Kingdom" with every UK
 * university teaching any Computer Science. This asks the specialization's
 * own list, which counts the universities with a live offering under it.
 */
export async function specializationUniversities(
  subject: { slug: string },
  specialization: { slug: string; name: string },
  country: { slug: string },
  where: string,
): Promise<{ group: RelatedGroup; total: number | null }> {
  const title = `Universities teaching ${specialization.name} in ${where}`;
  const query = new URLSearchParams({
    country: country.slug,
    limit: String(UNIVERSITIES_NAMED),
  });
  const path = `/api/v1/subjects/${encodeURIComponent(subject.slug)}/specializations/${encodeURIComponent(specialization.slug)}/universities?${query}`;
  try {
    const response = await fetch(new URL(path, baseUrl), {
      cache: 'no-store',
      headers: { accept: 'application/json' },
    });
    const body = (await response.json()) as {
      data: TeachingUniversity[] | null;
      meta: unknown;
      error: unknown;
    };
    if (!response.ok || body.error || !Array.isArray(body.data))
      throw new Error('Universities unavailable');
    const items = body.data.map((row) => ({
      id: row.id,
      name: row.name,
      href: universityHref(row.slug),
      note: row.city,
    }));
    const total = listTotal(body.meta, items.length);
    return { group: { title, items, total }, total };
  } catch {
    return { group: { title, items: [] }, total: null };
  }
}
