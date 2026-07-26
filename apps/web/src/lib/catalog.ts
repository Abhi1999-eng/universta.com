export interface PageMeta { page: number; limit: number; total: number; totalPages: number; }
export interface Envelope<T> { data: T | null; meta: unknown; error: { code: string; message: string; details: unknown } | null; requestId: string; timestamp: string; }
const baseUrl = process.env.API_BASE_URL ?? 'http://127.0.0.1:4000';
async function request<T>(path: string): Promise<{ data: T; meta: PageMeta }> { const response = await fetch(new URL(`/api/v1${path}`, baseUrl), { cache: 'no-store', headers: { accept: 'application/json' } }); const body = await response.json() as Envelope<T>; if (!response.ok || body.error || body.data === null) throw new Error(body.error?.message ?? 'Catalog service unavailable'); return { data: body.data, meta: (body.meta ?? { page: 1, limit: 100, total: Array.isArray(body.data) ? body.data.length : 0, totalPages: 1 }) as PageMeta }; }
export interface Media { id: string; url: string; alt: string | null; title: string | null; width: number | null; height: number | null; }
export interface Subject { id: string; name: string; slug: string; shortDescription: string | null; overview: string | null; iconMedia: Media | null; listingMedia: Media | null; heroMedia: Media | null; featured: boolean; displayOrder: number; publishedCourseCount: number; publishedSubSubjectCount: number; availableCountryCount: number; }
export interface SubSubject { id: string; name: string; slug: string; shortDescription: string | null; overview: string | null; iconMedia: Media | null; listingMedia: Media | null; featured: boolean; displayOrder: number; }
export interface SubjectDetail extends Subject { subSubjects: SubSubject[]; courseCountsByLevel: Array<{ level: { id: string; name: string; code: string | null }; count: number }>; featuredCourses: Course[]; seo: Seo | null; }
export interface Seo { seoTitle: string; metaDescription: string; canonicalUrl: string | null; ogTitle: string | null; ogDescription: string | null; ogMedia: Media | null; twitterTitle: string | null; twitterDescription: string | null; robotsIndex: boolean; robotsFollow: boolean; schemaJson: Record<string, unknown> | null; }
export interface Course { id: string; name: string; slug: string; shortName: string | null; qualificationName: string | null; shortDescription: string | null; subject: { id: string; name: string; slug: string; }; subSubject: { id: string; name: string; slug: string } | null; courseLevel: { id: string; name: string; code: string; }; studyModes: Array<{ id: string; name: string; code: string }>; duration: { min: string | null; max: string | null; unit: string | null }; credits: string | null; featuredMedia: Media | null; featured: boolean; availableCountryCount: number; selectedCountry: { id: string; name: string; slug: string } | null; selectedTuition: { min: string | null; max: string | null; currencyCode: string | null; period: string } | null; selectedIntakes: Array<{ intake?: { id: string; name: string; slug: string; shortLabel: string | null }; applicationDeadline: string | null; deadlineNotes: string | null; status: string }>; scholarshipAvailable: boolean | null; displayOrder: number; }
export interface CourseDetail extends Course { overview: string | null; careerSummary: string | null; availability: Array<Record<string, unknown>>; selectedCountry: { id: string; name: string; slug: string } | null; contentSections: Array<{ id: string; sectionKey: string; sectionType: string; heading: string | null; subheading: string | null; bodyJson: unknown; media: Media | null; displayOrder: number }>; faqs: Array<{ id: string; question: string; answer: string }>; relatedCourses: Course[]; seo: Seo | null; jsonLd: Record<string, unknown>; }
export interface CourseFilterOption {
  id?: string;
  value: string;
  label: string;
  count: number;
}
export interface CourseFilterOptions {
  levels: CourseFilterOption[];
  countries: Array<CourseFilterOption & { currencyCode: string | null }>;
  subjects: CourseFilterOption[];
  subSubjects: Array<CourseFilterOption & { subject: { slug: string; name: string } }>;
  studyModes: CourseFilterOption[];
  intakes: Array<CourseFilterOption & { monthNumber: number | null }>;
  englishTests: CourseFilterOption[];
  extras: CourseFilterOption[];
  sorts: Array<{ value: string; label: string }>;
  tuition: {
    enabled: boolean;
    country: string | null;
    currencyCode: string | null;
  };
}
export function getSubjects(params: Record<string, string> = {}) { const query = new URLSearchParams(params).toString(); return request<Subject[]>(`/subjects${query ? `?${query}` : ''}`); }
export function getSubject(slug: string) { return request<SubjectDetail>(`/subjects/${encodeURIComponent(slug)}`).then((result) => result.data); }
export function getCourseLevels() { return request<Array<{ id: string; code: string; name: string; description: string | null }>>('/course-levels').then((result) => result.data); }
export function getStudyModes() { return request<Array<{ id: string; code: string; name: string; description: string | null }>>('/study-modes').then((result) => result.data); }
export function getCourses(params: Record<string, string> = {}) { const query = new URLSearchParams(params).toString(); return request<Course[]>(`/courses${query ? `?${query}` : ''}`); }
export function getCourseFilterOptions(params: Record<string, string> = {}) { const query = new URLSearchParams(params).toString(); return request<CourseFilterOptions>(`/courses/filter-options${query ? `?${query}` : ''}`).then((result) => result.data); }
export function getCourse(slug: string, country?: string) { const query = country ? `?country=${encodeURIComponent(country)}` : ''; return request<CourseDetail>(`/courses/${encodeURIComponent(slug)}${query}`).then((result) => result.data); }
export function getCourseSuggestions(q: string) { return request<Array<Pick<Course, 'id' | 'name' | 'slug' | 'subject' | 'courseLevel'>>>(`/courses/suggestions?q=${encodeURIComponent(q)}`).then((result) => result.data); }
