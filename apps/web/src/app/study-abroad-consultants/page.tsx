import { getListingPageContent } from '@/lib/listing-page-content';
import type { AnyRecord } from '@/components/phase1/PhaseOneViews';
import {
  ConsultantsReference,
  type ConsultantRow,
} from '@/components/reference/ConsultantsReference';
import { phaseList } from '@/lib/phase1';
import { staticPageMetadata } from '@/lib/static-page-seo';

export const dynamic = 'force-dynamic';
export async function generateMetadata() {
  return staticPageMetadata(
    'consultants-listing',
    'Study abroad consultants',
    'Explore currently published study abroad consultants, their locations and services.',
    '/study-abroad-consultants',
  );
}

/** Only the keys the consultants list endpoint actually honours. */
const SUPPORTED = [
  'q',
  'country',
  'region',
  'state',
  'city',
  'location',
  'service',
  'language',
  'verified',
  'sort',
  'page',
] as const;

type Row = Record<string, unknown>;

function names(value: unknown, key: 'country' | 'location' | null): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const record = entry as Row;
      const nested = key ? (record[key] as Row | undefined) : record;
      return nested?.name ? String(nested.name) : '';
    })
    .filter(Boolean);
}

function slugs(value: unknown, key: 'country' | 'location' | null): Array<[string, string]> {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const record = entry as Row;
      const nested = key ? (record[key] as Row | undefined) : record;
      return nested?.slug && nested?.name
        ? ([String(nested.slug), String(nested.name)] as [string, string])
        : null;
    })
    .filter(Boolean) as Array<[string, string]>;
}

function toRow(record: AnyRecord): ConsultantRow {
  const row = record as unknown as Row;
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    shortDescription: typeof row.shortDescription === 'string' ? row.shortDescription : null,
    verified: row.verificationStatus === 'VERIFIED',
    countries: names(row.countries, 'country'),
    services: names(row.services, null),
    languages: names(row.languages, null),
    locations: names(row.locations, 'location'),
  };
}

export default async function ConsultantsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const filters = Object.fromEntries(
    SUPPORTED.flatMap((key) => {
      const value = raw[key];
      return typeof value === 'string' && value ? [[key, value]] : [];
    }),
  ) as Record<string, string>;

  let rows: ConsultantRow[] = [];
  let meta = { page: 1, limit: 12, total: 0, totalPages: 0 };
  let everything: AnyRecord[] = [];
  // A directory with no published consultants and a directory we could not
  // load are different facts. Collapsing the second into the first told a
  // visitor "0 consultants" during an API outage, which is simply untrue, and
  // hid the outage from anyone watching the page.
  let loadFailed = false;
  try {
    const [result, all] = await Promise.all([
      phaseList<AnyRecord>('consultants', { limit: '12', ...filters }),
      // Unfiltered, so the facets are derived from the whole directory and can
      // never offer a value that returns nothing. Facets are decoration: if
      // only this call fails the directory itself is still trustworthy.
      phaseList<AnyRecord>('consultants', { limit: '100' })
        .then((r) => r.data)
        .catch(() => []),
    ]);
    rows = result.data.map(toRow);
    meta = result.meta as typeof meta;
    everything = all;
  } catch {
    loadFailed = true;
  }

  function facet(pick: (row: Row) => Array<[string, string]>) {
    const map = new Map<string, string>();
    for (const record of everything) {
      for (const [value, label] of pick(record as unknown as Row)) map.set(value, label);
    }
    return [...map.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  const managed = await getListingPageContent('consultants-listing');

  return (
    <ConsultantsReference
      rows={rows}
      meta={meta}
      loadFailed={loadFailed}
      filters={filters}
      facets={{
        countries: facet((row) => slugs(row.countries, 'country')),
        services: facet((row) => slugs(row.services, null)),
        languages: facet((row) =>
          Array.isArray(row.languages)
            ? (row.languages as Row[])
                .map((entry) =>
                  entry.code && entry.name
                    ? ([String(entry.code), String(entry.name)] as [string, string])
                    : null,
                )
                .filter(Boolean) as Array<[string, string]>
            : [],
        ),
        locations: facet((row) => slugs(row.locations, 'location')),
      }}
      heading={managed.heading ?? 'Guidance from people who know your'}
      headingAccent={managed.heading ? '' : 'destination'}
      lede={
        managed.lede ??
        'Published consultants with their destinations, services, languages and contact details — no ratings, no paid placement.'
      }
    />
  );
}
