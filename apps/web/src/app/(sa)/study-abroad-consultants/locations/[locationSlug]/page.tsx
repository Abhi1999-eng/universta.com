import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { type AnyRecord } from '@/components/phase1/PhaseOneViews';
import { ConsultantTrust } from '@/components/study-abroad/ConsultantTrust';
import { CountryConsultantIndex } from '@/components/study-abroad/CountryConsultantIndex';
import { CountryListSearch } from '@/components/study-abroad/CountryListSearch';
import { Crumbs } from '@/components/study-abroad/Crumbs';
import { ConnectBand, MatchBand } from '@/components/study-abroad/DiscoveryBands';
import {
  consultantLocationHref,
  liveConsultantOffices,
  locationHeading,
  locationPlaceLabel,
  nearbyOffices,
} from '@/lib/consultant-locations';
import { counsellingHref } from '@/lib/counselling-link';
import { consultantListHref, consultantOptions, toConsultantRows } from '@/lib/country-consultant-list';
import { formatNumber } from '@/lib/format';
import { phaseListAll, phaseLocation } from '@/lib/phase1';
import { phaseOneMetadata } from '@/lib/phase1-metadata';
import { getDestinations } from '@/lib/study-abroad';
import '../../../consultants-zip.css';

/**
 * The consultants with an office in one place, in the approved design: the
 * compact hero that names the place, with the search and the destinations
 * those consultants list; the directory's own cards and filters over them;
 * then the destination's guide, the other places nearby and the trust box,
 * and the destination's pages to read next. The zip's city leaderboards
 * and scores are not here: Universta records none of them.
 */
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locationSlug: string }> };

/** How many destinations the hero's "Popular destinations" names. */
const POPULAR_SHOWN = 8;

async function consultantLocation(slug: string) {
  try {
    return await phaseLocation<AnyRecord>(slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locationSlug } = await params;
  const row = await consultantLocation(locationSlug);
  if (!row) return { title: { absolute: 'Consultant location not found | Universta' }, robots: { index: false } };
  /* The title falls back to the place, as the heading reads, not to the
     record's name ("Heidelberg advisory centre"); an editor's own SEO
     title still wins. */
  const metadata = phaseOneMetadata(
    { ...row, name: locationHeading(row) },
    `/study-abroad-consultants/locations/${row.slug ?? locationSlug}`,
    'Consultant location',
  );
  return { ...metadata, title: { absolute: String(metadata.title) } };
}

export default async function ConsultantLocationPage({ params }: Props) {
  const { locationSlug } = await params;
  const [row, directory, published] = await Promise.all([
    consultantLocation(locationSlug),
    getDestinations().catch(() => null),
    /* Every consultant's offices, for the other places nearby. Its failure
       only leaves those out. */
    phaseListAll<AnyRecord>('consultants').catch(() => null),
  ]);
  if (!row) notFound();
  const record = row as unknown as Record<string, unknown>;
  const country = record.country as Record<string, unknown> | undefined;
  const countrySlug = typeof country?.slug === 'string' ? country.slug : null;
  const countryName = typeof country?.name === 'string' ? country.name : null;
  const guides = (directory?.available ?? []).flatMap((entry) => (entry.slug ? [entry.slug] : []));
  const hasGuide = Boolean(countrySlug && guides.includes(countrySlug));
  const rows = toConsultantRows(
    (Array.isArray(record.consultants) ? (record.consultants as Array<Record<string, unknown>>) : [])
      .map((link) => link.consultant)
      .filter(Boolean),
  );
  const name = String(record.name);
  const place = [typeof record.city === 'string' ? record.city : null, typeof record.state === 'string' ? record.state : null, countryName]
    .filter(Boolean)
    .join(', ');
  /* The place the page is about: "Heidelberg", with its state when there
     is one. The record's own name stays on the page, in the eyebrow. */
  const placeLabel = locationPlaceLabel(record);
  const countryHref = countrySlug
    ? hasGuide
      ? `/study-abroad/${countrySlug}/consultants`
      : `/study-abroad-consultants?country=${countrySlug}#consultants`
    : null;
  const self = consultantLocationHref(String(record.slug ?? locationSlug));
  /* The destinations the consultants here list, commonest first, each
     narrowing the list below to it. */
  const popular = consultantOptions(rows).destinations.slice(0, POPULAR_SHOWN);
  const nearby = nearbyOffices(
    { slug: String(record.slug ?? locationSlug), city: record.city, state: record.state, countrySlug },
    liveConsultantOffices(published?.data ?? []),
  );

  return (
    <>
      <section className="hero hero--compact">
        <div className="wrap">
          <Crumbs
            trail={[
              { label: 'Home', href: '/' },
              { label: 'Consultants', href: '/study-abroad-consultants' },
              ...(countryName && countryHref ? [{ label: countryName, href: countryHref }] : []),
              { label: placeLabel },
            ]}
          />
          <div className="hero__lead">
            <p className="hero__eyebrow">
              {[name, countryName].filter(Boolean).join(' · ') || 'Consultant office'}
              {rows.length ? (
                <>
                  <b>·</b>
                  {formatNumber(rows.length)} {rows.length === 1 ? 'consultant' : 'consultants'}
                </>
              ) : null}
            </p>
            <h1 className="hero__h1">{locationHeading(record)}</h1>
            <p className="hero__sub">
              {typeof record.overview === 'string' && record.overview.trim()
                ? record.overview
                : `Published consultants with an office in ${name}${place && place !== name ? `, ${place}` : ''}, with the destinations and services each lists.`}
            </p>
          </div>
          {rows.length ? (
            <div className="bigsearch__wrap" style={{ marginTop: 22 }}>
              <CountryListSearch
                placeholder="Consultant, country, city or service"
                label={`Search consultants in ${placeLabel}`}
              />
            </div>
          ) : null}
          {popular.length ? (
            <div className="citychips">
              <span className="label">Popular destinations</span>
              {popular.map((entry) => (
                <Link
                  className="specchip specchip--live"
                  href={`${consultantListHref(self, { destinations: [entry.value] })}#consultants`}
                  key={entry.value}
                >
                  {entry.label}
                  <em>{formatNumber(entry.count)}</em>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <CountryConsultantIndex rows={rows} countrySlug="" where={placeLabel} guides={guides} byDestination compare logos />

      {/* The design's closing row: the destination's guide, the other
          places nearby -- with the whole directory still a click away --
          and how Universta works with consultants. */}
      <section className="sec sec--paper sec--tight" id="related">
        <div className="wrap">
          <div className="relgrid">
            {countrySlug && countryName ? (
              <div className="relgrid__col">
                <p className="path__h">Studying in {countryName}</p>
                <p className="relgrid__note">What studying there involves, and the consultants who support it.</p>
                <ul className="linklist">
                  {hasGuide ? (
                    <li>
                      <Link href={`/study-abroad/${countrySlug}`}>{countryName} study guide</Link>
                    </li>
                  ) : null}
                  {countryHref ? (
                    <li>
                      <Link href={countryHref}>{countryName} consultants</Link>
                    </li>
                  ) : null}
                </ul>
              </div>
            ) : null}
            <div className="relgrid__col">
              <p className="path__h">Nearby and related</p>
              <ul className="linklist">
                {nearby.map((office) => (
                  <li key={office.slug}>
                    <Link href={consultantLocationHref(office.slug)}>
                      {office.name === locationPlaceLabel(office) ? office.name : `${office.name}, ${locationPlaceLabel(office)}`}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link href="/study-abroad-consultants#cities">Consultants in other cities</Link>
                </li>
                <li>
                  <Link href="/study-abroad-consultants">Browse all consultants</Link>
                </li>
              </ul>
            </div>
            <ConsultantTrust />
          </div>
        </div>
      </section>

      <MatchBand
        eyebrow={{ n: 'Next step', label: 'Guidance' }}
        heading="Want help before you choose?"
        lead="Book a free Universta counselling session and we will help you narrow the list."
        href="/study-abroad-consultants"
        talkHref={counsellingHref({ source: 'general', from: self })}
        assessment={{
          label: 'Find My Consultant Options',
          intent: 'consultants-index',
          note: 'Share your details with Universta to receive relevant consultant options and guidance. Universta handles your request first and never sells your details.',
        }}
      />

      {countrySlug && countryName ? (
        <ConnectBand
          actions={[
            ...(hasGuide ? [{ href: `/study-abroad/${countrySlug}`, label: `Study in ${countryName}` }] : []),
            { href: `/courses?country=${countrySlug}`, label: `Courses in ${countryName}`, ghost: hasGuide },
            { href: `/study-abroad-consultants?country=${countrySlug}#consultants`, label: `All ${countryName} consultants`, ghost: true },
            { href: '/study-abroad-consultants', label: 'Every consultant', ghost: true },
          ]}
        />
      ) : null}
    </>
  );
}
