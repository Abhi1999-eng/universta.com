import type { Metadata } from 'next';
import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import { ConsultantCompareSync } from '@/components/study-abroad/ConsultantCompare';
import { RecordCompare, type CompareRow } from '@/components/study-abroad/RecordCompare';
import { displayUrl, externalHttpUrl } from '@/lib/consultant-profile';
import { counsellingHref } from '@/lib/counselling-link';
import { liveLocationLinks } from '@/lib/country-consultant-list';
import { formatDate } from '@/lib/format';
import { phaseCompare, phaseComparisonOptions } from '@/lib/phase1';
import { COMPARE_LIMIT, readCompareSlugs } from '@/lib/record-compare';
import { staticPageMetadata } from '@/lib/static-page-seo';
import '../../consultants-zip.css';

/**
 * Consultants side by side, in the approved design: the destinations,
 * services, languages and offices each lists, and whether the record has
 * been verified. Paid placement plays no part, and nothing is scored.
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const metadata = await staticPageMetadata(
    'compare-consultants',
    'Compare consultants',
    'Compare published study-abroad consultants side by side.',
    '/compare/consultants',
    false,
  );
  return { ...metadata, title: { absolute: String(metadata.title) } };
}

type Dict = Record<string, unknown>;
/* The compare endpoint's rows carry more than the typed record names. */
type Comparison = { items: Dict[]; invalid: string[] };

const NONE = 'Not published';
const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);
const names = (value: unknown, key: string | null) =>
  (Array.isArray(value) ? (value as Dict[]) : [])
    .map((entry) => text((key ? (entry[key] as Dict | undefined) : entry)?.name))
    .filter((name): name is string => Boolean(name));

export default async function CompareConsultants({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const requested = readCompareSlugs(await searchParams);
  const [result, options] = await Promise.all([
    requested.length
      ? phaseCompare<Comparison>('consultants', requested).catch(() => null)
      : Promise.resolve<Comparison>({ items: [], invalid: [] }),
    phaseComparisonOptions<{ slug: string; name: string }>('consultants').catch(() => []),
  ]);
  const byslug = new Map((result?.items ?? []).flatMap((row) => (text(row.slug) ? [[String(row.slug), row] as const] : [])));
  const items = requested.flatMap((slug) => (byslug.has(slug) ? [byslug.get(slug)!] : []));
  const invalid = result ? requested.filter((slug) => !byslug.has(slug)) : [];

  /* Each cell keyed by its column: the rows cross to the client as props,
     and React asks for keys on any list of elements it carries. */
  const cell = (render: (row: Dict) => ReactNode) =>
    items.map((row) => <Fragment key={String(row.slug)}>{render(row) ?? NONE}</Fragment>);
  const list = (values: string[]) => (values.length ? values.join(', ') : null);
  const rows: CompareRow[] = [
    { label: 'Destinations', cells: cell((row) => list(names(row.countries, 'country'))) },
    { label: 'Services', cells: cell((row) => list(names(row.services, null))) },
    { label: 'Languages', cells: cell((row) => list(names(row.languages, null))) },
    {
      label: 'Offices',
      cells: cell((row) => {
        const offices = liveLocationLinks(row.locations)
          .map((entry) => {
            const location = (entry.location ?? {}) as Dict;
            const name = text(location.name);
            const city = text(location.city);
            return [name, city && city !== name ? city : null].filter(Boolean).join(', ');
          })
          .filter(Boolean);
        return list(offices);
      }),
    },
    {
      label: 'Verification',
      cells: cell((row) =>
        row.verificationStatus === 'VERIFIED'
          ? `Verified${text(row.verifiedAt) ? ` ${formatDate(String(row.verifiedAt))}` : ''}`
          : 'Not yet verified',
      ),
    },
    {
      label: 'Contact details',
      cells: cell((row) => {
        const channels = [text(row.email) ? 'email' : null, text(row.phone) ? 'phone' : null].filter(Boolean);
        return channels.length ? `Published on the profile (${channels.join(' and ')})` : null;
      }),
    },
    {
      label: 'Website',
      /* Linked only when it is an absolute web address; a bare "www.…"
         would be a link to a page of our own that does not exist. */
      cells: cell((row) => {
        const raw = text(row.websiteUrl);
        const website = externalHttpUrl(raw);
        return website ? (
          <a href={website} rel="nofollow noopener" target="_blank">
            {displayUrl(website)}
          </a>
        ) : raw ? (
          displayUrl(raw)
        ) : null;
      }),
    },
    { label: 'In a sentence', cells: cell((row) => text(row.shortDescription)) },
    {
      label: 'Profile',
      cells: cell((row) => <Link href={`/study-abroad-consultants/${row.slug}`}>Open the profile</Link>),
    },
    {
      /* The design's last row: guidance about each consultant, asked from
         its own profile, so the request says which one the reader meant. */
      label: 'Next step',
      cells: cell((row) => (
        <Link
          className="btn btn--sm"
          href={counsellingHref({ source: 'general', from: `/study-abroad-consultants/${String(row.slug)}` })}
        >
          Get guidance{' '}
          <span className="btn__arrow" aria-hidden="true">
            &rarr;
          </span>
        </Link>
      )),
    },
  ];

  return (
    <>
      {/* The tray on the consultants pages shows what was just compared. */}
      <ConsultantCompareSync
        items={items.map((row) => ({ slug: String(row.slug), name: String(row.name) }))}
      />
      <RecordCompare
        kind="consultants"
        max={COMPARE_LIMIT}
        crumbs={[
          { label: 'Home', href: '/' },
          { label: 'Consultants', href: '/study-abroad-consultants' },
          { label: 'Compare' },
        ]}
        eyebrow="Compare consultants"
        title="Compare study abroad consultants"
        lead="Put consultants side by side on destinations, services, languages, offices and verification. Paid placement plays no part, and nothing here is a rating."
        noun={['consultant', 'consultants']}
        columns={items.map((row) => ({
          slug: String(row.slug),
          name: String(row.name),
          meta: list(names(row.countries, 'country').slice(0, 3)),
          href: `/study-abroad-consultants/${row.slug}`,
        }))}
        rows={rows}
        options={options}
        selected={requested}
        invalid={invalid}
        unavailable={result === null}
        browse={{ href: '/study-abroad-consultants', label: 'Browse consultants' }}
        note="Consultants are independent providers. Universta lists what each publishes on its own record and endorses none of them."
        counselling={{
          heading: 'Want a second opinion first?',
          body: 'A free Universta counselling session can sanity-check your shortlist before you engage a consultant.',
          href: '/counselling?source=general&from=%2Fcompare%2Fconsultants',
        }}
      />
    </>
  );
}
