import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FlagMark } from '@/components/study-abroad/FlagMark';
import { CountryTabs } from '@/components/study-abroad/CountryTabs';
import { loadCountryTabs } from '@/lib/country-tabs';
import type { AnyRecord } from '@/components/phase1/PhaseOneViews';
import { phaseListAll } from '@/lib/phase1';
import { rankedFirst } from '@/lib/country-sub-pages';
import { getStudyAbroadCountry } from '@/lib/study-abroad';

/**
 * Every institution in one destination.
 *
 * The country guide shows six and sends the rest to the global directory,
 * which drops the reader back into 900 universities in every country and
 * asks them to filter their way home. A student reading about Germany
 * wants Germany's institutions, so this is that list and nothing else:
 * the destination is already chosen, and the page does not make them
 * choose it again.
 */
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ countrySlug: string }> };

type Row = {
  id: string;
  name: string;
  slug: string;
  shortDescription?: string | null;
  institutionType?: string | null;
  qsRanking?: number | null;
  totalStudents?: number | null;
  internationalStudentsPercent?: string | number | null;
};

const typeLabel = (value: string | null | undefined) =>
  value
    ? value
        .toLowerCase()
        .split('_')
        .map((word) => word[0]!.toUpperCase() + word.slice(1))
        .join(' ')
    : null;

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((word) => /^[A-Za-z]/.test(word))
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join('') || name.slice(0, 2).toUpperCase();

async function load(slug: string) {
  const page = await getStudyAbroadCountry(slug);
  const country = page?.country;
  if (!country) return null;
  const list = await phaseListAll<Row>('universities', { country: slug });
  return { country, universities: list.data ?? [] };
}

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
    title: { absolute: `Universities in ${country.name} | Universta` },
    description: `Every university in ${country.name} the Universta catalogue holds, with its type, ranking and the programmes it teaches.`,
    alternates: { canonical: `/study-abroad/${country.slug}/universities` },
  };
}

export default async function Page({ params }: Params) {
  const { countrySlug } = await params;
  const loaded = await load(countrySlug);
  if (!loaded) notFound();
  const { country, universities } = loaded;

  const sorted = rankedFirst(universities);
  const tabs = await loadCountryTabs(
    country.slug,
    (country.subjects ?? []).length,
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
            <span aria-current="page">Universities</span>
          </nav>
          <p className="hero__eyebrow">
            <FlagMark iso2Code={country.iso2Code ?? null} bands={null} />{' '}
            {country.name}
          </p>
          <h1 className="hero__h1">Universities in {country.name}</h1>
          <p className="hero__sub">
            {sorted.length
              ? `${sorted.length} ${sorted.length === 1 ? 'institution' : 'institutions'} published in this destination. Open one to see the programmes it actually teaches.`
              : `No university in ${country.name} is published yet. The destination guide is worth a look in the meantime.`}
          </p>
        </div>
      </section>

      <CountryTabs tabs={tabs} current="universities" />

      <section className="sec sec--white sec--tight">
        <div className="wrap">
          {sorted.length ? (
            <div className="unigrid">
              {sorted.map((university) => (
                <article className="unicard" key={university.id}>
                  <div className="unicard__head">
                    <span className="unimark" aria-hidden="true">
                      {initials(university.name)}
                    </span>
                    <div className="unicard__id">
                      <h2 className="unicard__name">
                        <Link href={`/universities/${university.slug}`}>
                          {university.name}
                        </Link>
                      </h2>
                      {typeLabel(university.institutionType) ? (
                        <p className="unicard__type">
                          {typeLabel(university.institutionType)}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {university.totalStudents ||
                  university.internationalStudentsPercent ? (
                    <dl className="unicard__stats">
                      {university.totalStudents ? (
                        <div>
                          <dt>Students</dt>
                          <dd>
                            {Number(university.totalStudents).toLocaleString(
                              'en-GB',
                            )}
                          </dd>
                        </div>
                      ) : null}
                      {university.internationalStudentsPercent ? (
                        <div>
                          <dt>International</dt>
                          <dd>{`${Number(university.internationalStudentsPercent)}%`}</dd>
                        </div>
                      ) : null}
                    </dl>
                  ) : null}

                  {university.shortDescription ? (
                    <p className="unicard__fields">
                      {university.shortDescription}
                    </p>
                  ) : null}

                  <div className="unicard__foot">
                    <Link
                      className="btn btn--sm"
                      href={`/universities/${university.slug}`}
                    >
                      View university{' '}
                      <span className="btn__arrow" aria-hidden="true">
                        &rarr;
                      </span>
                    </Link>
                    {university.qsRanking ? (
                      <span className="unicard__rank">
                        Ranked #{university.qsRanking} &middot; one factor
                        among many
                      </span>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="dir__none">
              No university in {country.name} is published yet.
            </p>
          )}

          <p className="h-more">
            <Link href={`/study-abroad/${country.slug}`}>
              Back to the {country.name} guide
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
