import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FlagMark } from '@/components/study-abroad/FlagMark';
import { CountryTabs } from '@/components/study-abroad/CountryTabs';
import {
  CountrySubjectGrid,
  type CountrySubjectCard,
} from '@/components/study-abroad/CountrySubjectGrid';
import { loadCountryTabs } from '@/lib/country-tabs';
import { partitionSubjects } from '@/lib/country-sub-pages';
import { getStudyAbroadCountry } from '@/lib/study-abroad';
import { getSubjects } from '@/lib/catalog';
import { inCountry } from '@/lib/country-article';

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
  const where = inCountry(country.name, country.iso2Code);

  /* How many specializations each field holds. The destination's own subject
     links do not carry it, so it comes from the taxonomy -- the same number
     the field's own page then lists, which is what keeps "46 specializations"
     from opening on a different count. A failure drops the line rather than
     the page. */
  const counts = await getSubjects({ limit: '100' })
    .then(
      (result) =>
        new Map(
          result.data.map((row) => [row.slug, row.publishedSubSubjectCount]),
        ),
    )
    .catch(() => new Map<string, number>());

  const toCard = (subject: (typeof subjects)[number]): CountrySubjectCard => ({
    id: subject.id,
    name: subject.name,
    slug: subject.slug,
    specializations: counts.get(subject.slug) ?? 0,
  });

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
          <h1 className="hero__h1">Subjects to study in {where}</h1>
          <p className="hero__sub">
            {taught.length
              ? `${taught.length} ${taught.length === 1 ? 'field is' : 'fields are'} taught here by a published university. Open one for its specializations and the courses inside them.`
              : `No field in ${where} has a published course behind it yet.`}
          </p>
        </div>
      </section>

      <CountryTabs tabs={tabs} current="subjects" />

      <section className="sec sec--white sec--tight">
        <div className="wrap">
          <div className="sec-head left row-between">
            <div>
              <span className="eyebrow">Fields of study</span>
              <h2 className="sec-title">All subjects in {where}</h2>
              <p className="sec-lead">
                {subjects.length} {subjects.length === 1 ? 'subject' : 'subjects'}
              </p>
            </div>
            <Link className="linkcta" href={`/study-abroad/${country.slug}`}>
              Study in {where}{' '}
              <span className="linkcta__arrow" aria-hidden="true">
                &rarr;
              </span>
            </Link>
          </div>

          <CountrySubjectGrid
            taught={taught.map(toCard)}
            editorial={editorial.map(toCard)}
            countrySlug={country.slug}
            emptyLabel={where}
          />

          {!subjects.length ? (
            <p className="dir__none">
              No subject is recorded for {where} yet. A field appears here once
              a university in this destination publishes a course in it.
            </p>
          ) : null}

          <p className="h-more">
            <Link href="/subjects">Browse the full subject taxonomy</Link>
          </p>
        </div>
      </section>

    </>
  );
}
