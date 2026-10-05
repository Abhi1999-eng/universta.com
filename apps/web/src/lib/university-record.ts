import type { AnyRecord } from '@/components/phase1/PhaseOneViews';
import type {
  NearbyUniversity,
  UniversityDestination,
  UniversityOffering,
  UniversityRecord,
} from '@/components/study-abroad/UniversityGuide';
import { editorialRenders } from '@/components/study-abroad/EditorialSection';
import type { CountryPage } from '@/lib/countries';
import { guideLinks } from '@/lib/study-abroad-view';

/**
 * A university's API record, read into the shape its page draws from.
 *
 * Kept out of the route file so the reading can be tested on its own: the
 * record is loose JSON, and every field it may lack is a field the page
 * must stand down on rather than print as "undefined".
 */

export const text = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value : null;
export const whole = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

/** The first campus city the record names: typed on the campus, or the
 * city it was picked from in the location lists. */
export function cityOf(campuses: unknown): string | null {
  if (!Array.isArray(campuses)) return null;
  for (const campus of campuses as Array<Record<string, unknown>>) {
    const ref = campus.cityRef as Record<string, unknown> | null | undefined;
    const city = text(campus.city) ?? text(ref?.name);
    if (city) return city;
  }
  return null;
}

/** An offering carries its own name, level and duration, and reaches the
 * subject through the generic course it is an instance of. */
export function toOffering(row: Record<string, unknown>): UniversityOffering {
  const generic = (row.genericCourse ?? {}) as Record<string, unknown>;
  const subject = generic.subject as Record<string, unknown> | undefined;
  const specialization = generic.subSubject as
    | Record<string, unknown>
    | undefined;
  /* The level an editor set on this university's course first, the generic
     course's otherwise: the rule the course list and the course's own page
     follow (effectiveLevel in the API), so all three call a course the same
     level and count the levels the same way. */
  const level = (row.courseLevel ?? generic.courseLevel) as
    | Record<string, unknown>
    | null
    | undefined;
  /* The offering's own figures where it has them, the generic course's
     otherwise: a university that has not stated its duration still teaches
     the programme the catalogue describes. */
  const pick = (key: string) => row[key] ?? generic[key];
  const intakes = Array.isArray(row.intakes)
    ? (row.intakes as Array<Record<string, unknown>>)
    : [];
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
      ? {
          code: text(level.code),
          name: String(level.name),
          /* The level's place in the client's order of levels (#241).
             Admin edits the display order; the education order is the one
             the catalogue was seeded with, and breaks a tie between two
             levels nobody has placed. */
          order:
            (whole(level.displayOrder) ?? 0) * 100 +
            (whole(level.educationOrder) ?? 0),
        }
      : null,
    duration: {
      min: pick('durationMin') == null ? null : String(pick('durationMin')),
      max: pick('durationMax') == null ? null : String(pick('durationMax')),
      unit: text(pick('durationUnit')),
    },
    studyMode: text(row.studyMode),
    tuition: row.tuitionMin
      ? {
          min: String(row.tuitionMin),
          max: row.tuitionMax == null ? null : String(row.tuitionMax),
          currencyCode: text(row.currencyCode),
          period: text(row.tuitionPeriod),
        }
      : null,
    intakes: intakes
      .map((entry) => {
        const intake = (entry.intake ?? {}) as Record<string, unknown>;
        const name = text(intake.shortLabel) ?? text(intake.name);
        return name
          ? {
              key: String(intake.id ?? name),
              name,
              month: whole(intake.startMonth),
              deadline: text(entry.deadline),
            }
          : null;
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null),
  };
}

export function toNearby(row: Record<string, unknown>): NearbyUniversity {
  const counts = row._count as { offerings?: number } | undefined;
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    institutionType: text(row.institutionType),
    qsRanking: whole(row.qsRanking),
    shortDescription: text(row.shortDescription),
    totalStudents: whole(row.totalStudents),
    internationalStudentsPercent:
      text(row.internationalStudentsPercent) ??
      whole(row.internationalStudentsPercent),
    city: cityOf(row.campuses),
    programmes: whole(counts?.offerings) ?? 0,
  };
}

export function toRecord(row: AnyRecord): UniversityRecord {
  const extra = row as Record<string, unknown>;
  const country = extra.country as Record<string, unknown> | undefined;
  const campuses = extra.campuses as unknown[] | undefined;
  const offerings = (extra.offerings as Array<Record<string, unknown>>) ?? [];
  const others = extra.otherUniversities as
    | { total?: number; data?: Array<Record<string, unknown>> }
    | undefined;
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
    city: cityOf(campuses),
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
    otherUniversities: (others?.data ?? []).map(toNearby),
    otherUniversityTotal: whole(others?.total) ?? 0,
  };
}

/**
 * The parts of the destination's guide a university's page links into,
 * each only when the guide renders it -- the same test the guide itself
 * uses to decide -- so no link lands on a section that is not there.
 */
export function toDestination(page: CountryPage | null): UniversityDestination | null {
  if (!page) return null;
  const base = `/study-abroad/${page.country.slug}`;
  const guide = guideLinks(page);
  const has = (key: string) => guide.find((link) => link.key === key);
  /* The visa route is an editorial section on the guide, written per
     country, and its anchor is the one the guide gives editorial sections. */
  const visa = (page.sections ?? []).find(
    (section) => section.sectionKey === 'visa-process' && editorialRenders(section),
  );
  const links = [
    visa
      ? { key: 'visa', label: 'Student visa', href: `${base}#country-visa-process` }
      : null,
    has('documents') ? { key: 'documents', label: 'Documents', href: `${base}#documents` } : null,
    has('language')
      ? { key: 'language', label: 'Language tests', href: `${base}#language` }
      : null,
    has('work-visa')
      ? { key: 'work-visa', label: 'Work after study', href: `${base}#work-visa` }
      : null,
  ].filter((link): link is { key: string; label: string; href: string } => Boolean(link));
  return {
    consultants: page.consultants,
    links,
    costHref: has('cost') ? `${base}#cost` : null,
  };
}
