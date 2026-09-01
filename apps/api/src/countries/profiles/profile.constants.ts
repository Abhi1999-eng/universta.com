export const COST_PERIODS = [
  'PER_YEAR',
  'PER_MONTH',
  'PER_TERM',
  'ONE_TIME',
] as const;
export const BUDGET_BANDS = [
  'BUDGET_FRIENDLY',
  'MID_RANGE',
  'PREMIUM',
] as const;
export const PATHWAY_STRENGTHS = [
  'NOT_PUBLISHED',
  'LIMITED',
  'MODERATE',
  'STRONG',
] as const;
export const VISA_SUCCESS_BANDS = [
  'NOT_PUBLISHED',
  'LOW',
  'MEDIUM',
  'HIGH',
] as const;
export const LANGUAGE_REQUIREMENTS = [
  'REQUIRED',
  'OPTIONAL',
  'NOT_REQUIRED',
  'VARIES',
] as const;
export const INTAKE_AVAILABILITY = [
  'AVAILABLE',
  'LIMITED',
  'NOT_AVAILABLE',
  'NOT_PUBLISHED',
] as const;
export const STATISTICS_SOURCE_MODES = [
  'DERIVED',
  'MANUAL',
  'OFFICIAL',
  'IMPORTED',
] as const;

export const VERIFIED_PUBLIC = {
  sourceReference: { not: null },
  verifiedAt: { not: null },
} as const;
export const PUBLIC_INTAKE_AVAILABILITY = ['AVAILABLE', 'LIMITED'] as const;

export type CostPeriod = (typeof COST_PERIODS)[number];
export type BudgetBand = (typeof BUDGET_BANDS)[number];
export type PathwayStrength = (typeof PATHWAY_STRENGTHS)[number];
export type VisaSuccessBand = (typeof VISA_SUCCESS_BANDS)[number];
export type LanguageRequirement = (typeof LANGUAGE_REQUIREMENTS)[number];
export type IntakeAvailability = (typeof INTAKE_AVAILABILITY)[number];
export type StatisticsSourceMode = (typeof STATISTICS_SOURCE_MODES)[number];

export const PROFILE_AUDIT_ACTIONS = {
  costUpserted: 'COUNTRY_COST_PROFILE_UPSERTED',
  costDeleted: 'COUNTRY_COST_PROFILE_DELETED',
  workUpserted: 'COUNTRY_WORK_PROFILE_UPSERTED',
  workDeleted: 'COUNTRY_WORK_PROFILE_DELETED',
  languageUpserted: 'COUNTRY_LANGUAGE_PROFILE_UPSERTED',
  languageDeleted: 'COUNTRY_LANGUAGE_PROFILE_DELETED',
  intakesReplaced: 'COUNTRY_INTAKES_REPLACED',
  statisticsUpserted: 'COUNTRY_STATISTICS_UPSERTED',
  statisticsDeleted: 'COUNTRY_STATISTICS_DELETED',
} as const;
