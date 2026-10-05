import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { AnyRecord } from '@/components/phase1/PhaseOneViews';
import { FlagMark } from '@/components/study-abroad/FlagMark';
import { CountryTabs } from '@/components/study-abroad/CountryTabs';
import { UniversityIndex } from '@/components/study-abroad/UniversityIndex';
import { UniversitySearch } from '@/components/study-abroad/UniversitySearch';
import { PlanBand } from '@/components/study-abroad/PlanBand';
import {
  ConnectBand,
  MatchBand,
} from '@/components/study-abroad/DiscoveryBands';
import { loadCountryTabs } from '@/lib/country-tabs';
import { phaseListAll } from '@/lib/phase1';
import { getStudyAbroadCountry } from '@/lib/study-abroad';
import { inCountry } from '@/lib/country-article';
import { formatNumber } from '@/lib/format';
import { countryUniversitiesHref } from '@/lib/university-links';
import { isNarrowedList, toUniversityListRow } from '@/lib/university-list';

/**
 * Every institution in one destination.
 *
 * The country guide shows six and sends the rest to the global directory,
 * which drops the reader back into 900 universities in every country and
 * asks them to filter their way home. A student reading about Germany
 * wants Germany's institutions, so this is that list and nothing else:
 * the destination is already chosen, and the page does not make them
 * choose it again.
 *
 * It is the directory's own list with the destination fixed -- the same
 * search, filters, cards and "Load more" -- because a reader who learns
 * one should not have to learn the other. What only a destination can
 * offer, its cities, is offered from the start.
 */
export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ countrySlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function load(slug: string) {
  const page = await getStudyAbroadCountry(slug);
  const country = page?.country;
  if (!country) return null;
  /* Ranked first, then A to Z: the order the list opens in. */
  const list = await phaseListAll<AnyRecord>('universities', {
    country: slug,
    sort: 'ranking',
  }).catch(() => null);
  return {
    country,
    universities: (list?.data ?? []).map(toUniversityListRow),
  };
}

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { countrySlug } = await params;
  const page = await getStudyAbroadCountry(countrySlug);
  const country = page?.country;
  if (!country)
    return {
      title: { absolute: 'Destination not found | Universta' },
      robots: { index: false },
    };
  const where = inCountry(country.name, country.iso2Code);
  /* A searched, filtered or further-loaded view is a slice of a page that
     is indexed in full: left out of the index, its links still followed. */
  const narrowed = isNarrowedList(await searchParams);
  return {
    title: { absolute: `Universities in ${where} | Universta` },
    description: `Every university in ${where} the Universta catalogue holds, with its city, type, ranking and the programmes it teaches.`,
    ...(narrowed
      ? { robots: { index: false, follow: true } }
      : { alternates: { canonical: countryUniversitiesHref(country.slug) } }),
  };
}

export default async function Page({ params }: Props) {
  const { countrySlug } = await params;
  const loaded = await load(countrySlug);
  if (!loaded) notFound();
  const { country, universities } = loaded;
  const where = inCountry(country.name, country.iso2Code);
  const programmes = universities.reduce((sum, row) => sum + row.programmes, 0);

  const tabs = await loadCountryTabs(
    country.slug,
    (country.subjects ?? []).length,
  );
  const tab = (key: string) => tabs.find((entry) => entry.key === key);
  const subjectsTab = tab('subjects');
  const scholarshipsTab = tab('scholarships');

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

          <div className="hero__lead">
            <p className="hero__eyebrow">
              <FlagMark iso2Code={country.iso2Code ?? null} bands={null} />{' '}
              {universities.length ? (
                <>
                  {formatNumber(universities.length)}{' '}
                  {universities.length === 1 ? 'university' : 'universities'}
                  {programmes ? (
                    <>
                      <b>·</b>
                      {formatNumber(programmes)}{' '}
                      {programmes === 1 ? 'programme' : 'programmes'} profiled
                    </>
                  ) : null}
                </>
              ) : (
                country.name
              )}
            </p>
            <h1 className="hero__h1">Universities in {where}</h1>
            <p className="hero__sub">
              {universities.length
                ? `Every university here has a published Universta profile. Search by name or city, narrow by field of study and type, then open one to see the programmes it actually teaches.`
                : `No university in ${where} is published yet. The destination guide is worth a look in the meantime.`}
            </p>
          </div>

          {universities.length ? (
            <UniversitySearch
              placeholder={`Search universities in ${where}`}
              label={`Search universities in ${where}`}
            />
          ) : null}

          <div className="btn-row unilinks">
            <Link className="linkcta" href={`/study-abroad/${country.slug}`}>
              Studying in {where}{' '}
              <span className="linkcta__arrow" aria-hidden="true">
                &rarr;
              </span>
            </Link>
            <Link className="linkcta" href="/universities">
              Universities everywhere{' '}
              <span className="linkcta__arrow" aria-hidden="true">
                &rarr;
              </span>
            </Link>
            <Link className="linkcta" href="/compare/universities">
              Compare universities{' '}
              <span className="linkcta__arrow" aria-hidden="true">
                &rarr;
              </span>
            </Link>
          </div>
        </div>
      </section>

      <CountryTabs tabs={tabs} current="universities" />

      <UniversityIndex
        universities={universities}
        country={{ slug: country.slug, name: where }}
        footer={
          <p className="h-more">
            <Link href={`/study-abroad/${country.slug}`}>
              Back to the {country.name} guide
            </Link>
          </p>
        }
      />

      <MatchBand
        heading={`Found a university in ${where}?`}
        href={`/courses?country=${country.slug}`}
      />

      <PlanBand
        heading={`Not sure which university in ${where} fits?`}
        countrySlug={country.slug}
        countryName={country.name}
        secondary={{
          href: `/study-abroad/${country.slug}`,
          label: `${country.name} guide`,
        }}
      />

      <ConnectBand
        actions={[
          { href: `/courses?country=${country.slug}`, label: `Courses in ${where}` },
          ...(subjectsTab
            ? [{ href: subjectsTab.href, label: 'Subjects here', ghost: true }]
            : []),
          ...(scholarshipsTab
            ? [{ href: scholarshipsTab.href, label: 'Scholarships', ghost: true }]
            : []),
        ]}
        groups={[
          {
            title: `Subjects in ${where}`,
            items: (country.subjects ?? []).slice(0, 6).map((subject) => ({
              id: subject.id,
              name: subject.name,
              href: `/study-abroad/${country.slug}/${subject.slug}`,
            })),
          },
        ]}
      />
    </>
  );
}
