export interface CatalogError {
  code: string;
  message: string;
  details: unknown;
}

export interface CatalogEnvelope<T> {
  data: T | null;
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  } | null;
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

/** Why a continent delete was refused: what is still pointing at it. */
export interface ContinentDependency {
  countriesCount: number;
  countries: Array<{ id: string; name: string; slug: string; status: string }>;
}

export interface FlagRecord {
  url: string;
  alt: string;
}

export interface CountryRecord {
  id: string;
  name: string;
  slug: string;
  pageHeading: string | null;
  shortDescription: string | null;
  overview?: string | null;
  tagline?: string | null;
  capitalCity?: string | null;
  officialLanguage?: string | null;
  /* Optional since Country became a CMS record: a country can be saved, and
   * published, with nothing but a name. */
  continent: { id: string; name: string; slug: string } | null;
  flag: FlagRecord | null;
  featured: boolean;
  displayOrder: number;
  statistics: { universitiesCount: number | null } | null;
  iso2Code?: string | null;
  iso3Code?: string | null;
  externalUid?: string | null;
  currency?: { code: string; symbol: string | null } | null;
  /* The raw editable values behind `currency` and `flag`; the editor reloads
   * from these, so leaving them out silently blanks them on the next save. */
  currencyName?: string | null;
  flagMediaId?: string | null;
  listingMediaId?: string | null;
  heroMediaId?: string | null;
  configuration?: {
    features: Array<{ code: string; label: string }>;
    acceptedTests: Array<{ code: string; label: string }>;
    intakeMonths: number[];
    postStudyWorkPermitMonths: number | null;
    /** The budget calculator document, or null when none is configured. */
    calculator: Record<string, unknown> | null;
    /** The study levels typed for this destination, in order. */
    studyPaths?: Array<{
      name: string;
      duration: string | null;
      entry: string | null;
      summary: string | null;
    }>;
  };
  /** What a student needs in hand to study here, in the order the Admin put
   * them. Empty when none are listed. */
  documents?: Array<{
    id: string;
    name: string;
    details: string | null;
    isRequired: boolean;
  }>;
  popularUniversityIds?: string[];
  popularCourseIds?: string[];
  subjectIds?: string[];
  subSubjectIds?: string[];
  tagIds?: string[];
  subjects?: Array<{ id: string; name: string; slug: string }>;
  tags?: Array<{ id: string; name: string; slug: string }>;
  linkedCounts?: { universities: number; courses: number; scholarships: number };
  status?: string;
  publishedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  profiles?: CountryProfileSummary;
}

export interface CountryCurationOptions {
  universities: Array<{
    id: string;
    name: string;
    slug: string;
    qsRanking: number | null;
  }>;
  courses: Array<{ id: string; name: string; slug: string }>;
}

export interface CountryProfileSummary {
  cost: Record<string, unknown> | null;
  work: Record<string, unknown> | null;
  language: Record<string, unknown> | null;
  intakes: Array<Record<string, unknown>>;
  statistics: Record<string, unknown> | null;
}

export interface CountryProfileBundle {
  country: {
    id: string;
    name: string;
    slug: string;
    status: string;
    updatedAt: string;
  };
  /** Live count of published universities, so the editor can say what the
   * public page shows when the stored statistics do not qualify. */
  derivedUniversitiesCount?: number;
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
  startMonth: number | null;
  endMonth: number | null;
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
  programCounts: {
    ug: number | null;
    pg: number | null;
    pgdm: number | null;
    mba: number | null;
  };
  letter: string;
  isAvailable: boolean;
}

export interface SuggestionRecord {
  id: string;
  name: string;
  slug: string;
  flag: FlagRecord | null;
  /* Optional since Country became a CMS record: a country can be saved, and
   * published, with nothing but a name. */
  continent: { id: string; name: string; slug: string } | null;
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
  subjectId?: string;
  tagId?: string;
  status?: string;
  featured?: boolean;
  sort?: string;
  page?: number;
  limit?: number;
}

export interface CountryTagRecord {
  id: string;
  name: string;
  slug: string;
  status: string;
  description?: string | null;
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
export interface EditorialFaq {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  isFeatured: boolean;
  status: string;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}
export interface EditorialSeo {
  id: string;
  ownerType: string;
  ownerId: string;
  /** Null on a row that only sets the robots ticks. */
  seoTitle: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  focusKeyword: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogMediaId: string | null;
  twitterTitle: string | null;
  twitterDescription: string | null;
  twitterMediaId: string | null;
  robotsIndex: boolean;
  robotsFollow: boolean;
  schemaJson: Record<string, unknown> | null;
  hreflangJson: Record<string, unknown> | null;
  ogMedia: EditorialMedia | null;
  twitterMedia: EditorialMedia | null;
  createdAt: string;
  updatedAt: string;
}
export interface EditorialCard {
  id: string;
  title: string;
  slug: string;
  shortDescription: string;
  overview: string | null;
  iconMediaId: string | null;
  featuredMediaId: string | null;
  isFreeConsultation: boolean;
  ctaLabel: string;
  ctaUrl: string | null;
  status: string;
  isFeatured: boolean;
  displayOrder: number;
  publishedAt: string | null;
  createdAt?: string;
  updatedAt?: string;
}
export interface CountryEditorialBundle {
  sections: EditorialSection[];
  faqs: EditorialFaq[];
  seo: EditorialSeo | null;
  consultantCards: EditorialCard[];
}
export interface SubjectRecord {
  id: string;
  name: string;
  slug: string;
  /** Shown beneath the parent for navigation; the Country taxonomy itself is
   * assigned at Subject level only. */
  subSubjects?: Array<{ id: string; name: string; slug: string; status: string }>;
  /** Real usage, used to order the picker's "Most used" view. */
  courseCount?: number;
  countryCount?: number;
  shortDescription: string | null;
  overview: string | null;
  iconMedia: EditorialMedia | null;
  listingMedia: EditorialMedia | null;
  heroMedia: EditorialMedia | null;
  isFeatured: boolean;
  displayOrder: number;
  /** The study levels an editor ticked for it. */
  courseLevels?: CatalogLevel[];
  /** The levels its published courses already stand at, for the editor to
   * show beside the ticks. Only on a single record, not a list. */
  impliedCourseLevels?: CatalogLevel[];
  /** The levels the site offers it at: its own ticks, its published
   * specializations' ticks and its published courses' levels, active ones
   * only, in education order. On the admin list rows. */
  offeredLevels?: OfferedLevel[];
  status: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
/** A destination a subject or a specialization is listed for, and why. */
export interface TaxonomyCountryLink {
  country: { id: string; name: string; slug: string; status: string };
  /** EDITORIAL: an editor ticked it. DERIVED: a published course is taught there, so it stays listed. */
  source: 'EDITORIAL' | 'DERIVED';
}
export interface CatalogLevel {
  id: string;
  name: string;
  code: string | null;
}
/** A level a subject or a specialization is offered at, as the list rows
 * carry it. */
export interface OfferedLevel {
  id: string;
  code: string;
  name: string;
}
export interface SubSubjectRecord {
  id: string;
  /** `status` comes on the admin rows, so the list can tell a specialization
   * whose subject is still a draft -- its page is not on the site yet. */
  subject: { id: string; name: string; slug: string; status?: string };
  name: string;
  slug: string;
  shortDescription: string | null;
  overview: string | null;
  iconMedia: EditorialMedia | null;
  listingMedia: EditorialMedia | null;
  featured: boolean;
  displayOrder: number;
  courseLevels?: CatalogLevel[];
  impliedCourseLevels?: CatalogLevel[];
  /** Its own ticks and its published courses' levels, active ones only, in
   * education order. On the admin list rows. */
  offeredLevels?: OfferedLevel[];
  status: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/* A subject's or a specialization's page at one study level, such as
   /subjects/computing/masters. The page lists its programmes on its own; what
   an editor writes here adds an intro, notes, FAQs and SEO of its own. Which
   levels get a page is the API's call (its ticks, its published
   specializations' ticks, its published courses), never the admin's. */
export type LevelPageOwner = 'subject' | 'specialization';
/** Why a level is offered: ticked on this record, ticked on a published
 * specialization of the subject, or a published course stands at it. */
export type LevelSource = 'TICKED' | 'SPECIALIZATION' | 'COURSES';
export type LevelPageStatus = 'DRAFT' | 'PUBLISHED';
export interface LevelRef {
  id: string;
  code: string;
  name: string;
  /** The level's part of the page address: `masters`, `bachelors`. */
  slug: string;
  description: string | null;
  status: string;
}
export interface LevelPageRow {
  level: LevelRef;
  /** False for a page kept from before its level stopped being offered here;
   * it is off the site, and listed so its content can still be deleted. */
  offered: boolean;
  /** Empty when the level is not offered. */
  sources: LevelSource[];
  /** The public address, e.g. /subjects/computing/ai/masters. */
  path: string;
  page: null | {
    id: string;
    status: LevelPageStatus;
    hasIntro: boolean;
    hasAdmissionNote: boolean;
    hasCareersNote: boolean;
    /** Active FAQs only. */
    faqCount: number;
    hasSeo: boolean;
    /** Published, with an intro and enough active FAQs to be indexed before
     * the page lists any programmes. Decided by the API. */
    searchReady: boolean;
    updatedAt: string;
  };
}
export interface LevelPageDetail {
  subject: { id: string; name: string; slug: string; status: string };
  specialization: { id: string; name: string; slug: string; status: string } | null;
  level: LevelRef;
  offered: boolean;
  sources: LevelSource[];
  path: string;
  page: null | {
    id: string;
    status: LevelPageStatus;
    intro: string | null;
    admissionNote: string | null;
    careersNote: string | null;
    /** The same shape a course's FAQs take, so the shared FAQ card reads
     * them as they are. Their ids change on every save: the list is
     * replaced whole. */
    faqs: CourseFaqRecord[];
    seo: EditorialSeo | null;
    searchReady: boolean;
    createdAt: string;
    updatedAt: string;
  };
}
/** Where a study level is used, as the admin's levels list reports it. */
export interface LevelUsage {
  subjects: number;
  specializations: number;
  courses: number;
  programmes: number;
  /** Level pages an editor has written copy for (draft or live). */
  levelPages: number;
}
export interface MasterRecord {
  id: string;
  code: string;
  name: string;
  description: string | null;
  educationOrder?: number;
  displayOrder: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  /** A study level's address on its level pages: PG -> "masters". */
  slug?: string;
  usage?: LevelUsage;
}
export interface CourseRecord {
  id: string;
  subject: { id: string; name: string; slug: string; status: string };
  subSubject: { id: string; name: string; slug: string; status: string } | null;
  courseLevel: { id: string; name: string; code: string; status: string };
  name: string;
  shortName: string | null;
  qualificationName: string | null;
  slug: string;
  courseCode: string | null;
  shortDescription: string | null;
  overview: string | null;
  durationMin: string | null;
  durationMax: string | null;
  durationUnit: string | null;
  credits: string | null;
  featuredMedia: EditorialMedia | null;
  careerSummary: string | null;
  featured: boolean;
  popularityScore: string | null;
  displayOrder: number;
  status: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  studyModes: MasterRecord[];
  countries: Array<Record<string, unknown>>;
  contentSections: Array<Record<string, unknown>>;
  faqs: Array<Record<string, unknown>>;
  relatedCourses: Array<Record<string, unknown>>;
}
export interface CourseMappingRecord {
  id: string;
  country: { id: string; name: string; slug: string; status?: string };
  availabilityStatus: string;
  indicativeTuitionMin: string | null;
  indicativeTuitionMax: string | null;
  currencyCode: string | null;
  tuitionPeriod: string;
  applicationFeeMin: string | null;
  applicationFeeMax: string | null;
  durationMinOverride: string | null;
  durationMaxOverride: string | null;
  durationUnitOverride: string | null;
  academicMinPercentage: string | null;
  academicMinCgpa: string | null;
  ieltsMinScore: string | null;
  pteMinScore: string | null;
  toeflMinScore: string | null;
  duolingoMinScore: string | null;
  workExperienceMonths: number | null;
  scholarshipAvailable: boolean;
  admissionRequirements: string | null;
  englishRequirements: string | null;
  applicationNotes: string | null;
  careerOpportunities: string | null;
  sourceReference: string | null;
  verifiedAt: string | null;
  status: string;
  isFeatured: boolean;
  displayOrder: number;
  updatedAt: string;
  intakes: Array<Record<string, unknown>>;
}
export interface CourseSectionRecord {
  id: string;
  sectionKey: string;
  sectionType: string;
  heading: string | null;
  subheading: string | null;
  bodyJson: Record<string, unknown> | null;
  media: EditorialMedia | null;
  displayOrder: number;
  status: string;
  updatedAt: string;
}
export interface CourseFaqRecord {
  id: string;
  question: string;
  answer: string;
  displayOrder: number;
  status: string;
  updatedAt: string;
}
export interface CourseRelatedRecord {
  id: string;
  relatedCourse: { id: string; name: string; slug: string };
  relationshipType: string;
  displayOrder: number;
}
