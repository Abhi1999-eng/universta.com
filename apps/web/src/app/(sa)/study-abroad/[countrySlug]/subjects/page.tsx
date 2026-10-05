import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CountryTrail } from '@/components/study-abroad/CountryTrail';
import { CountryTabs } from '@/components/study-abroad/CountryTabs';
import {
  CountrySubjectGrid,
  type CountrySubjectCard,
} from '@/components/study-abroad/CountrySubjectGrid';
import {
  SUBJECT_RESULTS_ID,
  SubjectCount,
  SubjectSearchBox,
  SubjectSearchProvider,
} from '@/components/study-abroad/CountrySubjectSearch';
import { loadCountryTabs } from '@/lib/country-tabs';
import { partitionSubjects } from '@/lib/country-sub-pages';
import { subjectsForCountry } from '@/lib/country-subject';
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

type Params = {
  params: Promise<{ countrySlug: string }>;
  /** `?q=` starts the page already searched. */
  searchParams?: Promise<{ q?: string | string[] }>;
};

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

export default async function Page({ params, searchParams }: Params) {
  const { countrySlug } = await params;
  const asked = (await searchParams)?.q;
  const initialQuery =
    (Array.isArray(asked) ? asked[0] : asked)?.slice(0, 100) ?? '';
  const page = await getStudyAbroadCountry(countrySlug);
  const country = page?.country;
  if (!country) notFound();

  /* The whole taxonomy, which is also where each field's specialization
     count comes from -- the same number the field's own page then lists, so
     "46 specializations" cannot open on a different forty-six. */
  const catalogue = await getSubjects({ limit: '100' })
    .then((result) => result.data)
    .catch(() => []);
  const counts = new Map(
    catalogue.map((row) => [row.slug, row.publishedSubSubjectCount]),
  );

  /* What this destination is recorded as teaching -- and, when nothing is
     recorded, the catalogue itself.

     The links are derived from the courses published in a destination, so a
     destination with no courses yet had no subjects, and this page said so
     and stopped. But the taxonomy is not per-country: the fields Universta
     knows are the same thirty everywhere, and what varies is which of them
     have programmes behind them here. Making an editor attach all thirty by
     hand before the page would show anything was asking them to type out a
     list the catalogue already had. */
  const { subjects, listed } = subjectsForCountry({
    linked: country.subjects ?? [],
    catalogue,
  });
  const { taught, editorial } = listed
    ? partitionSubjects(subjects)
    : { taught: [], editorial: [] };

  const tabs = await loadCountryTabs(
    country.slug,
    (country.subjects ?? []).length,
  );
  const where = inCountry(country.name, country.iso2Code);

  const toCard = (subject: {
    id: string;
    name: string;
    slug: string;
  }): CountrySubjectCard => ({
    id: subject.id,
    name: subject.name,
    slug: subject.slug,
    specializations: counts.get(subject.slug) ?? 0,
  });

  return (
    /* Keyed on the address, so going back from ?q=law to the bare page
       empties the box instead of keeping what the last address held. */
    <SubjectSearchProvider key={initialQuery} initialQuery={initialQuery}>
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
          <h1 className="hero__h1">Subjects to study in {where}</h1>
          {/* The same line the pages under this one carry, one part long:
              the country, as a link back to its guide. It was a grey label
              above the heading that could not be clicked. */}
          <CountryTrail country={country} parts={[{ label: 'Subjects' }]} />
          <p className="hero__sub">
            {taught.length
              ? `${taught.length} ${taught.length === 1 ? 'field is' : 'fields are'} taught here by a published university. Open one for its specializations and the courses inside them.`
              : `No field in ${where} has a published course behind it yet.`}
          </p>
          {/* In the hero, above the tabs: the first thing under the heading
              on a page whose whole job is finding one subject among thirty.
              It was below the section heading, and at a normal window
              height no card was in view while typing into it. */}
          {subjects.length ? (
            <SubjectSearchBox
              countrySlug={country.slug}
              subjects={subjects.map((subject) => ({
                name: subject.name,
                slug: subject.slug,
              }))}
            />
          ) : null}
        </div>
      </section>

      <CountryTabs tabs={tabs} current="subjects" />

      <section className="sec sec--white sec--tight">
        <div className="wrap">
          <div className="sec-head left row-between scrollstop" id={SUBJECT_RESULTS_ID}>
            <div>
              <span className="eyebrow">Fields of study</span>
              <h2 className="sec-title">All subjects in {where}</h2>
              <p className="sec-lead">
                <SubjectCount names={subjects.map((subject) => subject.name)} />
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
            taught={(listed ? taught : subjects).map(toCard)}
            editorial={editorial.map(toCard)}
            countrySlug={country.slug}
            /* Said once, above the grid, when none of these is recorded
               against the destination yet -- rather than on each of thirty
               cards. */
            note={
              listed
                ? null
                : `Universta publishes ${catalogue.length} subjects. Programmes in ${where} are still being added, so a field may open on its specializations and no courses yet.`
            }
          />

          {!subjects.length ? (
            <p className="dir__none">
              No subject is recorded for {where} yet. A field appears here once
              a university in this destination publishes a course in it.
            </p>
          ) : null}

          <p className="h-more">
            <Link className="linkcta" href="/subjects">
              Browse the full subject taxonomy{' '}
              <span className="linkcta__arrow" aria-hidden="true">
                &rarr;
              </span>
            </Link>
          </p>
        </div>
      </section>

    </SubjectSearchProvider>
  );
}
