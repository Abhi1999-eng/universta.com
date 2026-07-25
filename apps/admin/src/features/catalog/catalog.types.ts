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

export interface EditorialMedia {
  id: string;
  url: string;
  title: string | null;
  alt: string | null;
  width: number | null;
  height: number | null;
}
export interface EditorialSection {
  id: string;
  sectionKey: string;
  sectionType: string;
  eyebrow: string | null;
  heading: string | null;
  subheading: string | null;
  bodyJson: Record<string, unknown> | null;
  primaryMedia: EditorialMedia | null;
  secondaryMedia: EditorialMedia | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  configurationJson: Record<string, unknown> | null;
  displayOrder: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}
export interface EditorialFaq { id: string; question: string; answer: string; category: string | null; isFeatured: boolean; status: string; displayOrder: number; createdAt: string; updatedAt: string; }
export interface EditorialSeo { id: string; ownerType: string; ownerId: string; seoTitle: string; metaDescription: string; canonicalUrl: string | null; focusKeyword: string | null; ogTitle: string | null; ogDescription: string | null; ogMediaId: string | null; twitterTitle: string | null; twitterDescription: string | null; twitterMediaId: string | null; robotsIndex: boolean; robotsFollow: boolean; schemaJson: Record<string, unknown> | null; hreflangJson: Record<string, unknown> | null; ogMedia: EditorialMedia | null; twitterMedia: EditorialMedia | null; createdAt: string; updatedAt: string; }
export interface EditorialCard { id: string; title: string; slug: string; shortDescription: string; overview: string | null; iconMediaId: string | null; featuredMediaId: string | null; isFreeConsultation: boolean; ctaLabel: string; ctaUrl: string | null; status: string; isFeatured: boolean; displayOrder: number; publishedAt: string | null; createdAt?: string; updatedAt?: string; }
export interface CountryEditorialBundle { sections: EditorialSection[]; faqs: EditorialFaq[]; seo: EditorialSeo | null; consultantCards: EditorialCard[]; }
