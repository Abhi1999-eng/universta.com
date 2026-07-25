export const CONTINENT_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type ContinentStatus = (typeof CONTINENT_STATUSES)[number];

export const COUNTRY_STATUSES = ['DRAFT', 'PUBLISHED', 'DELETED'] as const;
export type CountryStatus = (typeof COUNTRY_STATUSES)[number];

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 12;
export const MAX_LIMIT = 100;
export const SUGGESTION_LIMIT = 5;
export const MAX_SUGGESTION_LIMIT = 10;

export const SUBJECT_STATUSES = ['DRAFT', 'PUBLISHED'] as const;
export type SubjectStatus = (typeof SUBJECT_STATUSES)[number];

export const MASTER_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type MasterStatus = (typeof MASTER_STATUSES)[number];

export const COURSE_STATUSES = ['DRAFT', 'PUBLISHED'] as const;
export const COURSE_MAPPING_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export const COURSE_AVAILABILITY_STATUSES = [
  'AVAILABLE',
  'LIMITED',
  'UNAVAILABLE',
] as const;
export const COURSE_INTAKE_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export const COURSE_TUITION_PERIODS = [
  'PER_YEAR',
  'PER_SEMESTER',
  'PER_MONTH',
  'TOTAL',
] as const;
export const COURSE_DURATION_UNITS = ['MONTHS', 'YEARS'] as const;
export const COURSE_RELATIONSHIP_TYPES = [
  'RELATED',
  'ALTERNATIVE',
  'PROGRESSION',
] as const;
export const COURSE_SECTION_TYPES = [
  'RICH_TEXT',
  'FACT_GRID',
  'CARD_GRID',
  'STEPS',
  'CHECKLIST',
  'CTA',
  'MEDIA',
] as const;
export const COURSE_SECTION_KEYS = [
  'curriculum',
  'skills',
  'admission-requirements',
  'documents',
  'career-outcomes',
  'application-process',
  'source-trust',
  'counselling-cta',
] as const;
export const SEO_OWNER_TYPES = ['SUBJECT', 'COURSE'] as const;

export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export function paginationMeta(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

export function normalizeOptionalText(
  value: string | null | undefined,
): string | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }
  return value.trim();
}

export function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === 'object' &&
    (error as { code?: unknown }).code === 'P2002',
  );
}
