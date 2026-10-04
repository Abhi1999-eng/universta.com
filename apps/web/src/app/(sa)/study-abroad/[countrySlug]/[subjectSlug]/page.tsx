import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CountryTrail } from '@/components/study-abroad/CountryTrail';
import { CountryTabs } from '@/components/study-abroad/CountryTabs';
import { CountryGuideLinks } from '@/components/study-abroad/CountryGuideLinks';
import { RowCard, countLabel } from '@/components/study-abroad/RowCard';
import { PlanBand } from '@/components/study-abroad/PlanBand';
import { ConnectBand } from '@/components/study-abroad/DiscoveryBands';
import { loadCountryTabs, tabCounts } from '@/lib/country-tabs';
import { guideLinks } from '@/lib/study-abroad-view';
import { getCourses, getSubject } from '@/lib/catalog';
import { getStudyAbroadCountry } from '@/lib/study-abroad';
import { formatNumber } from '@/lib/format';
import { inCountry } from '@/lib/country-article';
import { countrySubjectPage } from '@/lib/country-subject';

/**
 * One field, in one destination.
 *
 * The catalogue could already say "Agriculture is taught in the United
 * Kingdom" and "here is Agriculture everywhere", but it had nowhere to put
 * the sentence a student actually asks: what does studying Agriculture in
 * the UK involve. The subject page is the field across every destination;
 * the destination guide is every field in one country. This is the cell
 * where they meet, and the only page that can carry both names in its
 * title and both links in its header.
 */
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ countrySlug: string; subjectSlug: string }> };

async function load(countrySlug: string, subjectSlug: string) {
  const [page, subject] = await Promise.all([
    getStudyAbroadCountry(countrySlug),
    getSubject(subjectSlug).catch(() => null),
  ]);
  if (!page?.country || !subject) return null;
  return { page, country: page.country, subject };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { countrySlug, subjectSlug } = await params;
  const loaded = await load(countrySlug, subjectSlug);
  if (!loaded)
    return {
      title: { absolute: 'Not found | Universta' },
      robots: { index: false },
    };
  const { country, subject } = loaded;
  const where = inCountry(country.name, country.iso2Code);
  return {
    title: { absolute: `Study ${subject.name} in ${where} | Universta` },
    description:
      subject.shortDescription ??
      `The specializations, universities and programmes available in ${subject.name} for students going to ${where}.`,
    alternates: {
      canonical: `/study-abroad/${country.slug}/${subject.slug}`,
    },
  };
}

export default async function Page({ params }: Params) {
  const { countrySlug, subjectSlug } = await params;
  const loaded = await load(countrySlug, subjectSlug);
  if (!loaded) notFound();
  const { page, country, subject } = loaded;
  const where = inCountry(country.name, country.iso2Code);

  /* Courses first, because they settle whether this page should exist at
     all: a destination that lists the subject but teaches nothing in it is
     still a page worth having -- an editor put the link there for a market
     the catalogue has not caught up with -- but a destination that neither
     lists it nor teaches it is not. */
  const courses = await getCourses({
    country: country.slug,
    subject: subject.slug,
    limit: '6',
  }).catch(() => null);

  /* The destination does not have to claim the field. It used to: a page
     rendered only where the country listed the subject or published a
     course in it, which meant a destination with no courses yet 404d on
     every one of the thirty fields the catalogue knows. The taxonomy is
     not per-country -- what varies is which fields have programmes behind
     them here, and this page says that plainly where there are none. The
     subject itself still has to exist, which `load` has already settled. */

  const view = countrySubjectPage({
    specializations: subject.subSubjects,
    others: country.subjects ?? [],
    subjectSlug: subject.slug,
  });

  const tabs = await loadCountryTabs(
    country.slug,
    (country.subjects ?? []).length,
  );
  const base = `/study-abroad/${country.slug}/${subject.slug}`;

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
            <Link href={`/study-abroad/${country.slug}/subjects`}>Subjects</Link>
            <span className="crumbs__sep" aria-hidden="true">
              /
            </span>
            <span aria-current="page">{subject.name}</span>
          </nav>

          <h1 className="hero__h1">
            Study {subject.name} in {where}
          </h1>

          {/* Both halves of what this page is, each a link back to itself.
              A reader who arrived from the subject can leave through the
              destination, and the other way round. */}
          <CountryTrail
            country={country}
            parts={[{ label: subject.name, href: `/subjects/${subject.slug}` }]}
          />

          {subject.shortDescription ? (
            <p className="hero__sub">{subject.shortDescription}</p>
          ) : null}

          {view.specializations.length ? (
            <div className="btn-row">
              <a className="btn btn--lg" href="#specializations">
                Explore specializations{' '}
                <span className="btn__arrow" aria-hidden="true">
                  &rarr;
                </span>
              </a>
            </div>
          ) : null}
        </div>
      </section>

      <CountryTabs tabs={tabs} current="subjects" />

      {view.specializations.length ? (
        <section className="sec wrap" id="specializations">
          <div className="sec-head left row-between">
            <div>
              <span className="eyebrow">Fields of study</span>
              <h2 className="sec-title">
                Specializations in {where}
              </h2>
              <p className="sec-lead">
                {view.specializations.length} inside {subject.name}. Each one
                opens on what it means for a student going to {where}.
              </p>
            </div>
            <Link className="linkcta" href={`/subjects/${subject.slug}`}>
              {subject.name} everywhere{' '}
              <span className="linkcta__arrow" aria-hidden="true">
                &rarr;
              </span>
            </Link>
          </div>
          <div className="h-grid">
            {view.specializations.map((entry) => (
              <RowCard
                key={entry.id}
                href={`${base}/${entry.slug}`}
                title={entry.name}
                meta={countLabel(entry.publishedCourseCount, 'course')}
              />
            ))}
          </div>
        </section>
      ) : null}

      {courses?.data.length ? (
        <section className="sec wrap">
          <div className="sec-head left row-between">
            <div>
              <span className="eyebrow">Programmes</span>
              <h2 className="sec-title">
                {subject.name} courses in {where}
              </h2>
            </div>
            <Link
              className="linkcta"
              href={`/courses?country=${country.slug}&subject=${subject.slug}`}
            >
              All {formatNumber(courses.meta.total)}{' '}
              <span className="linkcta__arrow" aria-hidden="true">
                &rarr;
              </span>
            </Link>
          </div>
          <div className="h-grid">
            {courses.data.map((course) => (
              <RowCard
                key={course.id}
                href={`/courses/${course.slug}`}
                title={course.name}
                meta={course.courseLevel.name}
              />
            ))}
          </div>
        </section>
      ) : null}

      {view.others.length ? (
        <section className="sec wrap">
          <div className="sec-head left row-between">
            <div>
              <span className="eyebrow">Explore next</span>
              <h2 className="sec-title">More subjects in {where}</h2>
            </div>
            <Link
              className="linkcta"
              href={`/study-abroad/${country.slug}/subjects`}
            >
              All subjects{' '}
              <span className="linkcta__arrow" aria-hidden="true">
                &rarr;
              </span>
            </Link>
          </div>
          <div className="h-grid">
            {view.others.map((entry) => (
              <RowCard
                key={entry.id}
                href={`/study-abroad/${country.slug}/${entry.slug}`}
                title={entry.name}
                mark
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* Out of the subject and into the country it is studied in. */}
      <CountryGuideLinks
        countrySlug={country.slug}
        where={where}
        links={guideLinks(page, tabCounts(tabs))}
      />

      <PlanBand
        heading={`Thinking about ${subject.name} in ${where}?`}
        countrySlug={country.slug}
        countryName={country.name}
        secondary={{
          href: `/study-abroad/${country.slug}`,
          label: `${country.name} guide`,
        }}
      />

      <ConnectBand
        actions={[
          {
            href: `/courses?country=${country.slug}&subject=${subject.slug}`,
            label: 'Browse these courses',
          },
          {
            href: `/study-abroad/${country.slug}/universities`,
            label: `Universities in ${where}`,
            ghost: true,
          },
          { href: `/subjects/${subject.slug}`, label: subject.name, ghost: true },
        ]}
        groups={[
          {
            title: 'Specializations',
            items: view.specializations.slice(0, 6).map((entry) => ({
              id: entry.id,
              name: entry.name,
              href: `${base}/${entry.slug}`,
            })),
          },
        ]}
      />
    </>
  );
}
