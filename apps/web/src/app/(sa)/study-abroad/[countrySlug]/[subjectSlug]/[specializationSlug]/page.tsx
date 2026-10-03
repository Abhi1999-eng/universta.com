import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FlagMark } from '@/components/study-abroad/FlagMark';
import { CountryTabs } from '@/components/study-abroad/CountryTabs';
import { PlanBand } from '@/components/study-abroad/PlanBand';
import { ConnectBand } from '@/components/study-abroad/DiscoveryBands';
import { loadCountryTabs } from '@/lib/country-tabs';
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
  return { country: page.country, specialization };
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
  const { country, specialization } = loaded;
  const where = inCountry(country.name, country.iso2Code);
  const subject = specialization.subject;

  const courses = await getCourses({
    country: country.slug,
    subject: subject.slug,
    subSubject: specialization.slug,
    limit: '9',
  }).catch(() => null);

  /* The destination has to claim the field for this page to be about it.
     Published courses in it are the stronger claim and are checked first;
     the editorial link is what carries a market the catalogue has not
     reached yet. */
  const listed = (country.subjects ?? []).some(
    (entry) => entry.slug === subject.slug,
  );
  if (!listed && !courses?.meta.total) notFound();

  const tabs = await loadCountryTabs(
    country.slug,
    (country.subjects ?? []).length,
  );
  const subjectHref = `/study-abroad/${country.slug}/${subject.slug}`;
  const siblings = specialization.siblings
    .filter((entry) => entry.slug !== specialization.slug)
    .slice(0, 8);

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
            <Link href={subjectHref}>{subject.name}</Link>
            <span className="crumbs__sep" aria-hidden="true">
              /
            </span>
            <span aria-current="page">{specialization.name}</span>
          </nav>

          <h1 className="hero__h1">
            Study {specialization.name} in {where}
          </h1>

          <p className="hero__eyebrow hero__eyebrow--links">
            <FlagMark iso2Code={country.iso2Code ?? null} bands={null} />
            <Link href={`/study-abroad/${country.slug}`}>{country.name}</Link>
            <b>·</b>
            <Link href={subjectHref}>{subject.name}</Link>
            <b>·</b>
            <span>{specialization.name}</span>
          </p>

          {specialization.shortDescription ? (
            <p className="hero__sub">{specialization.shortDescription}</p>
          ) : null}
        </div>
      </section>

      <CountryTabs tabs={tabs} current="subjects" />

      <section className="sec wrap">
        <div className="sec-head left row-between">
          <div>
            <span className="eyebrow">Programmes</span>
            <h2 className="sec-title">
              {specialization.name} in {where}
            </h2>
            <p className="sec-lead">
              {courses?.meta.total
                ? `${formatNumber(courses.meta.total)} published ${courses.meta.total === 1 ? 'programme' : 'programmes'} a student going to ${where} can apply to.`
                : `No programme in ${specialization.name} is published for ${where} yet. ${subject.name} has more that may fit.`}
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
              <Link
                className="h-card"
                href={`/courses/${course.slug}`}
                key={course.id}
              >
                <span className="h-card__t">{course.name}</span>
                <span className="h-card__m">{course.courseLevel.name}</span>
              </Link>
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
              <Link
                className="h-card"
                href={`${subjectHref}/${entry.slug}`}
                key={entry.id}
              >
                <span className="h-card__t">{entry.name}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

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
