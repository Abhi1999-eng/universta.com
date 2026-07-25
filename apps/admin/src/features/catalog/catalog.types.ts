export interface CatalogError {
  code: string;
  message: string;
  details: unknown;
}

export interface CatalogEnvelope<T> {
  data: T | null;
  meta: { page: number; limit: number; total: number; totalPages: number } | null;
  error: CatalogError | null;
  requestId: string;
  timestamp: string;
}

export interface ContinentRecord {
  id: string;
  name: string;
  slug: string;
  code: string | null;
  description: string | null;
  displayOrder: number;
  countriesCount: number;
  status: string;
  isFeatured?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface FlagRecord {
  url: string;
  alt: string;
}

export interface CountryRecord {
  id: string;
  name: string;
  slug: string;
  pageHeading: string;
  shortDescription: string;
  continent: { id: string; name: string; slug: string };
  flag: FlagRecord | null;
  featured: boolean;
  displayOrder: number;
  statistics: { universitiesCount: number | null } | null;
  iso2Code?: string | null;
  iso3Code?: string | null;
  status?: string;
  publishedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  profiles?: CountryProfileSummary;
}

export interface CountryProfileSummary {
  cost: Record<string, unknown> | null;
  work: Record<string, unknown> | null;
  language: Record<string, unknown> | null;
  intakes: Array<Record<string, unknown>>;
  statistics: Record<string, unknown> | null;
}

export interface CountryProfileBundle {
  country: { id: string; name: string; slug: string; status: string; updatedAt: string };
  cost: Record<string, unknown> | null;
  work: Record<string, unknown> | null;
  language: Record<string, unknown> | null;
  intakes: Array<Record<string, unknown>>;
  statistics: Record<string, unknown> | null;
}

export interface IntakeOption {
  id: string;
  name: string;
  slug: string;
  monthNumber: number | null;
  seasonName: string | null;
  shortLabel: string | null;
  description: string | null;
  displayOrder: number;
}

export interface DirectoryRecord {
  name: string;
  slug: string;
  flag: FlagRecord | null;
  shortDescription: string;
  programCounts: { ug: number | null; pg: number | null; pgdm: number | null; mba: number | null };
  letter: string;
  isAvailable: boolean;
}

export interface SuggestionRecord {
  id: string;
  name: string;
  slug: string;
  flag: FlagRecord | null;
  continent: { id: string; name: string; slug: string };
  universitiesCount: number | null;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CatalogListParams {
  q?: string;
  continent?: string;
  continentId?: string;
  status?: string;
  featured?: boolean;
  sort?: string;
  page?: number;
  limit?: number;
}

export interface CatalogMutationError extends Error {
  code: string;
  status: number;
  details: unknown;
}
