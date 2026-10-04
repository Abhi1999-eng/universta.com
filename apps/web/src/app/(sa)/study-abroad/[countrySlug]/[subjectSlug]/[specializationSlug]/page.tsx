import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CountryTrail } from '@/components/study-abroad/CountryTrail';
import { CountryTabs } from '@/components/study-abroad/CountryTabs';
import { CountryGuideLinks } from '@/components/study-abroad/CountryGuideLinks';
import { RowCard } from '@/components/study-abroad/RowCard';
import { PlanBand } from '@/components/study-abroad/PlanBand';
import { ConnectBand } from '@/components/study-abroad/DiscoveryBands';
import { loadCountryTabs, tabCounts } from '@/lib/country-tabs';
import { guideLinks } from '@/lib/study-abroad-view';
import { getCourses, getSpecialization } from '@/lib/catalog';
import { getStudyAbroadCountry } from '@/lib/study-abroad';
import { formatNumber } from '@/lib/format';
import { inCountry } from '@/lib/country-article';

/**
 * The narrowest page the catalogue can answer: one specialization, in one
 * destination.
 *
 * It exists because the level above it stops short. "Agriculture in the UK"
 * is still a shelf; "Agronomy in the UK" is a decision. The specialization
 * is also the only one of the three names that is not unique on its own --
 * its slug is unique inside its subject, so `artificial-intelligence` is a
 * record under Computer Science and another under Engineering. Nesting it
 * under the subject is what makes the URL mean one of them.
 */
export const dynamic = 'force-dynamic';

type Params = {
  params: Promise<{
    countrySlug: string;
    subjectSlug: string;
    specializationSlug: string;
  }>;
};

async function load(
  countrySlug: string,
  subjectSlug: string,
  specializationSlug: string,
) {
  const [page, specialization] = await Promise.all([
    getStudyAbroadCountry(countrySlug),
    getSpecialization(subjectSlug, specializationSlug).catch(() => null),
  ]);
  if (!page?.country || !specialization) return null;
  return { page, country: page.country, specialization };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { countrySlug, subjectSlug, specializationSlug } = await params;
  const loaded = await load(countrySlug, subjectSlug, specializationSlug);
  if (!loaded)
    return {
      title: { absolute: 'Not found | Universta' },
      robots: { index: false },
    };
  const { country, specialization } = loaded;
  const where = inCountry(country.name, country.iso2Code);
  return {
    title: {
      absolute: `Study ${specialization.name} in ${where} | Universta`,
    },
    description:
      specialization.shortDescription ??
      `Programmes and universities for ${specialization.name} available to students going to ${where}.`,
    alternates: {
      canonical: `/study-abroad/${country.slug}/${specialization.subject.slug}/${specialization.slug}`,
    },
  };
}

export default async function Page({ params }: Params) {
  const { countrySlug, subjectSlug, specializationSlug } = await params;
  const loaded = await load(countrySlug, subjectSlug, specializationSlug);
  if (!loaded) notFound();
  const { page, country, specialization } = loaded;
  const where = inCountry(country.name, country.iso2Code);
  const subject = specialization.subject;

  const courses = await getCourses({
    country: country.slug,
    subject: subject.slug,
    subSubject: specialization.slug,
    limit: '9',
  }).catch(() => null);

  /* The destination does not have to claim the field. It used to: a page
     rendered only where the country listed the subject or published a
     course in it, which meant a destination with no courses yet 404d on
     every one of the thirty fields the catalogue knows. The taxonomy is
     not per-country -- what varies is which fields have programmes behind
     them here, and this page says that plainly where there are none. The
     subject itself still has to exist, which `load` has already settled. */

  const tabs = await loadCountryTabs(
    country.slug,
    (country.subjects ?? []).length,
  );
  const subjectHref = `/study-abroad/${country.slug}/${subject.slug}`;
  /* All of them. The API sends a dozen at most and the page showed eight,
     so a third of a subject's other specializations could not be reached
     from one of its own. */
  const siblings = specialization.siblings.filter(
    (entry) => entry.slug !== specialization.slug,
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
            <Link href={`/study-abroad/${country.slug}/subjects`}>Subjects</Link>
            <span className="crumbs__sep" aria-hidden="true">
              /
            </span>
            <Link href={subjectHref}>{subject.name}</Link>
            <span className="crumbs__sep" aria-hidden="true">
              /
            </span>
            <span aria-current="page">{specialization.name}</span>
          </nav>

          <h1 className="hero__h1">
            Study {specialization.name} in {where}
          </h1>

          <CountryTrail
            country={country}
            parts={[
              { label: subject.name, href: subjectHref },
              { label: specialization.name },
            ]}
          />

          {specialization.shortDescription ? (
            <p className="hero__sub">{specialization.shortDescription}</p>
          ) : null}

          {/* Up one level, and still in this country: the rest of the
              subject as it is studied here. */}
          <div className="btn-row">
            <Link className="btn btn--lg btn--wrap" href={subjectHref}>
              {subject.name} in {where}{' '}
              <span className="btn__arrow" aria-hidden="true">
                &rarr;
              </span>
            </Link>
          </div>
        </div>
      </section>

      <CountryTabs tabs={tabs} current="subjects" below />

      <section className="sec wrap">
        <div className="sec-head left row-between">
          <div>
            <span className="eyebrow">Programmes</span>
            <h2 className="sec-title">
              {specialization.name} in {where}
            </h2>
            <p className="sec-lead">
              {courses?.meta.total ? (
                `${formatNumber(courses.meta.total)} published ${courses.meta.total === 1 ? 'programme' : 'programmes'} a student going to ${where} can apply to.`
              ) : (
                <>
                  No programme in {specialization.name} is published for{' '}
                  {where} yet.{' '}
                  <Link className="textlink" href={subjectHref}>
                    {subject.name}
                  </Link>{' '}
                  has more that may fit.
                </>
              )}
            </p>
          </div>
          {courses?.meta.total ? (
            <Link
              className="linkcta"
              href={`/courses?country=${country.slug}&subject=${subject.slug}&subSubject=${specialization.slug}`}
            >
              Open in search{' '}
              <span className="linkcta__arrow" aria-hidden="true">
                &rarr;
              </span>
            </Link>
          ) : null}
        </div>
        {courses?.data.length ? (
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
        ) : null}
      </section>

      {siblings.length ? (
        <section className="sec wrap">
          <div className="sec-head left row-between">
            <div>
              <span className="eyebrow">Explore next</span>
              <h2 className="sec-title">
                More in {subject.name}, in {where}
              </h2>
            </div>
            <Link className="linkcta" href={subjectHref}>
              All of {subject.name}{' '}
              <span className="linkcta__arrow" aria-hidden="true">
                &rarr;
              </span>
            </Link>
          </div>
          <div className="h-grid">
            {siblings.map((entry) => (
              <RowCard
                key={entry.id}
                href={`${subjectHref}/${entry.slug}`}
                title={entry.name}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* Out of the specialization and into the country it is studied in. */}
      <CountryGuideLinks
        countrySlug={country.slug}
        where={where}
        links={guideLinks(page, tabCounts(tabs))}
      />

      <PlanBand
        heading={`Is ${specialization.name} in ${where} right for you?`}
        countrySlug={country.slug}
        countryName={country.name}
        secondary={{ href: subjectHref, label: `${subject.name} in ${where}` }}
      />

      <ConnectBand
        actions={[
          {
            href: `/courses?country=${country.slug}&subject=${subject.slug}&subSubject=${specialization.slug}`,
            label: 'Browse these courses',
          },
          {
            href: `/subjects/${subject.slug}/${specialization.slug}`,
            label: `${specialization.name} everywhere`,
            ghost: true,
          },
          {
            href: `/study-abroad/${country.slug}/universities`,
            label: `Universities in ${where}`,
            ghost: true,
          },
        ]}
        groups={[
          {
            title: `More in ${subject.name}`,
            items: siblings.slice(0, 6).map((entry) => ({
              id: entry.id,
              name: entry.name,
              href: `${subjectHref}/${entry.slug}`,
            })),
          },
        ]}
      />
    </>
  );
}
