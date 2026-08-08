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
  subject?: string;
  subSubject?: string;
  level?: string;
  country?: string;
  studyMode?: string;
  intake?: string;
  scholarshipAvailable?: boolean;
  minTuition?: string;
  maxTuition?: string;
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
export interface SubjectRecord { id: string; name: string; slug: string; shortDescription: string | null; overview: string | null; iconMedia: EditorialMedia | null; listingMedia: EditorialMedia | null; heroMedia: EditorialMedia | null; isFeatured: boolean; displayOrder: number; status: string; publishedAt: string | null; createdAt: string; updatedAt: string; }
export interface SubSubjectRecord { id: string; subject: { id: string; name: string; slug: string }; name: string; slug: string; shortDescription: string | null; overview: string | null; iconMedia: EditorialMedia | null; listingMedia: EditorialMedia | null; featured: boolean; displayOrder: number; status: string; publishedAt: string | null; createdAt: string; updatedAt: string; }
export interface MasterRecord { id: string; code: string; name: string; description: string | null; educationOrder?: number; displayOrder: number; status: string; createdAt: string; updatedAt: string; }
export interface CourseRecord { id: string; subject: { id: string; name: string; slug: string; status: string }; subSubject: { id: string; name: string; slug: string; status: string } | null; courseLevel: { id: string; name: string; code: string; status: string }; name: string; shortName: string | null; qualificationName: string | null; slug: string; courseCode: string | null; shortDescription: string | null; overview: string | null; durationMin: string | null; durationMax: string | null; durationUnit: string | null; credits: string | null; featuredMedia: EditorialMedia | null; careerSummary: string | null; featured: boolean; popularityScore: string | null; displayOrder: number; status: string; publishedAt: string | null; createdAt: string; updatedAt: string; studyModes: MasterRecord[]; countries: Array<Record<string, unknown>>; contentSections: Array<Record<string, unknown>>; faqs: Array<Record<string, unknown>>; relatedCourses: Array<Record<string, unknown>>; }
export interface CourseMappingRecord { id: string; country: { id: string; name: string; slug: string; status?: string }; availabilityStatus: string; indicativeTuitionMin: string | null; indicativeTuitionMax: string | null; currencyCode: string | null; tuitionPeriod: string; applicationFeeMin: string | null; applicationFeeMax: string | null; durationMinOverride: string | null; durationMaxOverride: string | null; durationUnitOverride: string | null; academicMinPercentage: string | null; academicMinCgpa: string | null; ieltsMinScore: string | null; pteMinScore: string | null; toeflMinScore: string | null; duolingoMinScore: string | null; workExperienceMonths: number | null; scholarshipAvailable: boolean; admissionRequirements: string | null; englishRequirements: string | null; applicationNotes: string | null; careerOpportunities: string | null; sourceReference: string | null; verifiedAt: string | null; status: string; isFeatured: boolean; displayOrder: number; updatedAt: string; intakes: Array<Record<string, unknown>>; }
export interface CourseSectionRecord { id: string; sectionKey: string; sectionType: string; heading: string | null; subheading: string | null; bodyJson: Record<string, unknown> | null; media: EditorialMedia | null; displayOrder: number; status: string; updatedAt: string; }
export interface CourseFaqRecord { id: string; question: string; answer: string; displayOrder: number; status: string; updatedAt: string; }
export interface CourseRelatedRecord { id: string; relatedCourse: { id: string; name: string; slug: string }; relationshipType: string; displayOrder: number; }
