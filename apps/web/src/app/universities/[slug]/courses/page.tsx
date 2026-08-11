import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { AnyRecord } from '@/components/phase1/PhaseOneViews';
import {
  UniversityCoursesReference,
  type OfferingRow,
} from '@/components/reference/UniversityCoursesReference';
import { phaseList, phaseUniversityCourses } from '@/lib/phase1';
import { intakeRange } from '@/lib/intake-range';
import { formatNumber } from '@/lib/format';
import { phaseOneMetadata } from '@/lib/phase1-metadata';

export const dynamic = 'force-dynamic';

type Meta = { page: number; limit: number; total: number; totalPages: number };
type Result = {
  university?: { name?: string; slug?: string };
  data?: AnyRecord[];
  meta?: Meta;
};

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Only the parameters the offerings endpoint actually honours. */
const SUPPORTED = ['courseLevel', 'studyMode', 'intake', 'scholarshipAvailable', 'page'] as const;

async function load(slug: string, params: Record<string, string> = {}) {
  try {
    return await phaseUniversityCourses<Result>(slug, undefined, params);
  } catch {
    return null;
  }
}

function humanise(value: string) {
  return value.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

function duration(row: Record<string, unknown>) {
  const min = row.durationMin as string | null;
  const max = row.durationMax as string | null;
  const unit = typeof row.durationUnit === 'string' ? row.durationUnit.toLowerCase() : 'months';
  if (!min && !max) return null;
  if (min && max && min !== max) return `${min}–${max} ${unit}`;
  const value = min ?? max;
  return `${value} ${Number(value) === 1 ? unit.replace(/s$/, '') : unit}`;
}

function tuition(row: Record<string, unknown>) {
  const min = row.tuitionMin as string | null;
  const max = row.tuitionMax as string | null;
  if (!min && !max) return null;
  const code = typeof row.currencyCode === 'string' ? `${row.currencyCode} ` : '';
  const amount =
    min && max && min !== max
      ? `${formatNumber(min)}–${formatNumber(max)}`
      : formatNumber(min ?? max);
  const period = row.tuitionPeriod === 'PER_YEAR' ? '/yr' : '';
  return `${code}${amount}${period}`;
}

function toRow(record: AnyRecord): OfferingRow {
  const row = record as unknown as Record<string, unknown>;
  const generic = row.genericCourse as Record<string, unknown> | undefined;
  const campus = row.campus as Record<string, unknown> | undefined;
  const level = (generic?.courseLevel ?? row.courseLevel) as
    | Record<string, unknown>
    | undefined;
  const intakes = (row.intakes as Array<Record<string, unknown>> | undefined) ?? [];
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    shortDescription: typeof row.shortDescription === 'string' ? row.shortDescription : null,
    courseName: generic?.name ? String(generic.name) : null,
    subject: (generic?.subject as Record<string, unknown> | undefined)?.name
      ? String((generic!.subject as Record<string, unknown>).name)
      : null,
    subSubject: (generic?.subSubject as Record<string, unknown> | undefined)?.name
      ? String((generic!.subSubject as Record<string, unknown>).name)
      : null,
    level: level?.name ? String(level.name) : null,
    levelCode: level?.code ? String(level.code) : null,
    studyMode: typeof row.studyMode === 'string' ? humanise(row.studyMode) : null,
    campus: campus?.name ? String(campus.name) : null,
    duration: duration(row),
    tuition: tuition(row),
    intakes: intakes.map((entry) => {
      const intake = entry.intake as Record<string, unknown> | undefined;
      return {
        label: intake
          ? intakeRange({
              startMonth: intake.startMonth as number | null,
              endMonth: intake.endMonth as number | null,
              shortLabel: intake.shortLabel as string | null,
              name: intake.name as string | null,
            })
          : 'Not published',
        deadline: typeof entry.deadline === 'string' ? entry.deadline : null,
      };
    }),
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const result = await load(slug);
  const name = result?.university?.name ?? 'University';
  return result
    ? phaseOneMetadata(
        { name, summary: `Published university courses from ${name}.` },
        `/universities/${slug}/courses`,
        'University courses',
      )
    : { title: 'University courses not found | Universta', robots: { index: false } };
}

export default async function UniversityCoursesPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const raw = await searchParams;
  const filters = Object.fromEntries(
    SUPPORTED.flatMap((key) => {
      const value = raw[key];
      return typeof value === 'string' && value ? [[key, value]] : [];
    }),
  ) as Record<string, string>;

  // The filtered page plus the whole published catalogue: the endpoint returns
  // no facet counts, so the options are derived from this university's own
  // offerings and can never list a value that returns nothing.
  const [result, everything, scholarships] = await Promise.all([
    load(slug, { limit: '10', ...filters }),
    load(slug, { limit: '100' }),
    phaseList<AnyRecord>('scholarships', { university: slug, limit: '3' })
      .then((r) => r.data)
      .catch(() => []),
  ]);
  if (!result?.university) notFound();

  const all = (everything?.data ?? []).map(toRow);

  function facet(pick: (row: OfferingRow) => [string, string] | null) {
    const map = new Map<string, { value: string; label: string; count: number }>();
    for (const row of all) {
      const entry = pick(row);
      if (!entry) continue;
      const [value, label] = entry;
      const existing = map.get(value);
      if (existing) existing.count += 1;
      else map.set(value, { value, label, count: 1 });
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }

  const rawAll = everything?.data ?? [];
  const subjects = (() => {
    const map = new Map<string, { value: string; label: string; count: number }>();
    for (const record of rawAll) {
      const generic = (record as unknown as Record<string, unknown>).genericCourse as
        | Record<string, unknown>
        | undefined;
      const subject = generic?.subject as Record<string, unknown> | undefined;
      if (!subject?.slug) continue;
      const value = String(subject.slug);
      const existing = map.get(value);
      if (existing) existing.count += 1;
      else map.set(value, { value, label: String(subject.name), count: 1 });
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  })();

  const intakeFacet = (() => {
    const map = new Map<string, { value: string; label: string; count: number }>();
    for (const record of rawAll) {
      const entries =
        ((record as unknown as Record<string, unknown>).intakes as
          | Array<Record<string, unknown>>
          | undefined) ?? [];
      for (const entry of entries) {
        const intake = entry.intake as Record<string, unknown> | undefined;
        if (!intake?.slug) continue;
        const value = String(intake.slug);
        const existing = map.get(value);
        if (existing) existing.count += 1;
        else
          map.set(value, {
            value,
            label: intakeRange({
              startMonth: intake.startMonth as number | null,
              endMonth: intake.endMonth as number | null,
              shortLabel: intake.shortLabel as string | null,
              name: intake.name as string | null,
            }),
            count: 1,
          });
      }
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  })();

  const deadlines = all
    .flatMap((row) => row.intakes)
    .filter((entry, index, list) => {
      const key = `${entry.label}|${entry.deadline ?? ''}`;
      return list.findIndex((other) => `${other.label}|${other.deadline ?? ''}` === key) === index;
    })
    .slice(0, 6);

  return (
    <UniversityCoursesReference
      university={{
        name: String(result.university.name ?? 'University'),
        slug: String(result.university.slug ?? slug),
      }}
      rows={(result.data ?? []).map(toRow)}
      meta={result.meta ?? { page: 1, limit: 10, total: 0, totalPages: 0 }}
      filters={filters}
      facets={{
        levels: facet((row) => (row.levelCode && row.level ? [row.levelCode, row.level] : null)),
        studyModes: facet((row) => (row.studyMode ? [row.studyMode.toUpperCase().replace(/ /g, '_'), row.studyMode] : null)),
        intakes: intakeFacet,
        subjects,
        campuses: [...new Set(all.map((row) => row.campus).filter(Boolean))] as string[],
      }}
      deadlines={deadlines}
      scholarships={scholarships.map((row) => {
        const extra = row as Record<string, unknown>;
        const amount = extra.amount;
        return {
          title: String(row.title ?? row.name),
          slug: String(row.slug),
          amount:
            typeof amount === 'string' && amount
              ? `${typeof row.currencyCode === 'string' ? `${row.currencyCode} ` : ''}${formatNumber(amount)}`
              : null,
        };
      })}
      totalOfferings={everything?.meta?.total ?? all.length}
    />
  );
}
