import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { AnyRecord } from '@/components/phase1/PhaseOneViews';
import { CountryConsultantIndex } from '@/components/study-abroad/CountryConsultantIndex';
import { CountryListSearch } from '@/components/study-abroad/CountryListSearch';
import { CountryTabs } from '@/components/study-abroad/CountryTabs';
import { ConnectBand } from '@/components/study-abroad/DiscoveryBands';
import { FlagMark } from '@/components/study-abroad/FlagMark';
import { PlanBand } from '@/components/study-abroad/PlanBand';
import { inCountry } from '@/lib/country-article';
import {
  consultantListHref,
  consultantOptions,
  countryConsultantsHref,
  isNarrowedConsultantList,
  toConsultantRows,
} from '@/lib/country-consultant-list';
import { countryScholarshipsHref } from '@/lib/country-scholarship-list';
import { loadCountryTabs } from '@/lib/country-tabs';
import { formatNumber } from '@/lib/format';
import { phaseListAll } from '@/lib/phase1';
import { getDestinations, getStudyAbroadCountry } from '@/lib/study-abroad';
import { countryUniversitiesHref } from '@/lib/university-links';

/**
 * The consultants who list one destination, under the destination.
 *
 * The behaviour reference ends a guide's consultants block with "View all
 * consultants" to /study-abroad/<country>/consultants: its tabs, a search,
 * filters, "Load more", and the cities those consultants are in. The guide
 * here sent the same reader to the worldwide directory in the older design,
 * where the destination was one filter among many; that directory still
 * answers `/study-abroad-consultants?country=` for the links that use it.
 *
 * The reference's tab strip has no Consultants tab -- this page sits beside
 * the four, reached from the guide -- so none of them is marked here.
 */
export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ countrySlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** How many of the commonest values the snapshot names. */
const SNAPSHOT_NAMED = 3;

async function load(slug: string) {
  const page = await getStudyAbroadCountry(slug);
  if (!page) return null;
  const [list, directory] = await Promise.all([
    phaseListAll<AnyRecord>('consultants', { country: slug }).catch(() => null),
    /* Which of the other destinations a card names have a guide, and so a
       consultants page of their own to link to. Its failure only leaves
       those names unlinked. */
    getDestinations().catch(() => null),
  ]);
  return {
    page,
    failed: list === null,
    rows: toConsultantRows(list?.data ?? []),
    guides: (directory?.available ?? []).flatMap((entry) => (entry.slug ? [entry.slug] : [])),
  };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { countrySlug } = await params;
  const page = await getStudyAbroadCountry(countrySlug);
  const country = page?.country;
  if (!country)
    return {
      title: { absolute: 'Destination not found | Universta' },
      robots: { index: false },
    };
  const where = inCountry(country.name, country.iso2Code);
  const narrowed = isNarrowedConsultantList(await searchParams);
  return {
    title: { absolute: `Study abroad consultants for ${where} | Universta` },
    description: `Consultants on Universta who support students planning to study in ${where}: where they are, what they help with and the languages they work in.`,
    ...(narrowed
      ? { robots: { index: false, follow: true } }
      : { alternates: { canonical: countryConsultantsHref(country.slug) } }),
  };
}

/** "Delhi, Pune and Leeds". */
function named(values: string[]): string {
  if (values.length <= 1) return values[0] ?? '';
  return `${values.slice(0, -1).join(', ')} and ${values[values.length - 1]}`;
}

export default async function Page({ params }: Props) {
  const { countrySlug } = await params;
  const loaded = await load(countrySlug);
  if (!loaded) notFound();
  const { page, rows, failed, guides } = loaded;
  const { country } = page;
  const where = inCountry(country.name, country.iso2Code);
  const tabs = await loadCountryTabs(country.slug, (country.subjects ?? []).length);
  const tab = (key: string) => tabs.find((entry) => entry.key === key);
  const subjectsTab = tab('subjects');
  const universitiesTab = tab('universities');
  const scholarshipsTab = tab('scholarships');

  const options = consultantOptions(rows);
  const path = countryConsultantsHref(country.slug);
  const noun = rows.length === 1 ? 'consultant' : 'consultants';

  /* The design's snapshot, from the consultants themselves: every row is a
     count or the commonest values among them, and a row with nothing
     behind it is left out. */
  const snapshot = [
    rows.length
      ? {
          label: 'Verified by Universta',
          value: `${formatNumber(options.verified)} of ${formatNumber(rows.length)}`,
        }
      : null,
    options.cities.length
      ? {
          label: 'Where they see students',
          value: named(options.cities.slice(0, SNAPSHOT_NAMED).map((option) => option.label)),
          note:
            options.cities.length > SNAPSHOT_NAMED
              ? `And ${options.cities.length - SNAPSHOT_NAMED} more ${options.cities.length - SNAPSHOT_NAMED === 1 ? 'city' : 'cities'}`
              : null,
        }
      : null,
    options.services.length
      ? {
          label: 'Services listed most',
          value: named(options.services.slice(0, SNAPSHOT_NAMED).map((option) => option.label)),
        }
      : null,
    options.languages.length
      ? {
          label: 'Languages',
          value: named(options.languages.slice(0, SNAPSHOT_NAMED).map((option) => option.label)),
          note:
            options.languages.length > SNAPSHOT_NAMED
              ? `And ${options.languages.length - SNAPSHOT_NAMED} more`
              : null,
        }
      : null,
  ].filter((row): row is { label: string; value: string; note?: string | null } => Boolean(row));

  return (
    <>
      <section className="hero hero--compact">
        <div className="wrap">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span className="crumbs__sep" aria-hidden="true">
              /
            </span>
            <Link href="/study-abroad">Study abroad</Link>
            <span className="crumbs__sep" aria-hidden="true">
              /
            </span>
            <Link href={`/study-abroad/${country.slug}`}>{country.name}</Link>
            <span className="crumbs__sep" aria-hidden="true">
              /
            </span>
            <span aria-current="page">Consultants</span>
          </nav>

          <div className="hero__grid conshero">
            <div className="hero__main">
              <p className="hero__eyebrow">
                <FlagMark iso2Code={country.iso2Code ?? null} bands={null} />{' '}
                {rows.length ? `${formatNumber(rows.length)} ${noun}` : country.name}
              </p>
              <h1 className="hero__h1">Study abroad consultants for {where}</h1>
              <p className="hero__sub">
                {failed
                  ? `The consultants for ${where} could not be loaded just now. Please try again shortly.`
                  : rows.length
                    ? `${rows.length === 1 ? 'One consultant' : `${formatNumber(rows.length)} consultants`} on Universta ${rows.length === 1 ? 'supports' : 'support'} students planning to study in ${where}. Compare where they are and what they help with, then request guidance through Universta.`
                    : `No consultant on Universta lists ${where} yet. A counsellor can still help you plan.`}
              </p>
              {rows.length ? (
                <CountryListSearch
                  placeholder="Consultant, city or service"
                  label={`Search consultants for ${where}`}
                />
              ) : null}
              <div className="btn-row unilinks">
                <Link className="linkcta" href={`/study-abroad/${country.slug}`}>
                  Studying in {where}{' '}
                  <span className="linkcta__arrow" aria-hidden="true">
                    &rarr;
                  </span>
                </Link>
                <Link className="linkcta" href="/study-abroad-consultants">
                  Consultants everywhere{' '}
                  <span className="linkcta__arrow" aria-hidden="true">
                    &rarr;
                  </span>
                </Link>
              </div>
            </div>

            {snapshot.length ? (
              <aside className="snap" aria-label={`${country.name} consultants snapshot`}>
                <div className="snap__head">
                  <span className="snap__title">At a glance</span>
                  <span className="badge badge--neutral">
                    {formatNumber(rows.length)} listed
                  </span>
                </div>
                {snapshot.map((row) => (
                  <div className="snap__row" key={row.label}>
                    <span className="snap__k">{row.label}</span>
                    <span className="snap__v">{row.value}</span>
                    {row.note ? <span className="snap__n">{row.note}</span> : null}
                  </div>
                ))}
              </aside>
            ) : null}
          </div>
        </div>
      </section>

      <CountryTabs tabs={tabs} />

      {failed ? (
        <section className="sec sec--white sec--tight" id="consultants">
          <div className="wrap">
            <div className="dir__none">
              <p>The consultants for {where} could not be loaded just now.</p>
              <Link className="btn btn--sm btn--ghost" href={path}>
                Try again
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <CountryConsultantIndex
          rows={rows}
          countrySlug={country.slug}
          where={where}
          guides={guides}
        />
      )}

      {/* The reference's "consultants by city", as the design's chip rows:
          every city and service the consultants here carry, with how many,
          each a link into the list above. */}
      {options.cities.length > 1 || options.services.length > 1 ? (
        <section className="sec sec--paper sec--tight" id="by-city">
          <div className="wrap">
            {options.cities.length > 1 ? (
              <div className="citychips conschips">
                <span className="label">{country.name} consultants in</span>
                {options.cities.map((option) => (
                  <Link
                    className="specchip specchip--live"
                    key={option.value}
                    href={`${consultantListHref(path, { cities: [option.value] })}#consultants`}
                  >
                    {option.label}
                    <em>{option.count}</em>
                  </Link>
                ))}
              </div>
            ) : null}
            {options.services.length > 1 ? (
              <div className="citychips conschips">
                <span className="label">By service</span>
                {options.services.map((option) => (
                  <Link
                    className="specchip"
                    key={option.value}
                    href={`${consultantListHref(path, { services: [option.value] })}#consultants`}
                  >
                    {option.label}
                    <em>{option.count}</em>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <PlanBand
        heading="Not sure which consultant is right for you?"
        body={`Tell Universta what you are planning to study in ${where}, and a counsellor will help you explore the options that fit.`}
        countrySlug={country.slug}
        countryName={country.name}
        secondary={{
          href: `/study-abroad/${country.slug}`,
          label: `${country.name} guide`,
        }}
      />

      {/* The reference's "Plan your studies in": the rest of the
          destination, each link already narrowed to it. */}
      <ConnectBand
        actions={[
          { href: `/study-abroad/${country.slug}`, label: `Study in ${where}` },
          ...(universitiesTab
            ? [
                {
                  href: countryUniversitiesHref(country.slug),
                  label: 'Universities here',
                  ghost: true,
                },
              ]
            : []),
          ...(subjectsTab
            ? [{ href: subjectsTab.href, label: 'Subjects here', ghost: true }]
            : []),
          ...(scholarshipsTab
            ? [
                {
                  href: countryScholarshipsHref(country.slug),
                  label: 'Scholarships',
                  ghost: true,
                },
              ]
            : []),
        ]}
        groups={[
          {
            title: `Subjects in ${where}`,
            total: (country.subjects ?? []).length,
            items: (country.subjects ?? []).slice(0, 6).map((subject) => ({
              id: subject.id,
              name: subject.name,
              href: `/study-abroad/${country.slug}/${subject.slug}`,
            })),
          },
        ]}
      />
    </>
  );
}
