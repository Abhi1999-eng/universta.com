import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FlagMark } from '@/components/study-abroad/FlagMark';
import { CountryTabs } from '@/components/study-abroad/CountryTabs';
import { loadCountryTabs } from '@/lib/country-tabs';
import { partitionSubjects } from '@/lib/country-sub-pages';
import { getStudyAbroadCountry } from '@/lib/study-abroad';

/**
 * Every field taught in one destination.
 *
 * The country guide shows these in a grid and sends the rest to the global
 * taxonomy, which is a different question: the taxonomy is every subject
 * Universta knows, this is the subset a student in this destination can
 * actually study.
 *
 * The two kinds of link are kept apart here as they are on the guide, and
 * for the same reason. A derived subject is on this page because a
 * published course in it is taught here -- open it and there is something
 * behind it. An editorial one is here because somebody added it, usually
 * for a market the catalogue has not caught up with, and may still be
 * empty. Mixing them is how a reader lands on a page with nothing on it.
 */
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ countrySlug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { countrySlug } = await params;
  const page = await getStudyAbroadCountry(countrySlug);
  const country = page?.country;
  if (!country)
    return {
      title: { absolute: 'Destination not found | Universta' },
      robots: { index: false },
    };
  return {
    title: { absolute: `Subjects to study in ${country.name} | Universta` },
    description: `The fields taught in ${country.name}, and the specializations inside each one.`,
    alternates: { canonical: `/study-abroad/${country.slug}/subjects` },
  };
}

export default async function Page({ params }: Params) {
  const { countrySlug } = await params;
  const page = await getStudyAbroadCountry(countrySlug);
  const country = page?.country;
  if (!country) notFound();

  const subjects = country.subjects ?? [];
  const { taught, editorial } = partitionSubjects(subjects);

  const tabs = await loadCountryTabs(country.slug, subjects.length);

  const card = (subject: (typeof subjects)[number]) => (
    /* To this field in this destination, not to the field everywhere. The
       destination is the whole reason the reader is on this page. */
    <Link
      className="h-card"
      href={`/study-abroad/${country.slug}/${subject.slug}`}
      key={subject.id}
    >
      <strong className="h-card__t">{subject.name}</strong>
    </Link>
  );

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
            <span aria-current="page">Subjects</span>
          </nav>
          <p className="hero__eyebrow">
            <FlagMark iso2Code={country.iso2Code ?? null} bands={null} />{' '}
            {country.name}
          </p>
          <h1 className="hero__title">Subjects to study in {country.name}</h1>
          <p className="hero__lead">
            {taught.length
              ? `${taught.length} ${taught.length === 1 ? 'field is' : 'fields are'} taught here by a published university. Open one for its specializations and the courses inside them.`
              : `No field in ${country.name} has a published course behind it yet.`}
          </p>
        </div>
      </section>

      <section className="sec sec--white sec--tight">
        <div className="wrap">
          <CountryTabs tabs={tabs} current="subjects" />

          {taught.length ? <div className="h-grid h-grid--4">{taught.map(card)}</div> : null}

          {editorial.length ? (
            <>
              <p className="h-more">
                <span className="label">
                  {taught.length
                    ? 'Also listed here, with no programme in the catalogue yet'
                    : 'Listed for this destination, with no programme in the catalogue yet'}
                </span>
              </p>
              <div className="h-grid h-grid--4">{editorial.map(card)}</div>
            </>
          ) : null}

          {!subjects.length ? (
            <p className="dir__none">
              No subject is recorded for {country.name} yet. A field appears
              here once a university in this destination publishes a course
              in it.
            </p>
          ) : null}

          <p className="h-more">
            <Link href={`/study-abroad/${country.slug}`}>
              Back to the {country.name} guide
            </Link>
            {' · '}
            <Link href="/subjects">Browse the full subject taxonomy</Link>
          </p>
        </div>
      </section>
    </>
  );
}
