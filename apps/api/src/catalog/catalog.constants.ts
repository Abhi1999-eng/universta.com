export const CONTINENT_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type ContinentStatus = (typeof CONTINENT_STATUSES)[number];

export const COUNTRY_STATUSES = ['DRAFT', 'PUBLISHED', 'DELETED'] as const;
export type CountryStatus = (typeof COUNTRY_STATUSES)[number];

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 12;
export const MAX_LIMIT = 100;
export const SUGGESTION_LIMIT = 5;
export const MAX_SUGGESTION_LIMIT = 10;

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
