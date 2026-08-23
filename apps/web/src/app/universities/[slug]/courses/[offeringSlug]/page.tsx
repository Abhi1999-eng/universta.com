import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { type AnyRecord } from '@/components/phase1/PhaseOneViews';
import { UniversityCourseDetailReference } from '@/components/reference/UniversityCourseDetailReference';
import { phaseUniversityCourses } from '@/lib/phase1';
import { intakeRange } from '@/lib/intake-range';
import { formatNumber } from '@/lib/format';
import { phaseOneMetadata } from '@/lib/phase1-metadata';
import { resolveContentVariables } from '../../../../../../../../packages/content-variables';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string; offeringSlug: string }> };
type Row = Record<string, unknown>;

async function universityCourse(universitySlug: string, offeringSlug: string) {
  try {
    return await phaseUniversityCourses<AnyRecord>(universitySlug, offeringSlug);
  } catch {
    return null;
  }
}

function humanise(value: string) {
  return value.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

function duration(row: Row) {
  const min = row.durationMin as string | null;
  const max = row.durationMax as string | null;
  const unit = typeof row.durationUnit === 'string' ? row.durationUnit.toLowerCase() : 'months';
  if (!min && !max) return null;
  if (min && max && min !== max) return `${min}–${max} ${unit}`;
  const value = min ?? max;
  return `${value} ${Number(value) === 1 ? unit.replace(/s$/, '') : unit}`;
}

function tuition(row: Row) {
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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, offeringSlug } = await params;
  const row = await universityCourse(slug, offeringSlug);
  return row
    ? phaseOneMetadata(
        row,
        `/universities/${slug}/courses/${row.slug ?? offeringSlug}`,
        'University course',
      )
    : { title: 'University course not found | Universta', robots: { index: false } };
}

export default async function UniversityCourseDetailPage({ params }: Props) {
  const { slug, offeringSlug } = await params;
  const record = await universityCourse(slug, offeringSlug);
  if (!record) notFound();
  const row = record as unknown as Row;

  const university = row.university as Row | undefined;
  const country = university?.country as Row | undefined;
  const campus = row.campus as Row | undefined;
  const generic = row.genericCourse as Row | undefined;
  const level = (generic?.courseLevel ?? row.courseLevel) as Row | undefined;
  const subject = generic?.subject as Row | undefined;
  const subSubject = generic?.subSubject as Row | undefined;

  // Sibling programmes, so the "other programmes" block is real rather than a
  // hard-coded list. A failure here just drops the block.
  const siblings = await phaseUniversityCourses<{ data?: AnyRecord[] }>(slug, undefined, {
    limit: '5',
  })
    .then((result) => result.data ?? [])
    .catch(() => []);

  return (
    <UniversityCourseDetailReference
      university={{
        name: String(university?.name ?? 'University'),
        slug: String(university?.slug ?? slug),
        country: country?.name ? String(country.name) : null,
      }}
      offering={{
        id: String(row.id),
        name: String(row.name),
        slug: String(row.slug),
        courseCode: typeof row.courseCode === 'string' ? row.courseCode : null,
        shortDescription: typeof row.shortDescription === 'string' ? row.shortDescription : null,
        overview: typeof row.overview === 'string' ? resolveContentVariables('offering', row.overview, row) : null,
        level: level?.name ? String(level.name) : null,
        subject: subject?.slug
          ? { name: String(subject.name), slug: String(subject.slug) }
          : null,
        courseSlug: generic?.slug ? String(generic.slug) : null,
        subSubject: subSubject?.name ? String(subSubject.name) : null,
        studyMode: typeof row.studyMode === 'string' ? humanise(row.studyMode) : null,
        campus: campus?.name
          ? { name: String(campus.name), city: campus.city ? String(campus.city) : null }
          : null,
        duration: duration(row),
        tuition: tuition(row),
        tuitionPeriod: typeof row.tuitionPeriod === 'string' ? row.tuitionPeriod : null,
        applicationUrl: typeof row.applicationUrl === 'string' ? row.applicationUrl : null,
        sourceReference: typeof row.sourceReference === 'string' ? row.sourceReference : null,
        verifiedAt: typeof row.verifiedAt === 'string' ? row.verifiedAt : null,
      }}
      intakes={((row.intakes as Row[] | undefined) ?? []).map((entry) => {
        const intake = entry.intake as Row | undefined;
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
          notes: typeof entry.notes === 'string' ? entry.notes : null,
        };
      })}
      requirements={((row.requirements as Row[] | undefined) ?? []).map((entry) => ({
        category: String(entry.category ?? 'OTHER'),
        title: String(entry.title ?? 'Requirement'),
        description: typeof entry.description === 'string' ? entry.description : null,
        minimumScore: typeof entry.minimumScore === 'string' ? entry.minimumScore : null,
      }))}
      related={siblings
        .filter((entry) => String((entry as unknown as Row).slug) !== String(row.slug))
        .slice(0, 4)
        .map((entry) => {
          const sibling = entry as unknown as Row;
          const siblingGeneric = sibling.genericCourse as Row | undefined;
          const siblingLevel = siblingGeneric?.courseLevel as Row | undefined;
          return {
            name: String(sibling.name),
            slug: String(sibling.slug),
            level: siblingLevel?.name ? String(siblingLevel.name) : null,
            tuition: tuition(sibling),
          };
        })}
    />
  );
}
