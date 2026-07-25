import { authFetch } from '@/features/auth/auth-client';
import type {
  CatalogEnvelope,
  CatalogListParams,
  CatalogMutationError,
  ContinentRecord,
  CountryRecord,
  CountryProfileBundle,
  IntakeOption,
  DirectoryRecord,
  PageMeta,
  SuggestionRecord,
  CountryEditorialBundle,
  EditorialCard,
  EditorialFaq,
  EditorialSection,
  EditorialMedia,
  SubjectRecord,
  SubSubjectRecord,
  MasterRecord,
  CourseRecord,
  CourseMappingRecord,
  CourseSectionRecord,
  CourseFaqRecord,
  CourseRelatedRecord,
  EditorialSeo,
} from './catalog.types';

function query(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if ((typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') && value !== '') search.set(key, String(value));
  }
  const result = search.toString();
  return result ? `?${result}` : '';
}

function errorFrom<T>(response: Response, body: CatalogEnvelope<T>): CatalogMutationError {
  const error = new Error(body.error?.message ?? 'Catalog request failed') as CatalogMutationError;
  error.name = 'CatalogMutationError';
  error.code = body.error?.code ?? 'CATALOG_REQUEST_FAILED';
  error.status = response.status;
  error.details = body.error?.details ?? null;
  return error;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<{ data: T; meta: PageMeta | null }> {
  const response = await authFetch(path, {
    ...init,
    headers: { ...(init.headers ?? {}), ...(init.body ? { 'content-type': 'application/json' } : {}) },
  });
  let body: CatalogEnvelope<T>;
  try {
    body = (await response.json()) as CatalogEnvelope<T>;
  } catch {
    throw Object.assign(new Error('Catalog service is temporarily unavailable'), { code: 'CATALOG_SERVICE_UNAVAILABLE', status: response.status, details: null });
  }
  if (!response.ok || body.error || body.data === null) throw errorFrom(response, body);
  return { data: body.data, meta: body.meta };
}

export function listContinents(params: CatalogListParams = {}, signal?: AbortSignal) {
  return request<ContinentRecord[]>(`/api/v1/admin/continents${query(params)}`, { signal });
}

export function createContinent(data: Record<string, unknown>) {
  return request<ContinentRecord>('/api/v1/admin/continents', { method: 'POST', body: JSON.stringify(data) });
}

export function updateContinent(id: string, data: Record<string, unknown>) {
  return request<ContinentRecord>(`/api/v1/admin/continents/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export function deleteContinent(id: string, expectedUpdatedAt?: string) {
  return request<{ deleted: true }>(`/api/v1/admin/continents/${id}`, { method: 'DELETE', body: JSON.stringify({ expectedUpdatedAt }) });
}

export function getContinent(id: string) {
  return request<ContinentRecord>(`/api/v1/admin/continents/${id}`);
}

export function listCountries(params: CatalogListParams = {}, signal?: AbortSignal) {
  return request<CountryRecord[]>(`/api/v1/admin/countries${query(params)}`, { signal });
}

export function getCountry(id: string) {
  return request<CountryRecord>(`/api/v1/admin/countries/${id}`);
}

export function createCountry(data: Record<string, unknown>) {
  return request<CountryRecord>('/api/v1/admin/countries', { method: 'POST', body: JSON.stringify(data) });
}

export function updateCountry(id: string, data: Record<string, unknown>) {
  return request<CountryRecord>(`/api/v1/admin/countries/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export function publishCountry(id: string, expectedUpdatedAt?: string) {
  return request<CountryRecord>(`/api/v1/admin/countries/${id}/publish`, { method: 'POST', body: JSON.stringify({ expectedUpdatedAt }) });
}

export function unpublishCountry(id: string, expectedUpdatedAt?: string) {
  return request<CountryRecord>(`/api/v1/admin/countries/${id}/unpublish`, { method: 'POST', body: JSON.stringify({ expectedUpdatedAt }) });
}

export function deleteCountry(id: string, expectedUpdatedAt?: string) {
  return request<{ deleted: true }>(`/api/v1/admin/countries/${id}`, { method: 'DELETE', body: JSON.stringify({ expectedUpdatedAt }) });
}

export function getCountryProfiles(id: string) {
  return request<CountryProfileBundle>(`/api/v1/admin/countries/${id}/profiles`);
}

export function listIntakeOptions() {
  return request<IntakeOption[]>('/api/v1/admin/intakes');
}

export function putCountryProfile(id: string, profile: 'cost' | 'work' | 'language' | 'intakes' | 'statistics', data: Record<string, unknown>) {
  return request<Record<string, unknown> | { intakes: Array<Record<string, unknown>> }>(`/api/v1/admin/countries/${id}/profiles/${profile}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function deleteCountryProfile(id: string, profile: 'cost' | 'work' | 'language' | 'statistics', expectedUpdatedAt?: string) {
  return request<{ deleted: boolean }>(`/api/v1/admin/countries/${id}/profiles/${profile}`, { method: 'DELETE', body: JSON.stringify({ expectedUpdatedAt }) });
}

export function getPublicCountry(slug: string) {
  return request<CountryRecord>(`/api/v1/countries/${encodeURIComponent(slug)}`);
}

export function getDirectory(params: { letter?: string; page?: number; limit?: number } = {}) {
  return request<DirectoryRecord[]>(`/api/v1/countries/directory${query(params)}`);
}

export function getSuggestions(q: string, limit = 5) {
  return request<SuggestionRecord[]>(`/api/v1/countries/suggestions${query({ q, limit })}`);
}

export function getCountryEditorial(id: string) { return request<CountryEditorialBundle>(`/api/v1/admin/countries/${id}/editorial`); }
export function listEditorialMedia(params: { q?: string; limit?: number } = {}) { return request<EditorialMedia[]>(`/api/v1/admin/media-options${query(params)}`); }
export function createEditorialSection(id: string, data: Record<string, unknown>) { return request<EditorialSection>(`/api/v1/admin/countries/${id}/content-sections`, { method: 'POST', body: JSON.stringify(data) }); }
export function updateEditorialSection(countryId: string, sectionId: string, data: Record<string, unknown>) { return request<EditorialSection>(`/api/v1/admin/countries/${countryId}/content-sections/${sectionId}`, { method: 'PATCH', body: JSON.stringify(data) }); }
export function deleteEditorialSection(countryId: string, sectionId: string, expectedUpdatedAt?: string) { return request<{ deleted: true }>(`/api/v1/admin/countries/${countryId}/content-sections/${sectionId}`, { method: 'DELETE', body: JSON.stringify({ expectedUpdatedAt }) }); }
export function createCountryFaq(id: string, data: Record<string, unknown>) { return request<EditorialFaq>(`/api/v1/admin/countries/${id}/faqs`, { method: 'POST', body: JSON.stringify(data) }); }
export function updateCountryFaq(countryId: string, faqId: string, data: Record<string, unknown>) { return request<EditorialFaq>(`/api/v1/admin/countries/${countryId}/faqs/${faqId}`, { method: 'PATCH', body: JSON.stringify(data) }); }
export function deleteCountryFaq(countryId: string, faqId: string, expectedUpdatedAt?: string) { return request<{ deleted: true }>(`/api/v1/admin/countries/${countryId}/faqs/${faqId}`, { method: 'DELETE', body: JSON.stringify({ expectedUpdatedAt }) }); }
export function saveCountrySeo(id: string, data: Record<string, unknown>) { return request<EditorialSeo>(`/api/v1/admin/countries/${id}/seo`, { method: 'PUT', body: JSON.stringify(data) }); }
export function deleteCountrySeo(id: string, expectedUpdatedAt?: string) { return request<{ deleted: true }>(`/api/v1/admin/countries/${id}/seo`, { method: 'DELETE', body: JSON.stringify({ expectedUpdatedAt }) }); }
export function createConsultantCard(id: string, data: Record<string, unknown>) { return request<EditorialCard>(`/api/v1/admin/countries/${id}/consultant-cards`, { method: 'POST', body: JSON.stringify(data) }); }
export function updateConsultantCard(countryId: string, cardId: string, data: Record<string, unknown>) { return request<EditorialCard>(`/api/v1/admin/countries/${countryId}/consultant-cards/${cardId}`, { method: 'PATCH', body: JSON.stringify(data) }); }
export function deleteConsultantCard(countryId: string, cardId: string, expectedUpdatedAt?: string) { return request<{ deleted: true }>(`/api/v1/admin/countries/${countryId}/consultant-cards/${cardId}`, { method: 'DELETE', body: JSON.stringify({ expectedUpdatedAt }) }); }

export function listSubjects(params: CatalogListParams = {}, signal?: AbortSignal) { return request<SubjectRecord[]>(`/api/v1/admin/subjects${query(params)}`, { signal }); }
export function getSubject(id: string) { return request<SubjectRecord>(`/api/v1/admin/subjects/${id}`); }
export function createSubject(data: Record<string, unknown>) { return request<SubjectRecord>('/api/v1/admin/subjects', { method: 'POST', body: JSON.stringify(data) }); }
export function updateSubject(id: string, data: Record<string, unknown>) { return request<SubjectRecord>(`/api/v1/admin/subjects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
export function publishSubject(id: string, expectedUpdatedAt?: string) { return request<SubjectRecord>(`/api/v1/admin/subjects/${id}/publish`, { method: 'POST', body: JSON.stringify({ expectedUpdatedAt }) }); }
export function unpublishSubject(id: string, expectedUpdatedAt?: string) { return request<SubjectRecord>(`/api/v1/admin/subjects/${id}/unpublish`, { method: 'POST', body: JSON.stringify({ expectedUpdatedAt }) }); }
export function deleteSubject(id: string, expectedUpdatedAt?: string) { return request<{ deleted: true }>(`/api/v1/admin/subjects/${id}`, { method: 'DELETE', body: JSON.stringify({ expectedUpdatedAt }) }); }
export function listSubSubjects(subjectId: string, params: CatalogListParams = {}) { return request<SubSubjectRecord[]>(`/api/v1/admin/subjects/${subjectId}/sub-subjects${query(params)}`); }
export function createSubSubject(subjectId: string, data: Record<string, unknown>) { return request<SubSubjectRecord>(`/api/v1/admin/subjects/${subjectId}/sub-subjects`, { method: 'POST', body: JSON.stringify(data) }); }
export function updateSubSubject(subjectId: string, id: string, data: Record<string, unknown>) { return request<SubSubjectRecord>(`/api/v1/admin/subjects/${subjectId}/sub-subjects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
export function publishSubSubject(subjectId: string, id: string, expectedUpdatedAt?: string) { return request<SubSubjectRecord>(`/api/v1/admin/subjects/${subjectId}/sub-subjects/${id}/publish`, { method: 'POST', body: JSON.stringify({ expectedUpdatedAt }) }); }
export function unpublishSubSubject(subjectId: string, id: string, expectedUpdatedAt?: string) { return request<SubSubjectRecord>(`/api/v1/admin/subjects/${subjectId}/sub-subjects/${id}/unpublish`, { method: 'POST', body: JSON.stringify({ expectedUpdatedAt }) }); }
export function deleteSubSubject(subjectId: string, id: string, expectedUpdatedAt?: string) { return request<{ deleted: true }>(`/api/v1/admin/subjects/${subjectId}/sub-subjects/${id}`, { method: 'DELETE', body: JSON.stringify({ expectedUpdatedAt }) }); }
export function listCourseLevels(params: CatalogListParams = {}) { return request<MasterRecord[]>(`/api/v1/admin/course-levels${query(params)}`); }
export function listStudyModes(params: CatalogListParams = {}) { return request<MasterRecord[]>(`/api/v1/admin/study-modes${query(params)}`); }
export function createCourseLevel(data: Record<string, unknown>) { return request<MasterRecord>('/api/v1/admin/course-levels', { method: 'POST', body: JSON.stringify(data) }); }
export function updateCourseLevel(id: string, data: Record<string, unknown>) { return request<MasterRecord>(`/api/v1/admin/course-levels/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
export function deleteCourseLevel(id: string, expectedUpdatedAt?: string) { return request<{ deleted: true }>(`/api/v1/admin/course-levels/${id}`, { method: 'DELETE', body: JSON.stringify({ expectedUpdatedAt }) }); }
export function createStudyMode(data: Record<string, unknown>) { return request<MasterRecord>('/api/v1/admin/study-modes', { method: 'POST', body: JSON.stringify(data) }); }
export function updateStudyMode(id: string, data: Record<string, unknown>) { return request<MasterRecord>(`/api/v1/admin/study-modes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
export function deleteStudyMode(id: string, expectedUpdatedAt?: string) { return request<{ deleted: true }>(`/api/v1/admin/study-modes/${id}`, { method: 'DELETE', body: JSON.stringify({ expectedUpdatedAt }) }); }
export function listAdminCourses(params: CatalogListParams = {}) { return request<CourseRecord[]>(`/api/v1/admin/courses${query(params)}`); }
export function getAdminCourse(id: string) { return request<CourseRecord>(`/api/v1/admin/courses/${id}`); }
export function createCourse(data: Record<string, unknown>) { return request<CourseRecord>('/api/v1/admin/courses', { method: 'POST', body: JSON.stringify(data) }); }
export function updateCourse(id: string, data: Record<string, unknown>) { return request<CourseRecord>(`/api/v1/admin/courses/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
export function publishCourse(id: string, expectedUpdatedAt?: string) { return request<CourseRecord>(`/api/v1/admin/courses/${id}/publish`, { method: 'POST', body: JSON.stringify({ expectedUpdatedAt }) }); }
export function unpublishCourse(id: string, expectedUpdatedAt?: string) { return request<CourseRecord>(`/api/v1/admin/courses/${id}/unpublish`, { method: 'POST', body: JSON.stringify({ expectedUpdatedAt }) }); }
export function deleteCourse(id: string, expectedUpdatedAt?: string) { return request<{ deleted: true }>(`/api/v1/admin/courses/${id}`, { method: 'DELETE', body: JSON.stringify({ expectedUpdatedAt }) }); }
export function replaceCourseModes(id: string, studyModeIds: string[], expectedUpdatedAt?: string) { return request<CourseRecord>(`/api/v1/admin/courses/${id}/study-modes`, { method: 'PUT', body: JSON.stringify({ studyModeIds, expectedUpdatedAt }) }); }
export function listCourseMappings(id: string) { return request<CourseMappingRecord[]>(`/api/v1/admin/courses/${id}/countries`); }
export function createCourseMapping(id: string, data: Record<string, unknown>) { return request<CourseMappingRecord>(`/api/v1/admin/courses/${id}/countries`, { method: 'POST', body: JSON.stringify(data) }); }
export function updateCourseMapping(courseId: string, mappingId: string, data: Record<string, unknown>) { return request<CourseMappingRecord>(`/api/v1/admin/courses/${courseId}/countries/${mappingId}`, { method: 'PATCH', body: JSON.stringify(data) }); }
export function deleteCourseMapping(courseId: string, mappingId: string, expectedUpdatedAt?: string) { return request<{ deleted: true }>(`/api/v1/admin/courses/${courseId}/countries/${mappingId}`, { method: 'DELETE', body: JSON.stringify({ expectedUpdatedAt }) }); }
export function listCourseIntakes(courseId: string, mappingId: string) { return request<Array<Record<string, unknown>>>(`/api/v1/admin/courses/${courseId}/countries/${mappingId}/intakes`); }
export function replaceCourseIntakes(courseId: string, mappingId: string, intakes: Array<Record<string, unknown>>, expectedUpdatedAt?: string) { return request<Array<Record<string, unknown>>>(`/api/v1/admin/courses/${courseId}/countries/${mappingId}/intakes`, { method: 'PUT', body: JSON.stringify({ intakes, expectedUpdatedAt }) }); }
export function listCourseSections(id: string) { return request<CourseSectionRecord[]>(`/api/v1/admin/courses/${id}/content-sections`); }
export function createCourseSection(id: string, data: Record<string, unknown>) { return request<CourseSectionRecord>(`/api/v1/admin/courses/${id}/content-sections`, { method: 'POST', body: JSON.stringify(data) }); }
export function updateCourseSection(courseId: string, sectionId: string, data: Record<string, unknown>) { return request<CourseSectionRecord>(`/api/v1/admin/courses/${courseId}/content-sections/${sectionId}`, { method: 'PATCH', body: JSON.stringify(data) }); }
export function deleteCourseSection(courseId: string, sectionId: string, expectedUpdatedAt?: string) { return request<{ deleted: true }>(`/api/v1/admin/courses/${courseId}/content-sections/${sectionId}`, { method: 'DELETE', body: JSON.stringify({ expectedUpdatedAt }) }); }
export function listCourseFaqs(id: string) { return request<CourseFaqRecord[]>(`/api/v1/admin/courses/${id}/faqs`); }
export function createCourseFaq(id: string, data: Record<string, unknown>) { return request<CourseFaqRecord>(`/api/v1/admin/courses/${id}/faqs`, { method: 'POST', body: JSON.stringify(data) }); }
export function updateCourseFaq(courseId: string, faqId: string, data: Record<string, unknown>) { return request<CourseFaqRecord>(`/api/v1/admin/courses/${courseId}/faqs/${faqId}`, { method: 'PATCH', body: JSON.stringify(data) }); }
export function deleteCourseFaq(courseId: string, faqId: string, expectedUpdatedAt?: string) { return request<{ deleted: true }>(`/api/v1/admin/courses/${courseId}/faqs/${faqId}`, { method: 'DELETE', body: JSON.stringify({ expectedUpdatedAt }) }); }
export function listCourseRelated(id: string) { return request<CourseRelatedRecord[]>(`/api/v1/admin/courses/${id}/related`); }
export function replaceCourseRelated(id: string, related: Array<Record<string, unknown>>, expectedUpdatedAt?: string) { return request<CourseRelatedRecord[]>(`/api/v1/admin/courses/${id}/related`, { method: 'PUT', body: JSON.stringify({ related, expectedUpdatedAt }) }); }
export function getSubjectSeo(id: string) { return request<EditorialSeo | null>(`/api/v1/admin/subjects/${id}/seo`); }
export function saveSubjectSeo(id: string, data: Record<string, unknown>) { return request<EditorialSeo>(`/api/v1/admin/subjects/${id}/seo`, { method: 'PUT', body: JSON.stringify(data) }); }
export function deleteSubjectSeo(id: string, expectedUpdatedAt?: string) { return request<{ deleted: boolean }>(`/api/v1/admin/subjects/${id}/seo`, { method: 'DELETE', body: JSON.stringify({ expectedUpdatedAt }) }); }
export function getCourseSeo(id: string) { return request<EditorialSeo | null>(`/api/v1/admin/courses/${id}/seo`); }
export function saveCourseSeo(id: string, data: Record<string, unknown>) { return request<EditorialSeo>(`/api/v1/admin/courses/${id}/seo`, { method: 'PUT', body: JSON.stringify(data) }); }
export function deleteCourseSeo(id: string, expectedUpdatedAt?: string) { return request<{ deleted: boolean }>(`/api/v1/admin/courses/${id}/seo`, { method: 'DELETE', body: JSON.stringify({ expectedUpdatedAt }) }); }
