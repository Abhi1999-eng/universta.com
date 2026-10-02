import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import type { AnyRecord } from '@/components/phase1/PhaseOneViews';
import { phaseDetail, phaseList, phaseResolveRedirect } from '@/lib/phase1';
import { toScholarshipCards } from '@/lib/scholarship-card';
import { phaseOneMetadata } from '@/lib/phase1-metadata';
import {
  UniversityGuide,
  type UniversityOffering,
  type UniversityRecord,
} from '@/components/study-abroad/UniversityGuide';
import { PlanBand } from '@/components/study-abroad/PlanBand';
import {
  ConnectBand,
  MatchBand,
} from '@/components/study-abroad/DiscoveryBands';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

async function university(slug: string) {
  try {
    return await phaseDetail<AnyRecord>('universities', slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const row = await university(slug);
  if (!row)
    return {
      title: { absolute: 'University not found | Universta' },
      robots: { index: false },
    };
  const meta = phaseOneMetadata(
    row,
    `/universities/${row.slug ?? slug}`,
    'University',
  );
  /* The catalogue's own resolver already ends the title with the site name,
     and this route group's layout appends it again through its template.
     Absolute says the title is finished. */
  return typeof meta.title === 'string'
    ? { ...meta, title: { absolute: meta.title } }
    : meta;
}

const text = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value : null;
const whole = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

/** An offering carries its own name, level and duration, and reaches the
 * subject through the generic course it is an instance of. */
function toOffering(row: Record<string, unknown>): UniversityOffering {
  const generic = (row.genericCourse ?? {}) as Record<string, unknown>;
  const subject = generic.subject as Record<string, unknown> | undefined;
  const specialization = generic.subSubject as
    | Record<string, unknown>
    | undefined;
  const level = generic.courseLevel as Record<string, unknown> | undefined;
  /* The offering's own figures where it has them, the generic course's
     otherwise: a university that has not stated its duration still teaches
     the programme the catalogue describes. */
  const pick = (key: string) => row[key] ?? generic[key];
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    shortDescription: text(row.shortDescription ?? generic.shortDescription),
    qualificationName: text(generic.qualificationName ?? generic.shortName),
    subject: subject?.name
      ? { name: String(subject.name), slug: String(subject.slug ?? '') }
      : null,
    specialization: specialization?.name
      ? {
          name: String(specialization.name),
          slug: String(specialization.slug ?? ''),
        }
      : null,
    courseLevel: level?.name
      ? { code: text(level.code), name: String(level.name) }
      : null,
    duration: {
      min: pick('durationMin') == null ? null : String(pick('durationMin')),
      max: pick('durationMax') == null ? null : String(pick('durationMax')),
      unit: text(pick('durationUnit')),
    },
  };
}

function toRecord(row: AnyRecord): UniversityRecord {
  const extra = row as Record<string, unknown>;
  const country = extra.country as Record<string, unknown> | undefined;
  const campuses = extra.campuses as unknown[] | undefined;
  const offerings = (extra.offerings as Array<Record<string, unknown>>) ?? [];
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    shortDescription: text(row.shortDescription),
    overview: text(extra.overview),
    institutionType: text(extra.institutionType),
    qsRanking: whole(extra.qsRanking),
    totalStudents: whole(extra.totalStudents),
    internationalStudentsPercent: text(extra.internationalStudentsPercent),
    studentFacultyRatio: text(extra.studentFacultyRatio),
    establishedYear: whole(extra.establishedYear),
    campusSetting: text(extra.campusSetting),
    websiteUrl: text(extra.websiteUrl),
    admissionsEmail: text(extra.admissionsEmail),
    phone: text(extra.phone),
    statsSourceName: text(extra.statsSourceName),
    statsSourceUrl: text(extra.statsSourceUrl),
    statsYear: whole(extra.statsYear),
    sourceReference: text(extra.sourceReference),
    verifiedAt: text(extra.verifiedAt),
    campuses: Array.isArray(campuses) ? campuses.length : 0,
    country: country?.name
      ? {
          name: String(country.name),
          slug: String(country.slug ?? ''),
          iso2Code: text(country.iso2Code),
          officialLanguage: text(country.officialLanguage),
          currencyCode: text(country.currencyCode),
          currencySymbol: text(country.currencySymbol),
          intakeMonths: Array.isArray(country.intakeMonths)
            ? (country.intakeMonths as unknown[])
                .map((month) => Number(month))
                .filter((month) => Number.isInteger(month))
            : [],
          postStudyWorkPermitMonths: whole(country.postStudyWorkPermitMonths),
        }
      : null,
    offerings: offerings.map(toOffering),
  };
}

export default async function UniversityPage({ params }: Props) {
  const { slug } = await params;
  const row = await university(slug);
  if (!row) {
    const redirect = await phaseResolveRedirect(`/universities/${slug}`);
    if (redirect) permanentRedirect(redirect.targetPath);
    notFound();
  }
  const record = toRecord(row);

  /* Funding is a cross-link, not the point of the page: a failure here drops
     the section rather than the route. */
  const scholarships = await phaseList<AnyRecord>('scholarships', {
    university: record.slug,
    limit: '6',
  })
    .then((result) => toScholarshipCards(result.data))
    .catch(() => []);

  return (
    <>
      <UniversityGuide university={record} scholarships={scholarships} />

      <MatchBand
        heading={`Interested in ${record.name}?`}
        href={
          record.country
            ? `/courses?country=${record.country.slug}`
            : '/courses'
        }
      />

      <PlanBand
        heading="Not sure this is the right institution?"
        body="Tell us about your academic profile, goals and budget. We'll help you understand your options across every destination we cover."
        secondary={{ href: '/universities', label: 'Browse all universities' }}
      />

      <ConnectBand
        actions={[
          { href: '/universities', label: 'All universities' },
          { href: '/courses', label: 'Explore courses', ghost: true },
          { href: '/subjects', label: 'Browse subjects', ghost: true },
        ]}
        groups={[
          {
            title: 'Programmes',
            items: record.offerings.slice(0, 6).map((offering) => ({
              id: offering.id,
              name: offering.name,
              href: `/universities/${record.slug}/courses/${offering.slug}`,
            })),
          },
        ]}
      />
    </>
  );
}
