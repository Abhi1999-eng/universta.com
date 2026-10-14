import type { Metadata } from 'next';
import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import { richTextToPlainText } from '@/components/phase1/RichText';
import { FlagMark } from '@/components/study-abroad/FlagMark';
import { RecordCompare, type CompareRow } from '@/components/study-abroad/RecordCompare';
import { formatNumber } from '@/lib/format';
import { phaseCompare, phaseComparisonOptions } from '@/lib/phase1';
import { COMPARE_LIMIT, readCompareSlugs } from '@/lib/record-compare';
import { staticPageMetadata } from '@/lib/static-page-seo';

/**
 * Destinations side by side, in the approved design: what each destination's
 * published profile holds on cost, work, language, intakes and what the
 * catalogue lists for it. A field a profile does not record says so.
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const metadata = await staticPageMetadata(
    'compare-countries',
    'Compare countries',
    'Compare published tuition, post-study work and intake information side by side.',
    '/compare/countries',
    false,
  );
  return { ...metadata, title: { absolute: String(metadata.title) } };
}

type Dict = Record<string, unknown>;
/* The compare endpoint's rows carry more than the typed record names. */
type Comparison = { items: Dict[]; invalid: string[] };

const NONE = 'Not published';
const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);
const dict = (value: unknown): Dict => (value && typeof value === 'object' ? (value as Dict) : {});
const number = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};
const period = (value: unknown) =>
  ({ PER_YEAR: 'per year', PER_SEMESTER: 'per semester', PER_MONTH: 'per month', PER_WEEK: 'per week', TOTAL: 'in total' })[
    String(value ?? '')
  ] ?? null;
const humanise = (value: unknown) => {
  const raw = text(value);
  return raw ? raw.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (character) => character.toUpperCase()) : null;
};

function money(profile: Dict, minKey: string, maxKey: string, periodKey: string) {
  const min = number(profile[minKey]);
  const max = number(profile[maxKey]);
  if (!min && !max) return null;
  const unit = text(profile.currencySymbol) ?? text(profile.currencyCode) ?? '';
  const range = min && max && min !== max ? `${formatNumber(min)}–${formatNumber(max)}` : formatNumber(min ?? max!);
  return [`${unit}${unit.length > 1 ? ' ' : ''}${range}`, period(profile[periodKey])].filter(Boolean).join(' ');
}

function test(requirements: Dict, key: string) {
  const requirement = text(requirements[`${key}Requirement`]);
  const score = text(requirements[`${key}MinScore`]);
  if (!requirement && !score) return null;
  if (requirement === 'NOT_REQUIRED') return 'Not required';
  return [score ? `${score} minimum` : null, requirement === 'VARIES' ? 'varies by institution' : null].filter(Boolean).join(', ') || humanise(requirement);
}

function summary(value: unknown, limit = 140) {
  const raw = text(value);
  if (!raw) return null;
  const plain = richTextToPlainText(raw);
  if (!plain) return null;
  return plain.length > limit ? `${plain.slice(0, limit).replace(/\s+\S*$/, '')}…` : plain;
}

export default async function CompareCountries({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const requested = readCompareSlugs(await searchParams);
  const [result, options] = await Promise.all([
    requested.length
      ? phaseCompare<Comparison>('countries', requested).catch(() => null)
      : Promise.resolve<Comparison>({ items: [], invalid: [] }),
    phaseComparisonOptions<{ slug: string; name: string }>('countries').catch(() => []),
  ]);
  const byslug = new Map((result?.items ?? []).flatMap((row) => (text(row.slug) ? [[String(row.slug), row] as const] : [])));
  const items = requested.flatMap((slug) => (byslug.has(slug) ? [byslug.get(slug)!] : []));
  const invalid = result ? requested.filter((slug) => !byslug.has(slug)) : [];

  /* Each cell keyed by its column: the rows cross to the client as props,
     and React asks for keys on any list of elements it carries. */
  const cell = (render: (row: Dict) => ReactNode) =>
    items.map((row) => <Fragment key={String(row.slug)}>{render(row) ?? NONE}</Fragment>);
  const rows: CompareRow[] = [
    {
      label: 'Tuition',
      cells: cell((row) => money(dict(row.costProfile), 'tuitionMin', 'tuitionMax', 'tuitionPeriod')),
    },
    {
      label: 'Living costs',
      cells: cell((row) => money(dict(row.costProfile), 'livingCostMin', 'livingCostMax', 'livingCostPeriod')),
    },
    { label: 'Budget band', cells: cell((row) => humanise(dict(row.costProfile).budgetBand)) },
    {
      label: 'Part-time work',
      cells: cell((row) => {
        const work = dict(row.workProfile);
        if (work.partTimeAllowed === true) {
          const hours = number(work.partTimeHoursPerWeek);
          return hours ? `Allowed, up to ${hours} hours a week` : 'Allowed';
        }
        if (work.partTimeAllowed === false) return 'Not allowed';
        return null;
      }),
    },
    {
      label: 'Post-study work',
      cells: cell((row) => {
        const work = dict(row.workProfile);
        const months = number(row.postStudyWorkPermitMonths) ?? number(work.postStudyWorkMaxMonths) ?? number(work.postStudyWorkMinMonths);
        if (work.postStudyWorkAvailable === true) return months ? `Available, up to ${months} months` : 'Available';
        if (work.postStudyWorkAvailable === false) return 'Not available';
        return months ? `Up to ${months} months` : null;
      }),
    },
    { label: 'IELTS', cells: cell((row) => test(dict(row.languageRequirements), 'ielts')) },
    { label: 'TOEFL', cells: cell((row) => test(dict(row.languageRequirements), 'toefl')) },
    { label: 'PTE', cells: cell((row) => test(dict(row.languageRequirements), 'pte')) },
    {
      label: 'Language waiver',
      cells: cell((row) => {
        const waiver = dict(row.languageRequirements).languageWaiverAvailable;
        return waiver === true ? 'Available at some institutions' : waiver === false ? 'Not available' : null;
      }),
    },
    {
      label: 'Main intakes',
      cells: cell((row) => {
        const intakes = (Array.isArray(row.intakes) ? row.intakes : []) as Dict[];
        const names = intakes
          .filter((entry) => entry.isMajor !== false)
          .map((entry) => text(dict(entry.intake).shortLabel) ?? text(dict(entry.intake).name))
          .filter(Boolean);
        return names.length ? names.join(' · ') : null;
      }),
    },
    {
      label: 'Universities listed',
      cells: cell((row) => {
        const count = number(dict(row.statistics).universitiesCount);
        return count ? <Link href={`/study-abroad/${row.slug}/universities`}>{formatNumber(count)}</Link> : null;
      }),
    },
    {
      label: 'Courses listed',
      cells: cell((row) => {
        const count = number(dict(row.statistics).coursesCount);
        return count ? <Link href={`/courses?country=${row.slug}`}>{formatNumber(count)}</Link> : null;
      }),
    },
    {
      label: 'Scholarships listed',
      cells: cell((row) => {
        const count = number(dict(row.statistics).scholarshipsCount);
        return count ? <Link href={`/study-abroad/${row.slug}/scholarships`}>{formatNumber(count)}</Link> : null;
      }),
    },
    { label: 'In a sentence', cells: cell((row) => summary(row.tagline) ?? summary(row.shortDescription)) },
  ];

  return (
    <RecordCompare
      kind="countries"
      max={COMPARE_LIMIT}
      crumbs={[{ label: 'Home', href: '/' }, { label: 'Study abroad', href: '/study-abroad' }, { label: 'Compare' }]}
      eyebrow="Compare destinations"
      title="Compare study destinations side by side"
      lead="Put destinations against each other on the published cost, work, language and intake information in each guide."
      noun={['destination', 'destinations']}
      columns={items.map((row) => ({
        slug: String(row.slug),
        name: String(row.name),
        meta: text(row.capitalCity) ? `Capital: ${String(row.capitalCity)}` : null,
        href: `/study-abroad/${row.slug}`,
        mark: <FlagMark iso2Code={text(row.iso2Code)} bands={null} />,
      }))}
      rows={rows}
      options={options}
      selected={requested}
      invalid={invalid}
      unavailable={result === null}
      browse={{ href: '/study-abroad', label: 'Browse destinations' }}
      note="Figures are indicative planning ranges from each destination's published profile. Fees, hours and visa rules are set by institutions and governments and change; confirm them on the official sources before planning."
      counselling={{
        heading: 'Not sure which destination fits?',
        body: 'A counsellor can weigh these destinations against your marks, budget and target intake.',
        href: '/counselling?source=general&from=%2Fcompare%2Fcountries',
      }}
    />
  );
}
