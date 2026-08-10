import {
  PUBLIC_INTAKE_AVAILABILITY,
  type IntakeAvailability,
} from './profile.constants';

export interface ProfileCostRecord {
  id: string;
  countryId: string;
  currencyCode: string;
  currencySymbol: string | null;
  tuitionMin: unknown;
  tuitionMax: unknown;
  tuitionPeriod: string;
  tuitionNotes: string | null;
  livingCostMin: unknown;
  livingCostMax: unknown;
  livingCostPeriod: string;
  livingCostNotes: string | null;
  accommodationMin: unknown;
  accommodationMax: unknown;
  foodCostMin: unknown;
  foodCostMax: unknown;
  transportCostMin: unknown;
  transportCostMax: unknown;
  healthInsuranceCost: unknown;
  applicationFeeMin: unknown;
  applicationFeeMax: unknown;
  budgetBand: string | null;
  applicableYear: number | null;
  sourceReference: string | null;
  disclaimer: string | null;
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProfileWorkRecord {
  id: string;
  countryId: string;
  partTimeAllowed: boolean;
  partTimeHoursPerWeek: unknown;
  partTimeHoursDuringBreaks: unknown;
  partTimeSummary: string | null;
  postStudyWorkAvailable: boolean;
  postStudyWorkMinMonths: number | null;
  postStudyWorkMaxMonths: number | null;
  postStudyWorkSummary: string | null;
  immigrationPathwayStrength: string | null;
  immigrationPathwaySummary: string | null;
  visaSuccessBand: string;
  visaSuccessPercentage: unknown;
  visaInformation: string | null;
  visaProcessingTime: string | null;
  proofOfFundsSummary: string | null;
  sourceReference: string | null;
  disclaimer: string | null;
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProfileLanguageRecord {
  id: string;
  countryId: string;
  ieltsRequirement: string;
  ieltsMinScore: unknown;
  ieltsNotes: string | null;
  pteRequirement: string;
  pteMinScore: unknown;
  pteNotes: string | null;
  toeflRequirement: string;
  toeflMinScore: unknown;
  toeflNotes: string | null;
  duolingoRequirement: string;
  duolingoMinScore: unknown;
  duolingoNotes: string | null;
  languageWaiverAvailable: boolean;
  waiverNotes: string | null;
  generalNotes: string | null;
  sourceReference: string | null;
  disclaimer: string | null;
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProfileIntakeRecord {
  id: string;
  countryId: string;
  intakeId: string;
  isMajor: boolean;
  availabilityStatus: string;
  applicationOpeningMonth: number | null;
  applicationDeadlineMonth: number | null;
  applicationOpeningNote: string | null;
  applicationDeadlineNote: string | null;
  notes: string | null;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
  intake: {
    id: string;
    name: string;
    slug: string;
    startMonth: number | null;
    endMonth: number | null;
    seasonName: string | null;
    shortLabel: string | null;
    status: string;
  };
}

export interface ProfileStatisticsRecord {
  id: string;
  countryId: string;
  universitiesCount: number;
  publicUniversitiesCount: number;
  privateUniversitiesCount: number;
  coursesCount: number;
  ugCoursesCount: number;
  pgCoursesCount: number;
  pgdmCoursesCount: number;
  mbaCoursesCount: number;
  phdCoursesCount: number;
  scholarshipsCount: number;
  citiesCount: number;
  topRankedUniversitiesCount: number;
  internationalStudentsCount: number | null;
  studentSatisfactionPercentage: unknown;
  sourceMode: string;
  sourceReference: string | null;
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProfileBundle {
  costProfile: ProfileCostRecord | null;
  workProfile: ProfileWorkRecord | null;
  languageRequirements: ProfileLanguageRecord | null;
  intakes: ProfileIntakeRecord[];
  statistics: ProfileStatisticsRecord | null;
}

function decimal(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number')
    return (value as { toString: () => string }).toString();
  if (
    typeof value === 'object' &&
    'toString' in value &&
    typeof value.toString === 'function'
  )
    return (value as { toString: () => string }).toString();
  return null;
}

function verified(record: {
  sourceReference: string | null;
  verifiedAt: Date | null;
}): boolean {
  return Boolean(record.sourceReference && record.verifiedAt);
}

function date(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

export function serializeCost(
  record: ProfileCostRecord | null,
): Record<string, unknown> | null {
  if (!record) return null;
  return {
    ...record,
    tuitionMin: decimal(record.tuitionMin),
    tuitionMax: decimal(record.tuitionMax),
    livingCostMin: decimal(record.livingCostMin),
    livingCostMax: decimal(record.livingCostMax),
    accommodationMin: decimal(record.accommodationMin),
    accommodationMax: decimal(record.accommodationMax),
    foodCostMin: decimal(record.foodCostMin),
    foodCostMax: decimal(record.foodCostMax),
    transportCostMin: decimal(record.transportCostMin),
    transportCostMax: decimal(record.transportCostMax),
    healthInsuranceCost: decimal(record.healthInsuranceCost),
    applicationFeeMin: decimal(record.applicationFeeMin),
    applicationFeeMax: decimal(record.applicationFeeMax),
    verifiedAt: date(record.verifiedAt),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function serializeWork(
  record: ProfileWorkRecord | null,
): Record<string, unknown> | null {
  if (!record) return null;
  return {
    ...record,
    partTimeHoursPerWeek: decimal(record.partTimeHoursPerWeek),
    partTimeHoursDuringBreaks: decimal(record.partTimeHoursDuringBreaks),
    visaSuccessPercentage: decimal(record.visaSuccessPercentage),
    verifiedAt: date(record.verifiedAt),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function serializeLanguage(
  record: ProfileLanguageRecord | null,
): Record<string, unknown> | null {
  if (!record) return null;
  return {
    ...record,
    ieltsMinScore: decimal(record.ieltsMinScore),
    pteMinScore: decimal(record.pteMinScore),
    toeflMinScore: decimal(record.toeflMinScore),
    duolingoMinScore: decimal(record.duolingoMinScore),
    verifiedAt: date(record.verifiedAt),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function serializeStatistics(
  record: ProfileStatisticsRecord | null,
): Record<string, unknown> | null {
  if (!record) return null;
  return {
    ...record,
    studentSatisfactionPercentage: decimal(
      record.studentSatisfactionPercentage,
    ),
    verifiedAt: date(record.verifiedAt),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function serializeIntake(
  record: ProfileIntakeRecord,
): Record<string, unknown> {
  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function publicProfileSummary(bundle: ProfileBundle) {
  const cost =
    bundle.costProfile && verified(bundle.costProfile)
      ? {
          currencyCode: bundle.costProfile.currencyCode,
          currencySymbol: bundle.costProfile.currencySymbol,
          tuitionMin: decimal(bundle.costProfile.tuitionMin),
          tuitionMax: decimal(bundle.costProfile.tuitionMax),
          tuitionPeriod: bundle.costProfile.tuitionPeriod,
          budgetBand: bundle.costProfile.budgetBand,
        }
      : null;
  const work =
    bundle.workProfile && verified(bundle.workProfile)
      ? {
          partTimeAllowed: bundle.workProfile.partTimeAllowed,
          postStudyWorkAvailable: bundle.workProfile.postStudyWorkAvailable,
          postStudyWorkMinMonths: bundle.workProfile.postStudyWorkMinMonths,
          postStudyWorkMaxMonths: bundle.workProfile.postStudyWorkMaxMonths,
          immigrationPathwayStrength:
            bundle.workProfile.immigrationPathwayStrength,
          visaSuccessBand: bundle.workProfile.visaSuccessBand,
          visaSuccessPercentage: decimal(
            bundle.workProfile.visaSuccessPercentage,
          ),
        }
      : null;
  const language =
    bundle.languageRequirements && verified(bundle.languageRequirements)
      ? {
          ieltsRequirement: bundle.languageRequirements.ieltsRequirement,
          ieltsMinScore: decimal(bundle.languageRequirements.ieltsMinScore),
          languageWaiverAvailable:
            bundle.languageRequirements.languageWaiverAvailable,
        }
      : null;
  const intakes = bundle.intakes
    .filter(
      (item) =>
        item.intake.status === 'ACTIVE' &&
        (PUBLIC_INTAKE_AVAILABILITY as readonly string[]).includes(
          item.availabilityStatus,
        ),
    )
    .filter((item) => item.isMajor)
    .map((item) => ({
      id: item.intakeId,
      name: item.intake.name,
      slug: item.intake.slug,
      startMonth: item.intake.startMonth,
      endMonth: item.intake.endMonth,
      shortLabel: item.intake.shortLabel,
      availabilityStatus: item.availabilityStatus,
    }));
  const statistics =
    bundle.statistics && verified(bundle.statistics)
      ? {
          universitiesCount: bundle.statistics.universitiesCount,
          coursesCount: bundle.statistics.coursesCount,
          topRankedUniversitiesCount:
            bundle.statistics.topRankedUniversitiesCount,
        }
      : null;
  return { cost, work, language, intakes, statistics };
}

export function publicProfileDetail(bundle: ProfileBundle) {
  const summary = publicProfileSummary(bundle);
  const cost =
    bundle.costProfile && verified(bundle.costProfile)
      ? serializeCost(bundle.costProfile)
      : null;
  const work =
    bundle.workProfile && verified(bundle.workProfile)
      ? serializeWork(bundle.workProfile)
      : null;
  const language =
    bundle.languageRequirements && verified(bundle.languageRequirements)
      ? serializeLanguage(bundle.languageRequirements)
      : null;
  const intakes = bundle.intakes
    .filter(
      (item) =>
        item.intake.status === 'ACTIVE' &&
        (PUBLIC_INTAKE_AVAILABILITY as readonly string[]).includes(
          item.availabilityStatus,
        ),
    )
    .map(serializeIntake);
  const statistics =
    bundle.statistics && verified(bundle.statistics)
      ? serializeStatistics(bundle.statistics)
      : null;
  return { ...summary, cost, work, language, intakes, statistics };
}

export function publicProfileFilterValue(
  bundle: ProfileBundle,
  field: 'budgetBand' | 'visaSuccessBand' | 'pathwayStrength' | 'ieltsOptional',
) {
  const cost =
    bundle.costProfile && verified(bundle.costProfile)
      ? bundle.costProfile
      : null;
  const work =
    bundle.workProfile && verified(bundle.workProfile)
      ? bundle.workProfile
      : null;
  const language =
    bundle.languageRequirements && verified(bundle.languageRequirements)
      ? bundle.languageRequirements
      : null;
  if (field === 'budgetBand') return cost?.budgetBand ?? null;
  if (field === 'visaSuccessBand')
    return work?.visaSuccessBand && work.visaSuccessBand !== 'NOT_PUBLISHED'
      ? work.visaSuccessBand
      : null;
  if (field === 'pathwayStrength')
    return work?.immigrationPathwayStrength ?? null;
  return Boolean(
    language &&
    (language.ieltsRequirement === 'OPTIONAL' ||
      language.ieltsRequirement === 'NOT_REQUIRED' ||
      language.languageWaiverAvailable),
  );
}

export function isPublicIntakeStatus(
  status: string,
): status is IntakeAvailability {
  return (PUBLIC_INTAKE_AVAILABILITY as readonly string[]).includes(status);
}
