import 'server-only';

import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';

export type CatalogProxyOperation =
  | 'continents:list'
  | 'continents:create'
  | `continents:get:${string}`
  | `continents:update:${string}`
  | `continents:delete:${string}`
  | 'countries:list'
  | 'countries:create'
  | `countries:get:${string}`
  | `countries:update:${string}`
  | `countries:publish:${string}`
  | `countries:unpublish:${string}`
  | `countries:delete:${string}`
  | `country-profiles:all:${string}`
  | `country-profiles:get:${string}:${'cost' | 'work' | 'language' | 'intakes' | 'statistics'}`
  | `country-profiles:put:${string}:${'cost' | 'work' | 'language' | 'intakes' | 'statistics'}`
  | `country-profiles:delete:${string}:${'cost' | 'work' | 'language' | 'statistics'}`
  | `editorial:${string}`
  | 'intakes:list'
  | 'subjects:list' | 'subjects:create' | `subjects:get:${string}` | `subjects:update:${string}` | `subjects:publish:${string}` | `subjects:unpublish:${string}` | `subjects:delete:${string}`
  | `subsubjects:list:${string}` | `subsubjects:create:${string}` | `subsubjects:get:${string}:${string}` | `subsubjects:update:${string}:${string}` | `subsubjects:publish:${string}:${string}` | `subsubjects:unpublish:${string}:${string}` | `subsubjects:delete:${string}:${string}`
  | `subjects-seo:get:${string}` | `subjects-seo:put:${string}` | `subjects-seo:delete:${string}`
  | 'course-levels:list' | 'course-levels:create' | `course-levels:get:${string}` | `course-levels:update:${string}` | `course-levels:delete:${string}`
  | 'study-modes:list' | 'study-modes:create' | `study-modes:get:${string}` | `study-modes:update:${string}` | `study-modes:delete:${string}`
  | 'courses:list' | 'courses:create' | `courses:get:${string}` | `courses:update:${string}` | `courses:publish:${string}` | `courses:unpublish:${string}` | `courses:delete:${string}`
  | `courses:modes:${string}` | `courses:countries:list:${string}` | `courses:countries:create:${string}` | `courses:countries:update:${string}:${string}` | `courses:countries:delete:${string}:${string}` | `courses:intakes:list:${string}:${string}` | `courses:intakes:put:${string}:${string}`
  | `courses:sections:list:${string}` | `courses:sections:create:${string}` | `courses:sections:update:${string}:${string}` | `courses:sections:delete:${string}:${string}`
  | `courses:faqs:list:${string}` | `courses:faqs:create:${string}` | `courses:faqs:update:${string}:${string}` | `courses:faqs:delete:${string}:${string}`
  | `courses:related:list:${string}` | `courses:related:put:${string}` | `courses-seo:get:${string}` | `courses-seo:put:${string}` | `courses-seo:delete:${string}`;

const MAX_BODY_BYTES = 64 * 1024;
const UPSTREAM_TIMEOUT_MS = 5_000;
const SAFE_ERROR_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: 'Invalid catalog request',
  UNAUTHORIZED: 'Your admin session is invalid',
  FORBIDDEN: 'Super Admin access is required',
  NOT_FOUND: 'Catalog record not found',
  CONTINENT_NOT_FOUND: 'Continent not found',
  CONTINENT_CONFLICT: 'Continent details conflict with an existing record',
  CONTINENT_NAME_CONFLICT: 'Continent name already exists',
  CONTINENT_SLUG_CONFLICT: 'Continent slug already exists',
  CONTINENT_CODE_CONFLICT: 'Continent code already exists',
  CONTINENT_IN_USE: 'A continent containing countries cannot be deleted',
  CONTINENT_STALE_VERSION: 'The continent changed in another session. Reload before saving',
  COUNTRY_NOT_FOUND: 'Country not found',
  COUNTRY_CONTINENT_INVALID: 'The selected continent is not available',
  COUNTRY_NAME_CONFLICT: 'Country name already exists',
  COUNTRY_SLUG_CONFLICT: 'Country slug already exists',
  COUNTRY_CODE_CONFLICT: 'Country ISO code already exists',
  COUNTRY_STALE_VERSION: 'The country changed in another session. Reload before saving',
  COUNTRY_NOT_READY: 'Complete the required fields before publishing',
  COUNTRY_COST_PROFILE_STALE_VERSION: 'The cost profile changed in another session. Reload before saving',
  COUNTRY_WORK_PROFILE_STALE_VERSION: 'The work profile changed in another session. Reload before saving',
  COUNTRY_LANGUAGE_PROFILE_STALE_VERSION: 'The language profile changed in another session. Reload before saving',
  COUNTRY_INTAKES_STALE_VERSION: 'The country intakes changed in another session. Reload before saving',
  COUNTRY_STATISTICS_STALE_VERSION: 'The statistics changed in another session. Reload before saving',
  PROFILE_DECIMAL_INVALID: 'Profile decimal values are invalid',
  PROFILE_DECIMAL_PRECISION: 'Profile decimal precision is invalid',
  PROFILE_RANGE_INVALID: 'Profile minimum and maximum values are invalid',
  PROFILE_SOURCE_REQUIRED: 'A published profile value requires a source and verification timestamp',
  PROFILE_SOURCE_INVALID: 'Profile source reference is invalid',
  PROFILE_VERIFICATION_INVALID: 'Profile verification timestamp is invalid',
  COUNTRY_INTAKE_INVALID: 'One or more intake options are unavailable',
  COUNTRY_INTAKES_DUPLICATE: 'An intake can only be selected once',
  COUNTRY_CONTENT_SECTION_NOT_FOUND: 'Content section not found',
  COUNTRY_FAQ_NOT_FOUND: 'FAQ not found',
  COUNTRY_SEO_STALE_VERSION: 'SEO metadata changed in another session. Reload before saving',
  COUNTRY_CONTENT_SECTION_STALE_VERSION: 'Content section changed in another session. Reload before saving',
  COUNTRY_FAQ_STALE_VERSION: 'FAQ changed in another session. Reload before saving',
  COUNTRY_CONSULTANT_CARD_STALE_VERSION: 'Consultant card changed in another session. Reload before saving',
  EDITORIAL_MEDIA_INVALID: 'Selected media is not available',
  EDITORIAL_BODY_INVALID: 'Editorial section content is invalid',
  SUBJECT_NOT_FOUND: 'Subject not found',
  SUBJECT_CONFLICT: 'Subject name or slug already exists',
  SUBJECT_STALE_VERSION: 'The subject changed in another session. Reload before saving',
  SUBJECT_NOT_READY: 'Complete subject fields before publishing',
  SUBJECT_IN_USE: 'A subject referenced by courses cannot be deleted',
  SUB_SUBJECT_NOT_FOUND: 'Sub-Subject not found',
  SUB_SUBJECT_CONFLICT: 'Sub-Subject name or slug already exists',
  SUB_SUBJECT_STALE_VERSION: 'The Sub-Subject changed in another session. Reload before saving',
  SUB_SUBJECT_NOT_READY: 'Complete Sub-Subject fields before publishing',
  SUB_SUBJECT_IN_USE: 'A Sub-Subject referenced by courses cannot be deleted',
  COURSE_LEVEL_NOT_FOUND: 'Course level not found',
  COURSE_LEVEL_CONFLICT: 'Course level code or name already exists',
  COURSE_LEVEL_STALE_VERSION: 'The course level changed in another session. Reload before saving',
  COURSE_LEVEL_IN_USE: 'This course level is still used by courses',
  STUDY_MODE_NOT_FOUND: 'Study mode not found',
  STUDY_MODE_CONFLICT: 'Study mode code or name already exists',
  STUDY_MODE_STALE_VERSION: 'The study mode changed in another session. Reload before saving',
  STUDY_MODE_IN_USE: 'This study mode is still used by courses',
  COURSE_NOT_FOUND: 'Course not found',
  COURSE_CONFLICT: 'Course slug already exists',
  COURSE_STALE_VERSION: 'The course changed in another session. Reload before saving',
  COURSE_NOT_READY: 'Complete course readiness requirements before publishing',
  COURSE_LEVEL_INACTIVE: 'Course level must be active',
  COURSE_SUBJECT_MISMATCH: 'Sub-Subject must belong to the selected Subject',
  COURSE_STUDY_MODES_INVALID: 'Published courses need at least one active study mode',
  COURSE_TUITION_COUNTRY_REQUIRED: 'Tuition filters require a country',
  COURSE_DURATION_INVALID: 'Duration values are invalid',
  COURSE_POPULARITY_INVALID: 'Popularity score must be between 0 and 100',
  COUNTRY_MAPPING_SOURCE_REQUIRED: 'Available mappings require an HTTPS source and verification date',
  COURSE_MAPPING_SOURCE_REQUIRED: 'Available mappings require an HTTPS source and verification date',
  COURSE_MAPPING_SOURCE_INVALID: 'Source reference must use HTTPS',
  COURSE_MAPPING_VERIFICATION_INVALID: 'Verification date cannot be in the future',
  COURSE_MAPPING_RANGE_INVALID: 'Course mapping values are invalid',
  COURSE_COUNTRY_DUPLICATE: 'This country is already mapped to the course',
  COURSE_COUNTRY_NOT_FOUND: 'Country-course mapping not found',
  COURSE_COUNTRY_STALE_VERSION: 'The country-course mapping changed in another session. Reload before saving',
  COURSE_INTAKES_DUPLICATE: 'An intake can only be selected once',
  COURSE_INTAKE_INVALID: 'One or more intakes are inactive',
  COURSE_INTAKES_STALE_VERSION: 'The course intakes changed in another session. Reload before saving',
  COURSE_SECTION_INVALID: 'Unsupported course content section',
  COURSE_SECTION_DUPLICATE: 'This content section key already exists',
  COURSE_SECTION_NOT_FOUND: 'Content section not found',
  COURSE_SECTION_STALE_VERSION: 'Content section changed in another session. Reload before saving',
  COURSE_FAQ_NOT_FOUND: 'FAQ not found',
  COURSE_FAQ_STALE_VERSION: 'FAQ changed in another session. Reload before saving',
  COURSE_RELATED_INVALID: 'Related courses cannot include the source course or duplicates',
  COURSE_RELATED_NOT_FOUND: 'One or more related courses were not found',
  COURSE_SEO_STALE_VERSION: 'SEO metadata changed in another session. Reload before saving',
  SEO_URL_INVALID: 'SEO canonical URL must use HTTPS',
  MEDIA_INVALID: 'Selected media is not an active image',
};

interface SafeEnvelope {
  data: unknown;
  meta: unknown;
  error: { code: string; message: string; details: unknown } | null;
  requestId: string;
  timestamp: string;
}

function requestIdFrom(request: NextRequest): string {
  const incoming = request.headers.get('x-request-id') ?? '';
  return /^[a-zA-Z0-9._:-]{1,100}$/.test(incoming) ? incoming : randomUUID();
}

function envelope(
  requestId: string,
  data: unknown,
  error: SafeEnvelope['error'],
  meta: unknown = null,
): SafeEnvelope {
  return {
    data,
    meta,
    error,
    requestId,
    timestamp: new Date().toISOString(),
  };
}

function errorResponse(status: number, requestId: string, code: string): NextResponse<SafeEnvelope> {
  const response = NextResponse.json(
    envelope(requestId, null, {
      code,
      message: SAFE_ERROR_MESSAGES[code] ?? 'Catalog request failed',
      details: null,
    }),
    { status },
  );
  response.headers.set('cache-control', 'no-store');
  response.headers.set('x-request-id', requestId);
  return response;
}

function operationDetails(operation: CatalogProxyOperation): { method: string; path: string; query: string[]; body: string[] } {
  if (operation === 'intakes:list') return { method: 'GET', path: '/api/v1/admin/intakes', query: [], body: [] };
  if (operation.startsWith('editorial:')) {
    const [, method, countryId, resource, childId] = operation.split(':');
    const safeCountryId = encodeURIComponent(countryId ?? '');
    const safeChildId = childId ? `/${encodeURIComponent(childId)}` : '';
    const base = `/api/v1/admin/countries/${safeCountryId}`;
    if (resource === 'all') return { method: 'GET', path: `${base}/editorial`, query: [], body: [] };
    if (resource === 'media-options') return { method: 'GET', path: '/api/v1/admin/media-options', query: ['q', 'limit'], body: [] };
    const paths: Record<string, string> = { sections: 'content-sections', faqs: 'faqs', cards: 'consultant-cards', seo: 'seo' };
    const path = `${base}/${paths[resource ?? ''] ?? resource}${safeChildId}`;
    const bodies: Record<string, string[]> = {
      sections: ['sectionKey', 'sectionType', 'eyebrow', 'heading', 'subheading', 'bodyJson', 'primaryMediaId', 'secondaryMediaId', 'ctaLabel', 'ctaUrl', 'configurationJson', 'displayOrder', 'status', 'expectedUpdatedAt'],
      faqs: ['question', 'answer', 'category', 'isFeatured', 'status', 'displayOrder', 'expectedUpdatedAt'],
      seo: ['seoTitle', 'metaDescription', 'canonicalUrl', 'focusKeyword', 'ogTitle', 'ogDescription', 'ogMediaId', 'twitterTitle', 'twitterDescription', 'twitterMediaId', 'robotsIndex', 'robotsFollow', 'schemaJson', 'hreflangJson', 'expectedUpdatedAt'],
      cards: ['title', 'slug', 'shortDescription', 'overview', 'iconMediaId', 'featuredMediaId', 'isFreeConsultation', 'ctaLabel', 'ctaUrl', 'status', 'isFeatured', 'displayOrder', 'publishedAt', 'expectedUpdatedAt'],
    };
    return { method: method ?? 'GET', path, query: [], body: bodies[resource ?? ''] ?? ['expectedUpdatedAt'] };
  }
  if (operation.startsWith('country-profiles:')) {
    const parts = operation.split(':');
    const action = parts[1];
    const countryId = encodeURIComponent(parts[2] ?? '');
    const profile = parts[3];
    const path = `/api/v1/admin/countries/${countryId}/profiles${profile ? `/${profile}` : ''}`;
    if (action === 'all') return { method: 'GET', path, query: [], body: [] };
    if (action === 'get') return { method: 'GET', path, query: [], body: [] };
    if (action === 'delete') return { method: 'DELETE', path, query: [], body: ['expectedUpdatedAt'] };
    const common = ['expectedUpdatedAt', 'sourceReference', 'verifiedAt', 'disclaimer'];
    const profileFields: Record<string, string[]> = {
      cost: ['currencyCode', 'currencySymbol', 'tuitionMin', 'tuitionMax', 'tuitionPeriod', 'tuitionNotes', 'livingCostMin', 'livingCostMax', 'livingCostPeriod', 'livingCostNotes', 'accommodationMin', 'accommodationMax', 'foodCostMin', 'foodCostMax', 'transportCostMin', 'transportCostMax', 'healthInsuranceCost', 'applicationFeeMin', 'applicationFeeMax', 'budgetBand', 'applicableYear'],
      work: ['partTimeAllowed', 'partTimeHoursPerWeek', 'partTimeHoursDuringBreaks', 'partTimeSummary', 'postStudyWorkAvailable', 'postStudyWorkMinMonths', 'postStudyWorkMaxMonths', 'postStudyWorkSummary', 'immigrationPathwayStrength', 'immigrationPathwaySummary', 'visaSuccessBand', 'visaSuccessPercentage', 'visaInformation', 'visaProcessingTime', 'proofOfFundsSummary'],
      language: ['ieltsRequirement', 'ieltsMinScore', 'ieltsNotes', 'pteRequirement', 'pteMinScore', 'pteNotes', 'toeflRequirement', 'toeflMinScore', 'toeflNotes', 'duolingoRequirement', 'duolingoMinScore', 'duolingoNotes', 'languageWaiverAvailable', 'waiverNotes', 'generalNotes'],
      intakes: ['intakes'],
      statistics: ['universitiesCount', 'publicUniversitiesCount', 'privateUniversitiesCount', 'coursesCount', 'ugCoursesCount', 'pgCoursesCount', 'pgdmCoursesCount', 'mbaCoursesCount', 'phdCoursesCount', 'scholarshipsCount', 'citiesCount', 'topRankedUniversitiesCount', 'internationalStudentsCount', 'studentSatisfactionPercentage', 'sourceMode'],
    };
    return { method: 'PUT', path, query: [], body: [...common, ...(profileFields[profile ?? ''] ?? [])] };
  }
  if (operation.startsWith('subjects-seo:')) {
    const [, action, id] = operation.split(':');
    const path = `/api/v1/admin/subjects/${encodeURIComponent(id ?? '')}/seo`;
    return { method: action === 'get' ? 'GET' : action === 'put' ? 'PUT' : 'DELETE', path, query: [], body: action === 'put' ? ['seoTitle', 'metaDescription', 'canonicalUrl', 'focusKeyword', 'ogTitle', 'ogDescription', 'ogMediaId', 'twitterTitle', 'twitterDescription', 'twitterMediaId', 'robotsIndex', 'robotsFollow', 'schemaJson', 'hreflangJson', 'expectedUpdatedAt'] : ['expectedUpdatedAt'] };
  }
  if (operation.startsWith('courses-seo:')) {
    const [, action, id] = operation.split(':');
    const path = `/api/v1/admin/courses/${encodeURIComponent(id ?? '')}/seo`;
    return { method: action === 'get' ? 'GET' : action === 'put' ? 'PUT' : 'DELETE', path, query: [], body: action === 'put' ? ['seoTitle', 'metaDescription', 'canonicalUrl', 'focusKeyword', 'ogTitle', 'ogDescription', 'ogMediaId', 'twitterTitle', 'twitterDescription', 'twitterMediaId', 'robotsIndex', 'robotsFollow', 'schemaJson', 'hreflangJson', 'expectedUpdatedAt'] : ['expectedUpdatedAt'] };
  }
  if (operation.startsWith('subsubjects:')) {
    const parts = operation.split(':'); const action = parts[1]; const subjectId = encodeURIComponent(parts[2] ?? ''); const id = parts[3] ? `/${encodeURIComponent(parts[3])}` : ''; const base = `/api/v1/admin/subjects/${subjectId}/sub-subjects`;
    const method = action === 'list' || action === 'get' ? 'GET' : action === 'create' ? 'POST' : action === 'update' ? 'PATCH' : action === 'publish' || action === 'unpublish' ? 'POST' : 'DELETE';
    const path = `${base}${id}${action === 'publish' || action === 'unpublish' ? `/${action}` : ''}`;
    return { method, path, query: action === 'list' ? ['q', 'status', 'featured', 'sort', 'page', 'limit'] : [], body: action === 'create' ? ['name', 'slug', 'shortDescription', 'overview', 'iconMediaId', 'listingMediaId', 'isFeatured', 'displayOrder'] : action === 'update' ? ['name', 'slug', 'shortDescription', 'overview', 'iconMediaId', 'listingMediaId', 'isFeatured', 'displayOrder', 'expectedUpdatedAt'] : ['expectedUpdatedAt'] };
  }
  if (operation.startsWith('subjects:')) {
    const [, action, id] = operation.split(':'); const safeId = encodeURIComponent(id ?? ''); const path = action === 'list' || action === 'create' ? '/api/v1/admin/subjects' : `/api/v1/admin/subjects/${safeId}${action === 'publish' || action === 'unpublish' ? `/${action}` : ''}`;
    return { method: action === 'list' ? 'GET' : action === 'create' ? 'POST' : action === 'update' ? 'PATCH' : action === 'get' ? 'GET' : action === 'publish' || action === 'unpublish' ? 'POST' : 'DELETE', path, query: action === 'list' ? ['q', 'status', 'featured', 'sort', 'page', 'limit'] : [], body: action === 'create' ? ['name', 'slug', 'shortDescription', 'overview', 'iconMediaId', 'listingMediaId', 'heroMediaId', 'isFeatured', 'displayOrder'] : action === 'update' ? ['name', 'slug', 'shortDescription', 'overview', 'iconMediaId', 'listingMediaId', 'heroMediaId', 'isFeatured', 'displayOrder', 'expectedUpdatedAt'] : ['expectedUpdatedAt'] };
  }
  if (operation.startsWith('course-levels:') || operation.startsWith('study-modes:')) {
    const parts = operation.split(':'); const resource = parts[0]; const action = parts[1]; const id = encodeURIComponent(parts[2] ?? ''); const base = `/api/v1/admin/${resource}`; const path = action === 'list' || action === 'create' ? base : `${base}/${id}`;
    return { method: action === 'list' ? 'GET' : action === 'create' ? 'POST' : action === 'update' ? 'PATCH' : 'DELETE', path, query: action === 'list' ? ['q', 'status', 'page', 'limit'] : [], body: action === 'create' ? ['code', 'name', 'description', 'educationOrder', 'displayOrder', 'status'] : action === 'update' ? ['code', 'name', 'description', 'educationOrder', 'displayOrder', 'status', 'expectedUpdatedAt'] : ['expectedUpdatedAt'] };
  }
  if (operation.startsWith('courses:')) {
    const parts = operation.split(':'); const resource = parts[1]; const action = parts[2]; const rawId = ['get', 'update', 'publish', 'unpublish', 'delete', 'modes'].includes(resource ?? '') ? parts[2] : parts[3]; const id = encodeURIComponent(rawId ?? ''); const child = parts[4] ? encodeURIComponent(parts[4]) : ''; const base = `/api/v1/admin/courses/${id}`;
    const coreFields = ['subjectId', 'subSubjectId', 'courseLevelId', 'name', 'shortName', 'qualificationName', 'slug', 'courseCode', 'shortDescription', 'overview', 'durationMin', 'durationMax', 'durationUnit', 'credits', 'featuredMediaId', 'careerSummary', 'popularityScore', 'isFeatured', 'displayOrder'];
    if (resource === 'list' || resource === 'create') return { method: resource === 'list' ? 'GET' : 'POST', path: '/api/v1/admin/courses', query: resource === 'list' ? ['q', 'subject', 'subSubject', 'level', 'country', 'studyMode', 'status', 'featured', 'sort', 'page', 'limit'] : [], body: resource === 'create' ? coreFields : [] };
    if (resource === 'modes') return { method: 'PUT', path: `${base}/study-modes`, query: [], body: ['studyModeIds', 'expectedUpdatedAt'] };
    const leafPath = child ? `/${child}` : '';
    if (resource === 'countries') return { method: action === 'list' ? 'GET' : action === 'create' ? 'POST' : action === 'update' ? 'PATCH' : 'DELETE', path: `${base}/countries${leafPath}`, query: [], body: action === 'create' ? ['countryId', 'availabilityStatus', 'indicativeTuitionMin', 'indicativeTuitionMax', 'currencyCode', 'tuitionPeriod', 'applicationFeeMin', 'applicationFeeMax', 'durationMinOverride', 'durationMaxOverride', 'durationUnitOverride', 'academicMinPercentage', 'academicMinCgpa', 'ieltsMinScore', 'pteMinScore', 'toeflMinScore', 'duolingoMinScore', 'workExperienceMonths', 'scholarshipAvailable', 'admissionRequirements', 'englishRequirements', 'applicationNotes', 'careerOpportunities', 'sourceReference', 'verifiedAt', 'status', 'isFeatured', 'displayOrder'] : action === 'update' ? ['countryId', 'availabilityStatus', 'indicativeTuitionMin', 'indicativeTuitionMax', 'currencyCode', 'tuitionPeriod', 'applicationFeeMin', 'applicationFeeMax', 'durationMinOverride', 'durationMaxOverride', 'durationUnitOverride', 'academicMinPercentage', 'academicMinCgpa', 'ieltsMinScore', 'pteMinScore', 'toeflMinScore', 'duolingoMinScore', 'workExperienceMonths', 'scholarshipAvailable', 'admissionRequirements', 'englishRequirements', 'applicationNotes', 'careerOpportunities', 'sourceReference', 'verifiedAt', 'status', 'isFeatured', 'displayOrder', 'expectedUpdatedAt'] : ['expectedUpdatedAt'] };
    if (resource === 'intakes') return { method: action === 'list' ? 'GET' : 'PUT', path: `${base}/countries/${child}/intakes`, query: [], body: action === 'list' ? [] : ['intakes', 'expectedUpdatedAt'] };
    if (resource === 'sections' || resource === 'faqs') { const pathName = resource === 'sections' ? 'content-sections' : 'faqs'; return { method: action === 'list' ? 'GET' : action === 'create' ? 'POST' : action === 'update' ? 'PATCH' : 'DELETE', path: `${base}/${pathName}${leafPath}`, query: [], body: resource === 'sections' ? (action === 'create' ? ['sectionKey', 'sectionType', 'heading', 'subheading', 'bodyJson', 'mediaId', 'displayOrder', 'status'] : action === 'update' ? ['sectionKey', 'sectionType', 'heading', 'subheading', 'bodyJson', 'mediaId', 'displayOrder', 'status', 'expectedUpdatedAt'] : ['expectedUpdatedAt']) : (action === 'create' ? ['question', 'answer', 'status', 'displayOrder'] : action === 'update' ? ['question', 'answer', 'status', 'displayOrder', 'expectedUpdatedAt'] : ['expectedUpdatedAt']) }; }
    if (resource === 'related') return { method: action === 'list' ? 'GET' : 'PUT', path: `${base}/related`, query: [], body: action === 'list' ? [] : ['related', 'expectedUpdatedAt'] };
    return { method: resource === 'get' ? 'GET' : resource === 'update' ? 'PATCH' : resource === 'publish' || resource === 'unpublish' ? 'POST' : 'DELETE', path: `${base}${resource === 'publish' || resource === 'unpublish' ? `/${resource}` : ''}`, query: [], body: resource === 'update' ? [...coreFields, 'expectedUpdatedAt'] : ['expectedUpdatedAt'] };
  }
  const [resource, action, id] = operation.split(':');
  if (resource === 'continents') {
    if (action === 'list') return { method: 'GET', path: '/api/v1/admin/continents', query: ['q', 'status', 'sort', 'page', 'limit'], body: [] };
    if (action === 'create') return { method: 'POST', path: '/api/v1/admin/continents', query: [], body: ['name', 'slug', 'code', 'shortDescription', 'isFeatured', 'displayOrder', 'status'] };
    const safeId = encodeURIComponent(id ?? '');
    if (action === 'get') return { method: 'GET', path: `/api/v1/admin/continents/${safeId}`, query: [], body: [] };
    if (action === 'update') return { method: 'PATCH', path: `/api/v1/admin/continents/${safeId}`, query: [], body: ['name', 'slug', 'code', 'shortDescription', 'isFeatured', 'displayOrder', 'status', 'iconMediaId', 'heroMediaId', 'expectedUpdatedAt'] };
    return { method: 'DELETE', path: `/api/v1/admin/continents/${safeId}`, query: [], body: ['expectedUpdatedAt'] };
  }
  if (action === 'list') return { method: 'GET', path: '/api/v1/admin/countries', query: ['q', 'continentId', 'status', 'featured', 'sort', 'page', 'limit'], body: [] };
  if (action === 'create') return { method: 'POST', path: '/api/v1/admin/countries', query: [], body: ['continentId', 'name', 'slug', 'iso2Code', 'iso3Code', 'pageHeading', 'shortDescription', 'isFeatured', 'displayOrder', 'flagMediaId'] };
  const safeId = encodeURIComponent(id ?? '');
  if (action === 'get') return { method: 'GET', path: `/api/v1/admin/countries/${safeId}`, query: [], body: [] };
  if (action === 'update') return { method: 'PATCH', path: `/api/v1/admin/countries/${safeId}`, query: [], body: ['continentId', 'name', 'slug', 'iso2Code', 'iso3Code', 'pageHeading', 'shortDescription', 'isFeatured', 'displayOrder', 'flagMediaId', 'expectedUpdatedAt'] };
  if (action === 'publish') return { method: 'POST', path: `/api/v1/admin/countries/${safeId}/publish`, query: [], body: ['expectedUpdatedAt'] };
  if (action === 'unpublish') return { method: 'POST', path: `/api/v1/admin/countries/${safeId}/unpublish`, query: [], body: ['expectedUpdatedAt'] };
  return { method: 'DELETE', path: `/api/v1/admin/countries/${safeId}`, query: [], body: ['expectedUpdatedAt'] };
}

function safeBody(value: unknown, allowed: string[]): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in record) result[key] = record[key];
  }
  return JSON.stringify(result);
}

function safeDetails(code: string, details: unknown): unknown {
  if (code === 'COUNTRY_NOT_READY' || code === 'VALIDATION_ERROR') return details;
  return null;
}

function normalizeBody(value: unknown, requestId: string, status: number): SafeEnvelope {
  if (!value || typeof value !== 'object' || !('data' in value)) {
    return envelope(requestId, null, {
      code: 'CATALOG_SERVICE_UNAVAILABLE',
      message: 'Catalog service is temporarily unavailable',
      details: null,
    });
  }
  const candidate = value as { data?: unknown; meta?: unknown; error?: unknown; requestId?: unknown };
  const upstreamRequestId = typeof candidate.requestId === 'string' && candidate.requestId.length <= 100 ? candidate.requestId : requestId;
  if (status >= 400 || candidate.error) {
    const rawError = candidate.error && typeof candidate.error === 'object' ? candidate.error as { code?: unknown; details?: unknown } : {};
    const code = typeof rawError.code === 'string' && SAFE_ERROR_MESSAGES[rawError.code] ? rawError.code : 'CATALOG_REQUEST_FAILED';
    return envelope(upstreamRequestId, null, {
      code,
      message: SAFE_ERROR_MESSAGES[code] ?? 'Catalog request failed',
      details: safeDetails(code, rawError.details),
    });
  }
  return envelope(upstreamRequestId, candidate.data ?? null, null, candidate.meta ?? null);
}

export async function proxyCatalogRoute(request: NextRequest, operation: CatalogProxyOperation): Promise<NextResponse<SafeEnvelope>> {
  const requestId = requestIdFrom(request);
  const details = operationDetails(operation);
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ') || authorization.trim().length < 8) {
    return errorResponse(401, requestId, 'UNAUTHORIZED');
  }
  const headers = new Headers({ accept: 'application/json', authorization, 'x-request-id': requestId });
  let body: string | undefined;
  if (details.method !== 'GET') {
    const declaredLength = Number(request.headers.get('content-length') ?? 0);
    if (declaredLength > MAX_BODY_BYTES) return errorResponse(413, requestId, 'VALIDATION_ERROR');
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return errorResponse(413, requestId, 'VALIDATION_ERROR');
    let parsed: unknown = {};
    if (raw.trim()) {
      try { parsed = JSON.parse(raw); } catch { return errorResponse(400, requestId, 'VALIDATION_ERROR'); }
    }
    body = safeBody(parsed, details.body) ?? '{}';
    headers.set('content-type', 'application/json');
  }
  const upstreamUrl = new URL(details.path, process.env.API_BASE_URL ?? 'http://127.0.0.1:4000');
  const incomingUrl = new URL(request.url);
  for (const key of details.query) {
    const values = incomingUrl.searchParams.getAll(key);
    if (values.length > 1) return errorResponse(400, requestId, 'VALIDATION_ERROR');
    if (values[0] !== undefined) upstreamUrl.searchParams.set(key, values[0]);
  }
  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: details.method,
      headers,
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    return errorResponse(502, requestId, 'CATALOG_SERVICE_UNAVAILABLE');
  }
  let parsed: unknown;
  try { parsed = await upstream.json(); } catch { return errorResponse(502, requestId, 'CATALOG_SERVICE_UNAVAILABLE'); }
  const responseBody = normalizeBody(parsed, requestId, upstream.status);
  const response = NextResponse.json(responseBody, { status: upstream.status });
  response.headers.set('cache-control', 'no-store');
  response.headers.set('x-request-id', responseBody.requestId);
  return response;
}
