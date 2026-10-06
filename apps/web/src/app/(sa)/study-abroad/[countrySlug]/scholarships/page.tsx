import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { AnyRecord } from '@/components/phase1/PhaseOneViews';
import { CountryListSearch } from '@/components/study-abroad/CountryListSearch';
import { CountryScholarshipIndex } from '@/components/study-abroad/CountryScholarshipIndex';
import { CountryTabs } from '@/components/study-abroad/CountryTabs';
import { ConnectBand } from '@/components/study-abroad/DiscoveryBands';
import { FlagMark } from '@/components/study-abroad/FlagMark';
import { PlanBand } from '@/components/study-abroad/PlanBand';
import { getCourseLevels } from '@/lib/catalog';
import { inCountry } from '@/lib/country-article';
import { countryConsultantsHref } from '@/lib/country-consultant-list';
import {
  countryScholarshipsHref,
  isNarrowedScholarshipList,
  scholarshipListHref,
  scholarshipOptions,
  toCountryScholarshipRows,
} from '@/lib/country-scholarship-list';
import { destinationTotal, loadCountryTabs } from '@/lib/country-tabs';
import { formatNumber } from '@/lib/format';
import { phaseListAll } from '@/lib/phase1';
import { getStudyAbroadCountry } from '@/lib/study-abroad';
import { countryUniversitiesHref } from '@/lib/university-links';

/**
 * Every scholarship for one destination, under the destination.
 *
 * The behaviour reference keeps a destination's funding at
 * /study-abroad/<country>/scholarships, beside its subjects and
 * universities, with the destination's tabs above it. The guide's
 * Scholarships tab and its buttons used to leave for the worldwide finder
 * in the older design, which never named the country and had no tab back.
 * That finder still answers `/scholarships?country=`, for the links that
 * already point at it.
 */
export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ countrySlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** How many level reads are in flight together: the API sheds load above
 *  about a dozen concurrent requests, and the page has others of its own. */
const LEVEL_BATCH = 3;

async function load(slug: string) {
  const page = await getStudyAbroadCountry(slug);
  if (!page) return null;
  const [list, levels] = await Promise.all([
    phaseListAll<AnyRecord>('scholarships', { country: slug }).catch(() => null),
    getCourseLevels().catch(() => []),
  ]);
  /* Which awards are for which study level, asked of the list endpoint one
     level at a time -- its own reading of "for Master's", through the
     programmes an award is attached to -- so the level filter here agrees
     with the worldwide finder's. A level whose read fails is not offered,
     rather than offered with a count that is not true. */
  const byLevel = new Map<string, Set<string>>();
  if (list?.data.length) {
    for (let index = 0; index < levels.length; index += LEVEL_BATCH) {
      const batch = levels.slice(index, index + LEVEL_BATCH);
      const results = await Promise.all(
        batch.map((level) =>
          phaseListAll<AnyRecord>('scholarships', {
            country: slug,
            degreeLevel: level.code,
          })
            .then((result) => result.data)
            .catch(() => []),
        ),
      );
      batch.forEach((level, at) => {
        const ids = new Set(results[at]!.map((row) => String(row.id)));
        if (ids.size) byLevel.set(level.code, ids);
      });
    }
  }
  return {
    page,
    failed: list === null,
    rows: toCountryScholarshipRows(list?.data ?? [], byLevel, new Date()),
    levels: levels.map((level) => ({ code: level.code, name: level.name })),
  };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { countrySlug } = await params;
  const page = await getStudyAbroadCountry(countrySlug);
  const country = page?.country;
  if (!country)
    return {
      title: { absolute: 'Destination not found | Universta' },
      robots: { index: false },
    };
  const where = inCountry(country.name, country.iso2Code);
  /* A searched or filtered view is a slice of a page indexed whole. */
  const narrowed = isNarrowedScholarshipList(await searchParams);
  return {
    title: { absolute: `Scholarships to study in ${where} | Universta` },
    description: `Scholarships for international students in ${where} listed on Universta, with who offers each one, what it is worth and when it closes.`,
    /* An empty list is not a page to send a search engine to, and its
       description would promise what is not there. */
    ...(narrowed || (await destinationTotal(country.slug, 'scholarships')) === 0
      ? { robots: { index: false, follow: true } }
      : { alternates: { canonical: countryScholarshipsHref(country.slug) } }),
  };
}

export default async function Page({ params }: Props) {
  const { countrySlug } = await params;
  const loaded = await load(countrySlug);
  if (!loaded) notFound();
  const { page, rows, levels, failed } = loaded;
  const { country } = page;
  const where = inCountry(country.name, country.iso2Code);
  const tabs = await loadCountryTabs(country.slug, (country.subjects ?? []).length);
  const tab = (key: string) => tabs.find((entry) => entry.key === key);
  const subjectsTab = tab('subjects');
  const universitiesTab = tab('universities');
  const consultants = page.consultants?.total ?? 0;

  /* The design's "Narrow by" row: each funding type and study level the
     awards here carry, with how many, as plain links into the list below
     -- the reference's "Types of scholarships" -- so each slice has an
     address of its own. Offered only when it would narrow anything. */
  const options = scholarshipOptions(rows, levels);
  const path = countryScholarshipsHref(country.slug);
  const narrowBy = [
    ...options.types
      .filter((option) => option.count < rows.length)
      .map((option) => ({
        key: `type-${option.value}`,
        label: option.label,
        count: option.count,
        href: `${scholarshipListHref(path, { types: [option.value] })}#scholarships`,
      })),
    ...options.levels
      .filter((option) => option.count < rows.length)
      .map((option) => ({
        key: `level-${option.value}`,
        label: `${option.label} awards`,
        count: option.count,
        href: `${scholarshipListHref(path, { levels: [option.value] })}#scholarships`,
      })),
  ];

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
            <span aria-current="page">Scholarships</span>
          </nav>

          <div className="hero__lead">
            <p className="hero__eyebrow">
              <FlagMark iso2Code={country.iso2Code ?? null} bands={null} />{' '}
              {rows.length
                ? `${formatNumber(rows.length)} ${rows.length === 1 ? 'scholarship' : 'scholarships'}`
                : country.name}
            </p>
            <h1 className="hero__h1">Scholarships to study in {where}</h1>
            <p className="hero__sub">
              {failed
                ? `The scholarships for ${where} could not be loaded just now. Please try again shortly.`
                : rows.length
                  ? `Every award Universta lists for ${where}, with who offers it, what it is worth and when it closes, as the provider published it. Search by name or provider, then narrow by level and funding type.`
                  : `No scholarship for ${where} is published yet. The destination guide is worth a look in the meantime.`}
            </p>
          </div>

          {rows.length ? (
            <CountryListSearch
              placeholder={`Search scholarships in ${where}`}
              label={`Search scholarships in ${where}`}
            />
          ) : null}

          {narrowBy.length ? (
            <div className="citychips">
              <span className="label">Narrow by</span>
              {narrowBy.map((link) => (
                <Link className="specchip specchip--live" href={link.href} key={link.key}>
                  {link.label}
                  <em>{link.count}</em>
                </Link>
              ))}
            </div>
          ) : null}

          <div className="btn-row unilinks">
            <Link className="linkcta" href={`/study-abroad/${country.slug}`}>
              Studying in {where}{' '}
              <span className="linkcta__arrow" aria-hidden="true">
                &rarr;
              </span>
            </Link>
            <Link className="linkcta" href="/scholarships">
              Scholarships everywhere{' '}
              <span className="linkcta__arrow" aria-hidden="true">
                &rarr;
              </span>
            </Link>
          </div>
        </div>
      </section>

      <CountryTabs tabs={tabs} current="scholarships" />

      {failed ? (
        <section className="sec sec--white sec--tight" id="scholarships">
          <div className="wrap">
            <div className="dir__none">
              <p>The scholarships for {where} could not be loaded just now.</p>
              <Link className="btn btn--sm btn--ghost" href={path}>
                Try again
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <CountryScholarshipIndex rows={rows} levels={levels} where={where} />
      )}

      <PlanBand
        heading={`Not sure which scholarship in ${where} fits?`}
        countrySlug={country.slug}
        countryName={country.name}
        secondary={{
          href: `/study-abroad/${country.slug}`,
          label: `${country.name} guide`,
        }}
      />

      {/* The zip's "Keep exploring": the rest of the destination, each link
          already narrowed to it. */}
      <ConnectBand
        actions={[
          { href: `/courses?country=${country.slug}`, label: `Courses in ${where}` },
          ...(universitiesTab
            ? [
                {
                  href: countryUniversitiesHref(country.slug),
                  label: 'Universities here',
                  ghost: true,
                },
              ]
            : []),
          ...(subjectsTab
            ? [{ href: subjectsTab.href, label: 'Subjects here', ghost: true }]
            : []),
          ...(consultants
            ? [
                {
                  href: countryConsultantsHref(country.slug),
                  label: 'Consultants',
                  ghost: true,
                },
              ]
            : []),
        ]}
        groups={[
          {
            title: `Subjects in ${where}`,
            total: (country.subjects ?? []).length,
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
