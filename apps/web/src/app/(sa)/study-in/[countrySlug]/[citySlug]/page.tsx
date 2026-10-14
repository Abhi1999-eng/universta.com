import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { AnyRecord } from '@/components/phase1/PhaseOneViews';
import { RichText, richTextToPlainText } from '@/components/phase1/RichText';
import { Crumbs } from '@/components/study-abroad/Crumbs';
import { ConnectBand } from '@/components/study-abroad/DiscoveryBands';
import { SectionHead } from '@/components/study-abroad/SectionHead';
import { jsonLdString } from '@/lib/json-ld';
import { getCityDetail } from '@/lib/locations';
import { phaseListAll } from '@/lib/phase1';
import { universityInitials } from '@/lib/university-initials';
import { countryUniversitiesHref, universityHref } from '@/lib/university-links';

/**
 * A city's profile, in the approved design: the compact hero that places
 * it, the profile's own words, the universities with a campus there, and
 * the destination's pages to read next. The address stays
 * `/study-in-<country>/<city>`, as the city index and the country's cities
 * link it.
 */
export const dynamic = 'force-dynamic';

/* The city's image can come from approved external asset hosts, same as elsewhere in this app. */
/* eslint-disable @next/next/no-img-element */

type Props = { params: Promise<{ countrySlug: string; citySlug: string }> };

async function load(countrySlug: string, citySlug: string) {
  try {
    return await getCityDetail(countrySlug, citySlug);
  } catch {
    return null;
  }
}

const plain = (value: string | null | undefined) => (value ? richTextToPlainText(value).replace(/\s+/g, ' ').trim() : '');

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { countrySlug, citySlug } = await params;
  const city = await load(countrySlug, citySlug);
  if (!city) return { title: { absolute: 'City not found | Universta' }, robots: { index: false } };
  const seo = (city as { seo?: Record<string, unknown> | null }).seo;
  const title = (seo?.seoTitle as string | undefined) ?? `${city.name}, ${city.country.name} | Universta`;
  return {
    title: { absolute: title },
    description: (seo?.metaDescription as string | undefined) ?? plain(city.shortDescription) ?? undefined,
    alternates: { canonical: (seo?.canonicalUrl as string | undefined) ?? `/study-in-${countrySlug}/${city.slug}` },
    robots:
      seo?.robotsIndex === false || seo?.robotsFollow === false
        ? { index: seo?.robotsIndex !== false, follow: seo?.robotsFollow !== false }
        : undefined,
    openGraph:
      seo?.ogTitle || seo?.ogDescription
        ? {
            title: (seo?.ogTitle as string | undefined) ?? undefined,
            description: (seo?.ogDescription as string | undefined) ?? undefined,
          }
        : undefined,
  };
}

/** The universities whose campuses name this city, from the destination's list. */
async function universitiesIn(countrySlug: string, cityName: string) {
  try {
    const { data } = await phaseListAll<AnyRecord>('universities', { country: countrySlug });
    const wanted = cityName.trim().toLowerCase();
    return data.filter((row) =>
      (Array.isArray(row.campuses) ? (row.campuses as Array<{ city?: unknown; cityRef?: { name?: unknown } | null }>) : []).some(
        (campus) => String(campus.city ?? campus.cityRef?.name ?? '').trim().toLowerCase() === wanted,
      ),
    );
  } catch {
    return [];
  }
}

export default async function CityDetailPage({ params }: Props) {
  const { countrySlug, citySlug } = await params;
  const city = await load(countrySlug, citySlug);
  if (!city) notFound();
  const universities = await universitiesIn(countrySlug, city.name);
  const base = `/study-in-${countrySlug}`;
  const self = `${base}/${city.slug}`;
  const guide = `/study-abroad/${countrySlug}`;
  const summary = plain(city.shortDescription);
  const overview = city.overview && plain(city.overview) && plain(city.overview) !== summary ? city.overview : null;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: city.name,
    description: summary || undefined,
    url: self,
    containedInPlace: { '@type': 'Country', name: city.country.name },
  };

  return (
    <>
      <section className="hero hero--compact">
        <div className="wrap">
          <Crumbs
            trail={[
              { label: 'Home', href: '/' },
              { label: 'Study abroad', href: '/study-abroad' },
              { label: city.country.name, href: guide },
              { label: 'Cities', href: `${base}/cities` },
              { label: city.name },
            ]}
          />
          <div className="hero__lead">
            <p className="hero__eyebrow">
              City
              {city.state?.name ? (
                <>
                  <b>·</b>
                  {city.state.name}
                </>
              ) : null}
              <b>·</b>
              {city.country.name}
            </p>
            <h1 className="hero__h1">{city.name}</h1>
            <p className="hero__sub">{summary || `A published city profile in ${city.country.name}.`}</p>
            <div className="btn-row" style={{ marginTop: 22 }}>
              <Link className="btn btn--lg" href={guide}>
                Study in {city.country.name}{' '}
                <span className="btn__arrow" aria-hidden="true">
                  &rarr;
                </span>
              </Link>
              <Link className="btn btn--lg btn--ghost" href={countryUniversitiesHref(countrySlug)}>
                Universities in {city.country.name}
              </Link>
              <Link className="btn btn--lg btn--ghost" href={`/counselling?source=country&country=${countrySlug}&from=${encodeURIComponent(self)}`}>
                Talk to a counsellor
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="sec sec--white" id="about">
        <div className="wrap">
          <SectionHead
            eyebrow="About"
            title={`Studying in ${city.name}`}
            lead={overview ? null : `The profile has been published without further detail. The guide to ${city.country.name} covers costs, visas and intakes for the whole destination.`}
          />
          {city.heroMedia?.url ? (
            <figure className="h-figure" style={{ marginBottom: 24 }}>
              <img src={city.heroMedia.url} alt={city.heroMedia.alt ?? city.name} />
            </figure>
          ) : null}
          {overview ? <RichText value={overview} className="h-prose" /> : null}
        </div>
      </section>

      {universities.length ? (
        <section className="sec sec--paper" id="universities">
          <div className="wrap">
            <SectionHead
              eyebrow="Universities"
              title={`Universities with a campus in ${city.name}`}
              lead={`${universities.length === 1 ? 'One institution lists' : `${universities.length} institutions list`} a campus here. Each profile has its published programmes, fees and intakes.`}
            />
            <div className="h-grid">
              {universities.map((row) => (
                <Link className="h-card" href={universityHref(String(row.slug))} key={String(row.id)}>
                  <span className="h-card__m" style={{ marginTop: 0, paddingTop: 0 }}>
                    <span className="unimark unimark--xs" aria-hidden="true">
                      {universityInitials(String(row.name))}
                    </span>
                  </span>
                  <strong className="h-card__t">{String(row.name)}</strong>
                  {plain(typeof row.shortDescription === 'string' ? row.shortDescription : null) ? (
                    <span className="h-card__d">{plain(String(row.shortDescription)).slice(0, 160)}</span>
                  ) : null}
                  <span className="linkcta">
                    View university <span className="linkcta__arrow" aria-hidden="true">&rarr;</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <ConnectBand
        actions={[
          { href: `${base}/cities`, label: `All cities in ${city.country.name}` },
          { href: guide, label: `Study in ${city.country.name}`, ghost: true },
          { href: `/courses?country=${countrySlug}`, label: `Courses in ${city.country.name}`, ghost: true },
          { href: `/study-abroad/${countrySlug}/scholarships`, label: 'Scholarships', ghost: true },
        ]}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }} />
    </>
  );
}
