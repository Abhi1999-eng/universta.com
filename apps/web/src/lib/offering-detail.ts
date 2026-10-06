import { resolveContentVariables } from '../../../../packages/content-variables';
import { intakeRange } from './intake-range';
import type { ResolvedSeo } from './seo-management';
import {
  firstCity,
  humanise,
  toCountry,
  teachingLanguage,
  toOfferingCard,
  toOfferingCards,
  type CountryRef,
  type OfferingCardData,
} from './university-courses';

/**
 * One course at one university, as its page reads it.
 *
 * The API row reduced to what the page prints, with every gap left as a
 * gap: the page itself decides how to say "not listed". The overview's
 * content variables -- {{universityName}} and the like -- are resolved here,
 * on the server, which is why this lives apart from the card helpers the
 * browser also loads.
 */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

type Row = Record<string, unknown>;
const record = (value: unknown): Row | null =>
  value && typeof value === 'object' ? (value as Row) : null;
const text = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : null;
const whole = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

export type OfferingIntake = {
  label: string;
  /** ISO date, or null when the course records none. */
  deadline: string | null;
  /** The month the intake opens, when the intake says. */
  start: string | null;
  notes: string | null;
};

export type OfferingRequirement = {
  category: string;
  title: string;
  description: string | null;
  minimumScore: string | null;
};

export type OfferingDetail = {
  card: OfferingCardData;
  /** The name as published, university and all. */
  fullName: string;
  /** The generic course's slug, which counselling and funding are keyed by. */
  courseSlug: string | null;
  shortDescription: string | null;
  overview: string | null;
  careerSummary: string | null;
  currencyCode: string | null;
  tuitionPeriod: string | null;
  applicationUrl: string | null;
  sourceReference: string | null;
  verifiedAt: string | null;
  updatedAt: string | null;
  intakes: OfferingIntake[];
  requirements: OfferingRequirement[];
  university: {
    name: string;
    slug: string;
    websiteUrl: string | null;
    qsRanking: number | null;
    institutionType: string | null;
    country: CountryRef;
    city: string | null;
  };
  related: OfferingCardData[];
  elsewhere: OfferingCardData[];
  /** How many other universities' versions of the course there are in all;
   *  `elsewhere` holds the first six. */
  elsewhereTotal: number;
  more: { total: number; rows: OfferingCardData[] };
  seo: ResolvedSeo | null;
};

export function toOfferingDetail(raw: unknown): OfferingDetail | null {
  const row = record(raw);
  const universityRow = record(row?.university);
  const country = toCountry(universityRow?.country);
  const name = text(row?.name);
  if (!row || !universityRow || !country || !name) return null;
  const campus = record(row.campus);
  const university = {
    name: text(universityRow.name) ?? 'University',
    slug: text(universityRow.slug) ?? '',
    websiteUrl: text(universityRow.websiteUrl),
    qsRanking: whole(universityRow.qsRanking),
    institutionType: text(universityRow.institutionType),
    country,
    city: text(campus?.city) ?? firstCity(universityRow),
  };
  const owner = {
    name: university.name,
    slug: university.slug,
    country,
    city: university.city,
  };
  const card = toOfferingCard(row, owner);
  if (!card || !university.slug) return null;
  const generic = record(row.genericCourse) ?? {};
  const overview = text(row.overview);
  const more = record(row.moreAtUniversity);
  const elsewhere = toOfferingCards(row.elsewhere);
  return {
    card,
    fullName: name,
    courseSlug: text(generic.slug),
    shortDescription: text(row.shortDescription) ?? text(generic.shortDescription),
    overview: overview
      ? resolveContentVariables('offering', overview, row)
      : null,
    careerSummary: text(generic.careerSummary),
    currencyCode: text(row.currencyCode),
    tuitionPeriod: text(row.tuitionPeriod) ? humanise(String(row.tuitionPeriod)) : null,
    applicationUrl: text(row.applicationUrl),
    sourceReference: text(row.sourceReference),
    verifiedAt: text(row.verifiedAt),
    updatedAt: text(row.updatedAt),
    intakes: (Array.isArray(row.intakes) ? row.intakes : []).flatMap((entry) => {
      const intakeRow = record(entry);
      const intake = record(intakeRow?.intake);
      if (!intakeRow || !intake) return [];
      const month = whole(intake.startMonth);
      return [
        {
          label: intakeRange({
            startMonth: month,
            endMonth: whole(intake.endMonth),
            shortLabel: text(intake.shortLabel),
            name: text(intake.name),
          }),
          deadline: text(intakeRow.deadline)?.slice(0, 10) ?? null,
          start: month && MONTHS[month - 1] ? MONTHS[month - 1]! : null,
          notes: text(intakeRow.notes),
        },
      ];
    }),
    requirements: (Array.isArray(row.requirements) ? row.requirements : []).flatMap(
      (entry) => {
        const requirement = record(entry);
        const title = text(requirement?.title);
        if (!requirement || !title) return [];
        const score = requirement.minimumScore;
        return [
          {
            category: text(requirement.category) ?? 'OTHER',
            title,
            description: text(requirement.description),
            minimumScore:
              score === null || score === undefined || score === ''
                ? null
                : String(Number(score)),
          },
        ];
      },
    ),
    university,
    related: toOfferingCards(row.related),
    elsewhere,
    elsewhereTotal: Math.max(whole(row.elsewhereTotal) ?? 0, elsewhere.length),
    more: {
      total: whole(more?.total) ?? 0,
      rows: toOfferingCards(more?.rows, owner),
    },
    seo: (record(row.seo) as ResolvedSeo | null) ?? null,
  };
}

/** Requirements filed the way the design's admissions grid shows them. */
export function groupRequirements(requirements: OfferingRequirement[]) {
  const academic: OfferingRequirement[] = [];
  const language: OfferingRequirement[] = [];
  const other: OfferingRequirement[] = [];
  for (const requirement of requirements) {
    const category = requirement.category.toUpperCase();
    if (category === 'ACADEMIC') academic.push(requirement);
    else if (/ENGLISH|LANGUAGE/.test(category)) language.push(requirement);
    else other.push(requirement);
  }
  return { academic, language, other };
}

/* The language a course is taught in is read where its card is built, so
   the course page, its card and the comparison cannot disagree; the page
   keeps importing it from here. */
export { teachingLanguage };

/**
 * The course as a schema.org Course, built only from what the record holds.
 */
export function offeringJsonLd(
  detail: OfferingDetail,
  origin: string,
): Record<string, unknown> {
  const url = new URL(detail.card.href, origin).toString();
  const provider: Record<string, unknown> = {
    '@type': 'CollegeOrUniversity',
    name: detail.university.name,
    url: new URL(`/universities/${detail.university.slug}`, origin).toString(),
    address: {
      '@type': 'PostalAddress',
      ...(detail.university.city ? { addressLocality: detail.university.city } : {}),
      addressCountry: detail.university.country.iso2Code ?? detail.university.country.name,
    },
  };
  if (detail.university.websiteUrl) provider.sameAs = detail.university.websiteUrl;
  const description =
    detail.shortDescription ??
    `${detail.card.name} at ${detail.university.name}, ${detail.university.country.name}.`;
  const credential = detail.card.qualification ?? detail.card.level?.name;
  /* The language the page's "At a glance" panel names, and on the same
     evidence: an English test the course asks for. */
  const language = teachingLanguage(detail.requirements);
  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: detail.card.name,
    description,
    url,
    ...(detail.card.courseCode ? { courseCode: detail.card.courseCode } : {}),
    ...(language ? { inLanguage: 'en' } : {}),
    provider,
    ...(credential ? { educationalCredentialAwarded: credential } : {}),
    ...(detail.card.studyMode || detail.university.city
      ? {
          hasCourseInstance: {
            '@type': 'CourseInstance',
            ...(detail.card.studyMode ? { courseMode: detail.card.studyMode } : {}),
            ...(detail.university.city
              ? { location: { '@type': 'Place', name: detail.university.city } }
              : {}),
          },
        }
      : {}),
  };
}
