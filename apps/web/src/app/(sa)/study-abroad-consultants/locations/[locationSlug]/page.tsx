import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { type AnyRecord } from '@/components/phase1/PhaseOneViews';
import { CountryConsultantIndex } from '@/components/study-abroad/CountryConsultantIndex';
import { Crumbs } from '@/components/study-abroad/Crumbs';
import { ConnectBand, MatchBand } from '@/components/study-abroad/DiscoveryBands';
import { locationHeading, locationPlaceLabel } from '@/lib/consultant-locations';
import { counsellingHref } from '@/lib/counselling-link';
import { toConsultantRows } from '@/lib/country-consultant-list';
import { formatNumber } from '@/lib/format';
import { phaseLocation } from '@/lib/phase1';
import { phaseOneMetadata } from '@/lib/phase1-metadata';
import { getDestinations } from '@/lib/study-abroad';
import '../../../consultants-zip.css';

/**
 * The consultants with an office in one place, in the approved design: the
 * compact hero that names the place, the directory's own cards and
 * filters over the consultants listed there, and the destination's pages
 * to read next. The zip's city leaderboards and scores are not here:
 * Universta records none of them.
 */
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locationSlug: string }> };

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
  const [row, directory] = await Promise.all([consultantLocation(locationSlug), getDestinations().catch(() => null)]);
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
        </div>
      </section>

      <CountryConsultantIndex rows={rows} countrySlug="" where={placeLabel} guides={guides} byDestination />

      {countrySlug && countryName ? (
        <ConnectBand
          actions={[
            ...(hasGuide ? [{ href: `/study-abroad/${countrySlug}`, label: `Study in ${countryName}` }] : []),
            { href: `/courses?country=${countrySlug}`, label: `Courses in ${countryName}`, ghost: hasGuide },
            { href: `/study-abroad-consultants?country=${countrySlug}#consultants`, label: `All ${countryName} consultants`, ghost: true },
            { href: '/study-abroad-consultants', label: 'Every consultant', ghost: true },
          ]}
        />
      ) : (
        <section className="sec sec--paper sec--tight">
          <div className="wrap">
            <p className="h-more">
              <Link className="linkcta" href="/study-abroad-consultants">
                Browse all consultants <span className="linkcta__arrow" aria-hidden="true">&rarr;</span>
              </Link>
            </p>
          </div>
        </section>
      )}

      <MatchBand
        eyebrow={{ n: 'Next step', label: 'Guidance' }}
        heading="Want help before you choose?"
        lead="Book a free Universta counselling session and we will help you narrow the list."
        href="/study-abroad-consultants"
        talkHref={counsellingHref({ source: 'general', from: `/study-abroad-consultants/locations/${String(record.slug ?? locationSlug)}` })}
        assessment={{
          label: 'Find My Consultant Options',
          intent: 'consultants-index',
          note: 'Share your details with Universta to receive relevant consultant options and guidance. Universta handles your request first and never sells your details.',
        }}
      />
    </>
  );
}
