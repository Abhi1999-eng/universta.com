export interface PaginationMeta { page: number; limit: number; total: number; totalPages: number; }
export interface Envelope<T> { data: T | null; meta: unknown; error: { code: string; message: string; details: unknown } | null; requestId: string; timestamp: string; }
export interface Flag { url: string; alt: string; }
export interface Country { id: string; name: string; slug: string; pageHeading: string; shortDescription: string; continent: { id: string; name: string; slug: string }; flag: Flag | null; featured: boolean; displayOrder: number; statistics: { universitiesCount: number | null } | null; profiles?: ProfileSummary; }
export interface ProfileSummary {
  cost: {
    currencyCode: string; currencySymbol: string | null; tuitionMin: string | null;
    tuitionMax: string | null; tuitionPeriod: string; budgetBand: string | null;
    tuitionNotes?: string | null;
    livingCostMin?: string | null; livingCostMax?: string | null;
    livingCostPeriod?: string; livingCostNotes?: string | null;
    accommodationMin?: string | null; accommodationMax?: string | null;
    foodCostMin?: string | null; foodCostMax?: string | null;
    transportCostMin?: string | null; transportCostMax?: string | null;
    healthInsuranceCost?: string | null; applicationFeeMin?: string | null;
    applicationFeeMax?: string | null; sourceReference?: string | null;
    disclaimer?: string | null; verifiedAt?: string | null;
  } | null;
  work: {
    partTimeAllowed?: boolean; postStudyWorkAvailable: boolean;
    postStudyWorkMinMonths: number | null; postStudyWorkMaxMonths: number | null;
    immigrationPathwayStrength: string | null; visaSuccessBand: string;
    partTimeSummary?: string | null; postStudyWorkSummary?: string | null;
    immigrationPathwaySummary?: string | null; visaInformation?: string | null;
    visaProcessingTime?: string | null; proofOfFundsSummary?: string | null;
    partTimeHoursPerWeek?: string | null; partTimeHoursDuringBreaks?: string | null;
    visaSuccessPercentage?: string | null; sourceReference?: string | null;
    disclaimer?: string | null; verifiedAt?: string | null;
  } | null;
  language: {
    ieltsRequirement: string; languageWaiverAvailable: boolean;
    ieltsMinScore?: string | null; ieltsNotes?: string | null;
    pteRequirement?: string; pteMinScore?: string | null; pteNotes?: string | null;
    toeflRequirement?: string; toeflMinScore?: string | null; toeflNotes?: string | null;
    duolingoRequirement?: string; duolingoMinScore?: string | null; duolingoNotes?: string | null;
    waiverNotes?: string | null; generalNotes?: string | null;
    sourceReference?: string | null; disclaimer?: string | null; verifiedAt?: string | null;
  } | null;
  intakes: Array<{
    id: string;
    name: string;
    slug: string;
    shortLabel: string | null;
    startMonth?: number | null;
    endMonth?: number | null;
    availabilityStatus: string;
    applicationOpeningNote?: string | null;
    applicationDeadlineNote?: string | null;
    notes?: string | null;
    intake?: {
      id: string;
      name: string;
      slug: string;
      shortLabel: string | null;
      startMonth?: number | null;
      endMonth?: number | null;
    };
  }>;
  statistics: { universitiesCount: number; publicUniversitiesCount?: number; privateUniversitiesCount?: number; coursesCount: number; ugCoursesCount?: number; pgCoursesCount?: number; pgdmCoursesCount?: number; mbaCoursesCount?: number; phdCoursesCount?: number; topRankedUniversitiesCount: number; citiesCount?: number; scholarshipsCount?: number; internationalStudentsCount?: number | null; studentSatisfactionPercentage?: string | null; sourceReference?: string | null; verifiedAt?: string | null } | null;
}
export interface Media { id: string; url: string; title: string | null; alt: string | null; width: number | null; height: number | null; }
export interface Section { id: string; sectionKey: string; sectionType: string; eyebrow: string | null; heading: string | null; subheading: string | null; bodyJson: Record<string, unknown> | null; primaryMedia: Media | null; secondaryMedia: Media | null; ctaLabel: string | null; ctaUrl: string | null; configurationJson: Record<string, unknown> | null; displayOrder: number; status: string; createdAt: string; updatedAt: string; }
export interface Faq { id: string; question: string; answer: string; category: string | null; isFeatured: boolean; status: string; displayOrder: number; createdAt: string; updatedAt: string; }
export interface Seo { seoTitle: string; metaDescription: string; canonicalUrl: string | null; ogTitle: string | null; ogDescription: string | null; ogMedia: Media | null; twitterTitle: string | null; twitterDescription: string | null; twitterMedia: Media | null; robotsIndex: boolean; robotsFollow: boolean; schemaJson: Record<string, unknown> | null; hreflangJson: Record<string, unknown> | null; }
export interface ConsultantCard { id: string; title: string; slug: string; shortDescription: string; overview: string | null; iconMediaId: string | null; featuredMediaId: string | null; iconMedia?: Media | null; featuredMedia?: Media | null; isFreeConsultation: boolean; ctaLabel: string; ctaUrl: string | null; status: string; isFeatured: boolean; displayOrder: number; publishedAt: string | null; }
export interface CountryPage { country: Country; profiles: ProfileSummary; sections: Section[]; faqs: Faq[]; seo: Seo | null; consultantCards: ConsultantCard[]; }
export interface DirectoryRecord { name: string; slug: string; flag: Flag | null; shortDescription: string; programCounts: { ug: number | null; pg: number | null; pgdm: number | null; mba: number | null }; letter: string; isAvailable: boolean; profiles?: ProfileSummary; }
export interface CountryListResult { data: Country[]; meta: PaginationMeta; }
export interface DirectoryResult { data: DirectoryRecord[]; meta: PaginationMeta; }

const baseUrl = process.env.API_BASE_URL ?? 'http://127.0.0.1:4000';
async function api<T>(path: string): Promise<T> { const response = await fetch(new URL(`/api/v1${path}`, baseUrl), { cache: 'no-store', headers: { accept: 'application/json' } }); const body = await response.json() as Envelope<T>; if (!response.ok || body.error || body.data === null) throw new Error(body.error?.message ?? 'Country service unavailable'); return body.data; }
async function apiResult<T>(path: string): Promise<{ data: T; meta: PaginationMeta }> { const response = await fetch(new URL(`/api/v1${path}`, baseUrl), { cache: 'no-store', headers: { accept: 'application/json' } }); const body = await response.json() as Envelope<T>; if (!response.ok || body.error || body.data === null) throw new Error(body.error?.message ?? 'Country service unavailable'); return { data: body.data, meta: (body.meta ?? { page: 1, limit: 100, total: Array.isArray(body.data) ? body.data.length : 0, totalPages: 1 }) as PaginationMeta }; }
export function getCountries(params: Record<string, string> = {}) { const query = new URLSearchParams(params).toString(); return apiResult<Country[]>(`/countries${query ? `?${query}` : ''}`); }
export function getDirectory(params: Record<string, string> = {}) { const query = new URLSearchParams(params).toString(); return apiResult<DirectoryRecord[]>(`/countries/directory${query ? `?${query}` : ''}`); }
export function getContinents() { return api<Array<{ id: string; name: string; slug: string; status: string }>>('/continents?limit=100'); }
export function getCountryPage(slug: string) { return api<CountryPage>(`/countries/${encodeURIComponent(slug)}/page`); }
export function getSuggestions(query: string) { return api<Country[]>(`/countries/suggestions?q=${encodeURIComponent(query)}&limit=5`); }
