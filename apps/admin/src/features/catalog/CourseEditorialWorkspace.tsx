'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CatalogDialog, CatalogError, CatalogLoading } from './CatalogDialog';
import { CatalogSeoEditor } from './CatalogSeoEditor';
import { MediaPickerDialog } from './editorial/MediaPickerDialog';
import {
  createCourseFaq,
  createCourseMapping,
  createCourseSection,
  deleteCourseFaq,
  deleteCourseMapping,
  deleteCourseSection,
  deleteCourseSeo,
  getCourseSeo,
  listAdminCourses,
  listCountries,
  listCourseFaqs,
  listCourseIntakes,
  listCourseMappings,
  listCourseRelated,
  listCourseSections,
  listIntakeOptions,
  replaceCourseIntakes,
  replaceCourseRelated,
  saveCourseSeo,
  updateCourseFaq,
  updateCourseMapping,
  updateCourseSection,
} from './catalog-client';
import type {
  CatalogMutationError,
  CountryRecord,
  CourseFaqRecord,
  CourseMappingRecord,
  CourseRecord,
  CourseRelatedRecord,
  CourseSectionRecord,
  EditorialMedia,
  EditorialSeo,
  IntakeOption,
} from './catalog.types';
import { FieldLabel } from '@/features/shared/FieldLabel';
import { commonFieldHelp } from '@/lib/field-help/common';

type Tab = 'availability' | 'content' | 'faqs' | 'seo' | 'related';
type Pending = { type: 'mapping' | 'section' | 'faq'; id: string } | null;

type MappingDraft = {
  countryId: string;
  availabilityStatus: string;
  status: string;
  indicativeTuitionMin: string;
  indicativeTuitionMax: string;
  currencyCode: string;
  tuitionPeriod: string;
  applicationFeeMin: string;
  applicationFeeMax: string;
  durationMinOverride: string;
  durationMaxOverride: string;
  durationUnitOverride: string;
  academicMinPercentage: string;
  academicMinCgpa: string;
  ieltsMinScore: string;
  pteMinScore: string;
  toeflMinScore: string;
  duolingoMinScore: string;
  workExperienceMonths: string;
  scholarshipAvailable: boolean;
  admissionRequirements: string;
  englishRequirements: string;
  applicationNotes: string;
  careerOpportunities: string;
  sourceReference: string;
  verifiedAt: string;
  isFeatured: boolean;
  displayOrder: string;
};

type MappingErrors = Partial<Record<keyof MappingDraft, string>>;

type SectionDraft = {
  sectionKey: string;
  sectionType: string;
  heading: string;
  subheading: string;
  bodyText: string;
  mediaId: string;
  status: string;
  displayOrder: string;
};

type SectionErrors = Partial<Record<keyof SectionDraft, string>>;

type FaqDraft = {
  question: string;
  answer: string;
  status: string;
  displayOrder: string;
};

const blankMapping: MappingDraft = {
  countryId: '',
  availabilityStatus: 'AVAILABLE',
  status: 'ACTIVE',
  indicativeTuitionMin: '',
  indicativeTuitionMax: '',
  currencyCode: '',
  tuitionPeriod: 'PER_YEAR',
  applicationFeeMin: '',
  applicationFeeMax: '',
  durationMinOverride: '',
  durationMaxOverride: '',
  durationUnitOverride: '',
  academicMinPercentage: '',
  academicMinCgpa: '',
  ieltsMinScore: '',
  pteMinScore: '',
  toeflMinScore: '',
  duolingoMinScore: '',
  workExperienceMonths: '',
  scholarshipAvailable: false,
  admissionRequirements: '',
  englishRequirements: '',
  applicationNotes: '',
  careerOpportunities: '',
  sourceReference: '',
  verifiedAt: '',
  isFeatured: false,
  displayOrder: '0',
};

const blankSection: SectionDraft = {
  sectionKey: 'curriculum',
  sectionType: 'RICH_TEXT',
  heading: '',
  subheading: '',
  bodyText: '',
  mediaId: '',
  status: 'ACTIVE',
  displayOrder: '0',
};

const blankFaq: FaqDraft = {
  question: '',
  answer: '',
  status: 'ACTIVE',
  displayOrder: '0',
};

const decimalPattern = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;
const integerPattern = /^\d+$/;

function mappingDraft(row?: CourseMappingRecord): MappingDraft {
  if (!row) return { ...blankMapping };
  return {
    countryId: row.country.id,
    availabilityStatus: row.availabilityStatus,
    status: row.status,
    indicativeTuitionMin: row.indicativeTuitionMin ?? '',
    indicativeTuitionMax: row.indicativeTuitionMax ?? '',
    currencyCode: row.currencyCode ?? '',
    tuitionPeriod: row.tuitionPeriod,
    applicationFeeMin: row.applicationFeeMin ?? '',
    applicationFeeMax: row.applicationFeeMax ?? '',
    durationMinOverride: row.durationMinOverride ?? '',
    durationMaxOverride: row.durationMaxOverride ?? '',
    durationUnitOverride: row.durationUnitOverride ?? '',
    academicMinPercentage: row.academicMinPercentage ?? '',
    academicMinCgpa: row.academicMinCgpa ?? '',
    ieltsMinScore: row.ieltsMinScore ?? '',
    pteMinScore: row.pteMinScore ?? '',
    toeflMinScore: row.toeflMinScore ?? '',
    duolingoMinScore: row.duolingoMinScore ?? '',
    workExperienceMonths:
      row.workExperienceMonths === null ? '' : String(row.workExperienceMonths),
    scholarshipAvailable: row.scholarshipAvailable,
    admissionRequirements: row.admissionRequirements ?? '',
    englishRequirements: row.englishRequirements ?? '',
    applicationNotes: row.applicationNotes ?? '',
    careerOpportunities: row.careerOpportunities ?? '',
    sourceReference: row.sourceReference ?? '',
    verifiedAt: row.verifiedAt ? row.verifiedAt.slice(0, 10) : '',
    isFeatured: row.isFeatured,
    displayOrder: String(row.displayOrder),
  };
}

function mappingPayload(draft: MappingDraft): Record<string, unknown> {
  const data: Record<string, unknown> = {
    countryId: draft.countryId,
    availabilityStatus: draft.availabilityStatus,
    status: draft.status,
    tuitionPeriod: draft.tuitionPeriod,
    scholarshipAvailable: draft.scholarshipAvailable,
    isFeatured: draft.isFeatured,
    displayOrder: Number(draft.displayOrder) || 0,
  };
  const optionalKeys = [
    'indicativeTuitionMin',
    'indicativeTuitionMax',
    'currencyCode',
    'applicationFeeMin',
    'applicationFeeMax',
    'durationMinOverride',
    'durationMaxOverride',
    'durationUnitOverride',
    'academicMinPercentage',
    'academicMinCgpa',
    'ieltsMinScore',
    'pteMinScore',
    'toeflMinScore',
    'duolingoMinScore',
    'workExperienceMonths',
    'admissionRequirements',
    'englishRequirements',
    'applicationNotes',
    'careerOpportunities',
    'sourceReference',
    'verifiedAt',
  ] as const;
  for (const key of optionalKeys) {
    const value = draft[key];
    if (value === '') continue;
    if (key === 'workExperienceMonths') data[key] = Number(value);
    else if (key === 'currencyCode') data[key] = value.trim().toUpperCase();
    else data[key] = value.trim();
  }
  return data;
}

function readableCatalogError(cause: unknown, fallback: string): string {
  const typed = cause as Partial<CatalogMutationError>;
  if (typed.code === 'VALIDATION_ERROR' && Array.isArray(typed.details)) {
    const messages = typed.details
      .map((item) => {
        if (!item || typeof item !== 'object') return '';
        const detail = item as { property?: unknown; message?: unknown };
        if (typeof detail.message !== 'string') return '';
        return detail.message;
      })
      .filter(Boolean);
    if (messages.length) return [...new Set(messages)].join(' · ');
  }
  return typed.message ?? (cause instanceof Error ? cause.message : fallback);
}

function serverFieldErrors<T extends string>(
  cause: unknown,
  allowed: readonly T[],
): Partial<Record<T, string>> {
  const typed = cause as Partial<CatalogMutationError>;
  if (typed.code !== 'VALIDATION_ERROR' || !Array.isArray(typed.details)) return {};
  const result: Partial<Record<T, string>> = {};
  for (const item of typed.details) {
    if (!item || typeof item !== 'object') continue;
    const detail = item as { property?: unknown; message?: unknown };
    if (
      typeof detail.property === 'string' &&
      allowed.includes(detail.property as T) &&
      typeof detail.message === 'string'
    ) {
      result[detail.property as T] = detail.message;
    }
  }
  return result;
}

function inputClass(error?: string) {
  return `mt-2 w-full rounded-lg border px-3 py-2 font-normal outline-none transition ${
    error
      ? 'border-[#D92D20] bg-[#FFF8F7] ring-2 ring-[#FEE4E2]'
      : 'border-[#D9E0EA] focus:border-[#1657CF] focus:ring-2 focus:ring-[#DCE8FF]'
  }`;
}

function ErrorText({ message }: { message?: string }) {
  return message ? (
    <p className="mt-1.5 text-xs font-semibold text-[#B42318]">{message}</p>
  ) : null;
}

function validateDecimal(
  errors: MappingErrors,
  draft: MappingDraft,
  key: keyof MappingDraft,
  label: string,
) {
  const value = draft[key];
  if (typeof value === 'string' && value && !decimalPattern.test(value)) {
    errors[key] = `${label} must be a non-negative number with at most 2 decimal places.`;
  }
}

function validateMappingDraft(draft: MappingDraft): MappingErrors {
  const errors: MappingErrors = {};
  if (!draft.countryId) errors.countryId = 'Choose a published country.';

  for (const [key, label] of [
    ['indicativeTuitionMin', 'Tuition minimum'],
    ['indicativeTuitionMax', 'Tuition maximum'],
    ['applicationFeeMin', 'Application fee minimum'],
    ['applicationFeeMax', 'Application fee maximum'],
    ['durationMinOverride', 'Duration minimum'],
    ['durationMaxOverride', 'Duration maximum'],
    ['academicMinPercentage', 'Academic percentage'],
    ['academicMinCgpa', 'Academic CGPA'],
    ['ieltsMinScore', 'IELTS score'],
    ['pteMinScore', 'PTE score'],
    ['toeflMinScore', 'TOEFL score'],
    ['duolingoMinScore', 'Duolingo score'],
  ] as const) {
    validateDecimal(errors, draft, key, label);
  }

  const ranges = [
    ['indicativeTuitionMin', 'indicativeTuitionMax', 'Tuition'],
    ['applicationFeeMin', 'applicationFeeMax', 'Application fee'],
    ['durationMinOverride', 'durationMaxOverride', 'Duration'],
  ] as const;
  for (const [minKey, maxKey, label] of ranges) {
    const min = draft[minKey];
    const max = draft[maxKey];
    if (
      min &&
      max &&
      decimalPattern.test(min) &&
      decimalPattern.test(max) &&
      Number(min) > Number(max)
    ) {
      errors[minKey] = `${label} minimum cannot exceed maximum.`;
      errors[maxKey] = `${label} maximum cannot be below minimum.`;
    }
  }

  if (draft.currencyCode && !/^[A-Za-z]{3}$/.test(draft.currencyCode.trim())) {
    errors.currencyCode = 'Currency must be a 3-letter ISO code, for example GBP.';
  }
  if (
    draft.durationUnitOverride &&
    !['MONTHS', 'YEARS'].includes(draft.durationUnitOverride)
  ) {
    errors.durationUnitOverride = 'Choose Months or Years.';
  }
  if (
    draft.workExperienceMonths &&
    (!integerPattern.test(draft.workExperienceMonths) ||
      Number(draft.workExperienceMonths) > 120)
  ) {
    errors.workExperienceMonths = 'Work experience must be a whole number from 0 to 120 months.';
  }
  if (
    draft.academicMinPercentage &&
    decimalPattern.test(draft.academicMinPercentage) &&
    Number(draft.academicMinPercentage) > 100
  ) {
    errors.academicMinPercentage = 'Academic percentage cannot exceed 100.';
  }
  if (
    draft.academicMinCgpa &&
    decimalPattern.test(draft.academicMinCgpa) &&
    Number(draft.academicMinCgpa) > 10
  ) {
    errors.academicMinCgpa = 'CGPA cannot exceed 10.';
  }

  const needsVerification = draft.availabilityStatus !== 'UNAVAILABLE';
  if (needsVerification && !draft.sourceReference.trim()) {
    errors.sourceReference = 'Official HTTPS source is required for Available or Limited mappings.';
  } else if (
    draft.sourceReference &&
    !/^https:\/\//i.test(draft.sourceReference.trim())
  ) {
    errors.sourceReference = 'Official source must start with https://';
  }
  if (needsVerification && !draft.verifiedAt) {
    errors.verifiedAt = 'Verified date is required for Available or Limited mappings.';
  } else if (draft.verifiedAt && new Date(draft.verifiedAt) > new Date()) {
    errors.verifiedAt = 'Verified date cannot be in the future.';
  }

  if (
    !integerPattern.test(draft.displayOrder) ||
    Number(draft.displayOrder) < 0 ||
    Number(draft.displayOrder) > 999999
  ) {
    errors.displayOrder = 'Display order must be a whole number from 0 to 999999.';
  }
  return errors;
}

function sectionBodyText(body: Record<string, unknown> | null): string {
  if (!body) return '';
  if (Array.isArray(body.paragraphs)) {
    return body.paragraphs
      .filter((item): item is string => typeof item === 'string')
      .join('\n\n');
  }
  const values: string[] = [];
  const collect = (value: unknown) => {
    if (typeof value === 'string' || typeof value === 'number') {
      values.push(String(value));
    } else if (Array.isArray(value)) {
      value.forEach(collect);
    } else if (value && typeof value === 'object') {
      Object.values(value as Record<string, unknown>).forEach(collect);
    }
  };
  collect(body);
  return values.join('\n');
}

function sectionBodyPayload(bodyText: string, sectionType: string) {
  const text = bodyText.trim();
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  const lines = text
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (sectionType === 'CHECKLIST') return { paragraphs, items: lines };
  if (sectionType === 'STEPS') {
    return {
      paragraphs,
      steps: lines.map((item, index) => ({ order: index + 1, text: item })),
    };
  }
  if (sectionType === 'FACT_GRID' || sectionType === 'CARD_GRID') {
    return { paragraphs, items: lines.map((item) => ({ text: item })) };
  }
  if (sectionType === 'CTA') return { paragraphs, text };
  if (sectionType === 'MEDIA') return { paragraphs, caption: text };
  return { paragraphs };
}

function validateSectionDraft(
  draft: SectionDraft,
  sections: CourseSectionRecord[],
  editSection: CourseSectionRecord | null,
): SectionErrors {
  const errors: SectionErrors = {};
  if (!draft.heading.trim()) errors.heading = 'Heading is required.';
  else if (draft.heading.trim().length > 500) {
    errors.heading = 'Heading must be 500 characters or fewer.';
  }
  if (draft.subheading.trim().length > 5000) {
    errors.subheading = 'Subheading must be 5,000 characters or fewer.';
  }
  if (!draft.bodyText.trim() && !(draft.sectionType === 'MEDIA' && draft.mediaId)) {
    errors.bodyText = 'Body content is required. For a Media section, selecting media is enough.';
  }
  if (
    !integerPattern.test(draft.displayOrder) ||
    Number(draft.displayOrder) < 0 ||
    Number(draft.displayOrder) > 999999
  ) {
    errors.displayOrder = 'Display order must be a whole number from 0 to 999999.';
  }
  if (
    !editSection &&
    sections.some((item) => item.sectionKey === draft.sectionKey)
  ) {
    errors.sectionKey = 'This section already exists. Edit the existing section instead.';
  }
  return errors;
}

function firstErrorId<T extends string>(
  errors: Partial<Record<T, string>>,
  prefix: string,
) {
  const first = Object.keys(errors)[0];
  return first ? `${prefix}${first}` : null;
}

function focusField(id: string | null) {
  if (!id) return;
  window.setTimeout(() => {
    const element = document.getElementById(id);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (element instanceof HTMLElement) element.focus();
  }, 0);
}

export function CourseEditorialWorkspace({
  courseId,
  course,
  media,
}: {
  courseId: string;
  course: CourseRecord;
  media: EditorialMedia[];
}) {
  const [tab, setTab] = useState<Tab>('availability');
  const [mappings, setMappings] = useState<CourseMappingRecord[]>([]);
  const [sections, setSections] = useState<CourseSectionRecord[]>([]);
  const [faqs, setFaqs] = useState<CourseFaqRecord[]>([]);
  const [related, setRelated] = useState<CourseRelatedRecord[]>([]);
  const [countries, setCountries] = useState<CountryRecord[]>([]);
  const [intakes, setIntakes] = useState<IntakeOption[]>([]);
  const [allCourses, setAllCourses] = useState<CourseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<Pending>(null);

  const [editMapping, setEditMapping] = useState<CourseMappingRecord | null>(null);
  const [mapping, setMapping] = useState<MappingDraft>({ ...blankMapping });
  const [mappingErrors, setMappingErrors] = useState<MappingErrors>({});

  const [editSection, setEditSection] = useState<CourseSectionRecord | null>(null);
  const [section, setSection] = useState<SectionDraft>({ ...blankSection });
  const [sectionErrors, setSectionErrors] = useState<SectionErrors>({});

  const [editFaq, setEditFaq] = useState<CourseFaqRecord | null>(null);
  const [faq, setFaq] = useState<FaqDraft>({ ...blankFaq });

  const [relatedIds, setRelatedIds] = useState<string[]>([]);
  const [relatedQuery, setRelatedQuery] = useState('');
  const [intakeMapping, setIntakeMapping] = useState<CourseMappingRecord | null>(null);
  const [intakeIds, setIntakeIds] = useState<string[]>([]);
  const [deadlines, setDeadlines] = useState<Record<string, string>>({});
  const [seo, setSeoState] = useState<EditorialSeo | null>(null);
  const [seoPending, setSeoPending] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    void Promise.allSettled(
      [
        listCourseMappings(courseId),
        listCourseSections(courseId),
        listCourseFaqs(courseId),
        listCourseRelated(courseId),
        getCourseSeo(courseId),
        listCountries({ status: 'PUBLISHED', limit: 100 }),
        listIntakeOptions(),
        listAdminCourses({ limit: 100 }),
      ] as const,
    )
      .then((results) => {
        const [
          mapResult,
          sectionResult,
          faqResult,
          relatedResult,
          seoResult,
          countriesResult,
          intakeResult,
          courseResult,
        ] = results;

        if (mapResult.status === 'fulfilled') setMappings(mapResult.value.data);
        if (sectionResult.status === 'fulfilled') setSections(sectionResult.value.data);
        if (faqResult.status === 'fulfilled') setFaqs(faqResult.value.data);
        if (relatedResult.status === 'fulfilled') {
          setRelated(relatedResult.value.data);
          setRelatedIds(
            relatedResult.value.data.map((item) => item.relatedCourse.id),
          );
        }
        if (seoResult.status === 'fulfilled') setSeoState(seoResult.value.data);
        if (countriesResult.status === 'fulfilled') {
          setCountries(countriesResult.value.data);
        }
        if (intakeResult.status === 'fulfilled') setIntakes(intakeResult.value.data);
        if (courseResult.status === 'fulfilled') setAllCourses(courseResult.value.data);

        const failures = results
          .filter((result) => result.status === 'rejected')
          .map((result) =>
            result.status === 'rejected'
              ? readableCatalogError(result.reason, 'Unable to load workspace data')
              : '',
          )
          .filter(Boolean);
        if (failures.length) {
          setError(
            `Some workspace data could not load: ${[...new Set(failures)].join(' · ')}`,
          );
        }
      })
      .finally(() => setLoading(false));
  }, [courseId]);

  useEffect(() => {
    const timer = window.setTimeout(() => load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const relatedOptions = useMemo(
    () =>
      allCourses.filter(
        (item) =>
          item.id !== courseId &&
          (!relatedQuery ||
            item.name.toLowerCase().includes(relatedQuery.toLowerCase())),
      ),
    [allCourses, courseId, relatedQuery],
  );

  function showActionError(message: string) {
    setError(message);
    window.setTimeout(() => {
      document
        .getElementById('course-workspace-error')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);
  }

  async function saveMapping(event: React.FormEvent) {
    event.preventDefault();
    const localErrors = validateMappingDraft(mapping);
    if (Object.keys(localErrors).length) {
      setMappingErrors(localErrors);
      setError('Fix the highlighted Availability fields before saving the mapping.');
      focusField(firstErrorId(localErrors, 'mapping-'));
      return;
    }

    setMappingErrors({});
    setError('');
    try {
      const result = editMapping
        ? await updateCourseMapping(courseId, editMapping.id, {
            ...mappingPayload(mapping),
            expectedUpdatedAt: editMapping.updatedAt,
          })
        : await createCourseMapping(courseId, mappingPayload(mapping));
      setMappings((rows) =>
        editMapping
          ? rows.map((row) => (row.id === result.data.id ? result.data : row))
          : [...rows, result.data],
      );
      setEditMapping(null);
      setMapping({ ...blankMapping });
    } catch (cause: unknown) {
      const fields = serverFieldErrors(
        cause,
        Object.keys(blankMapping) as Array<keyof MappingDraft>,
      );
      if (Object.keys(fields).length) {
        setMappingErrors(fields);
        setError('Fix the highlighted Availability fields before saving the mapping.');
        focusField(firstErrorId(fields, 'mapping-'));
      } else {
        showActionError(readableCatalogError(cause, 'Unable to save mapping'));
      }
    }
  }

  async function saveIntakes(event: React.FormEvent) {
    event.preventDefault();
    if (!intakeMapping) return;
    try {
      const rows = intakeIds.map((intakeId) => ({
        intakeId,
        ...(deadlines[intakeId]
          ? { applicationDeadline: deadlines[intakeId] }
          : {}),
        status: 'ACTIVE',
      }));
      await replaceCourseIntakes(
        courseId,
        intakeMapping.id,
        rows,
        intakeMapping.updatedAt,
      );
      setIntakeMapping(null);
      setError('');
    } catch (cause: unknown) {
      showActionError(readableCatalogError(cause, 'Unable to save intakes'));
    }
  }

  async function saveSection(event: React.FormEvent) {
    event.preventDefault();
    const localErrors = validateSectionDraft(section, sections, editSection);
    if (Object.keys(localErrors).length) {
      setSectionErrors(localErrors);
      setError('Fix the highlighted Content fields before saving the section.');
      focusField(firstErrorId(localErrors, 'section-'));
      return;
    }

    setSectionErrors({});
    setError('');
    const data: Record<string, unknown> = {
      sectionKey: section.sectionKey,
      sectionType: section.sectionType,
      heading: section.heading.trim(),
      ...(section.subheading.trim()
        ? { subheading: section.subheading.trim() }
        : {}),
      ...(section.bodyText.trim()
        ? { bodyJson: sectionBodyPayload(section.bodyText, section.sectionType) }
        : {}),
      ...(section.mediaId ? { mediaId: section.mediaId } : {}),
      status: section.status,
      displayOrder: Number(section.displayOrder) || 0,
    };

    try {
      const result = editSection
        ? await updateCourseSection(courseId, editSection.id, {
            ...data,
            expectedUpdatedAt: editSection.updatedAt,
          })
        : await createCourseSection(courseId, data);
      setSections((rows) =>
        editSection
          ? rows.map((row) => (row.id === result.data.id ? result.data : row))
          : [...rows, result.data],
      );
      setEditSection(null);
      setSection({ ...blankSection });
    } catch (cause: unknown) {
      const fields = serverFieldErrors(
        cause,
        ['sectionKey', 'sectionType', 'heading', 'subheading', 'mediaId', 'status', 'displayOrder'] as const,
      );
      const mapped: SectionErrors = { ...fields };
      const typed = cause as Partial<CatalogMutationError>;
      if (
        typed.code === 'VALIDATION_ERROR' &&
        Array.isArray(typed.details) &&
        typed.details.some(
          (item) =>
            item &&
            typeof item === 'object' &&
            (item as { property?: unknown }).property === 'bodyJson',
        )
      ) {
        mapped.bodyText = 'Body content is invalid.';
      }
      if (Object.keys(mapped).length) {
        setSectionErrors(mapped);
        setError('Fix the highlighted Content fields before saving the section.');
        focusField(firstErrorId(mapped, 'section-'));
      } else {
        showActionError(
          readableCatalogError(cause, 'Unable to save content section'),
        );
      }
    }
  }

  async function saveFaq(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    try {
      const data = {
        ...faq,
        question: faq.question.trim(),
        answer: faq.answer.trim(),
        displayOrder: Number(faq.displayOrder) || 0,
      };
      const result = editFaq
        ? await updateCourseFaq(courseId, editFaq.id, {
            ...data,
            expectedUpdatedAt: editFaq.updatedAt,
          })
        : await createCourseFaq(courseId, data);
      setFaqs((rows) =>
        editFaq
          ? rows.map((row) => (row.id === result.data.id ? result.data : row))
          : [...rows, result.data],
      );
      setEditFaq(null);
      setFaq({ ...blankFaq });
    } catch (cause: unknown) {
      showActionError(readableCatalogError(cause, 'Unable to save FAQ'));
    }
  }

  async function remove() {
    if (!pending) return;
    try {
      if (pending.type === 'mapping') {
        await deleteCourseMapping(
          courseId,
          pending.id,
          mappings.find((row) => row.id === pending.id)?.updatedAt,
        );
        setMappings((rows) => rows.filter((row) => row.id !== pending.id));
      }
      if (pending.type === 'section') {
        await deleteCourseSection(
          courseId,
          pending.id,
          sections.find((row) => row.id === pending.id)?.updatedAt,
        );
        setSections((rows) => rows.filter((row) => row.id !== pending.id));
      }
      if (pending.type === 'faq') {
        await deleteCourseFaq(
          courseId,
          pending.id,
          faqs.find((row) => row.id === pending.id)?.updatedAt,
        );
        setFaqs((rows) => rows.filter((row) => row.id !== pending.id));
      }
      setPending(null);
      setError('');
    } catch (cause: unknown) {
      setPending(null);
      showActionError(readableCatalogError(cause, 'Unable to remove record'));
    }
  }

  async function saveRelated() {
    try {
      const result = await replaceCourseRelated(
        courseId,
        relatedIds.map((relatedCourseId, index) => ({
          relatedCourseId,
          relationshipType: 'RELATED',
          displayOrder: index,
        })),
        course.updatedAt,
      );
      setRelated(result.data);
      setError('');
    } catch (cause: unknown) {
      showActionError(
        readableCatalogError(cause, 'Unable to save related courses'),
      );
    }
  }

  async function removeSeo() {
    if (!seo) return;
    setSeoPending(true);
    try {
      await deleteCourseSeo(courseId, seo.updatedAt);
      setSeoState(null);
      setError('');
    } catch (cause: unknown) {
      showActionError(
        readableCatalogError(cause, 'Unable to remove SEO metadata'),
      );
    } finally {
      setSeoPending(false);
    }
  }

  async function loadIntakes(row: CourseMappingRecord) {
    try {
      const result = await listCourseIntakes(courseId, row.id);
      const rows = result.data;
      setIntakeIds(
        rows
          .map((item) =>
            String(
              (item.intake as { id?: string } | undefined)?.id ??
                item.intakeId ??
                '',
            ),
          )
          .filter(Boolean),
      );
      setDeadlines(
        Object.fromEntries(
          rows.map((item) => [
            String(
              (item.intake as { id?: string } | undefined)?.id ??
                item.intakeId ??
                '',
            ),
            typeof item.applicationDeadline === 'string'
              ? item.applicationDeadline.slice(0, 10)
              : '',
          ]),
        ),
      );
      setIntakeMapping(row);
    } catch (cause: unknown) {
      showActionError(readableCatalogError(cause, 'Unable to load intakes'));
    }
  }

  if (loading) return <CatalogLoading label="Loading course workspace…" />;

  const tabs: Array<[Tab, string]> = [
    ['availability', 'Availability'],
    ['content', 'Content'],
    ['faqs', 'FAQs'],
    ['seo', 'SEO'],
    ['related', 'Related courses'],
  ];

  return (
    <section className="mt-8 space-y-6" aria-labelledby="course-workspace-heading">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#828B9B]">
          Course workspace
        </p>
        <h3 id="course-workspace-heading" className="mt-2 text-2xl font-semibold">
          Availability, content, FAQs, SEO, and related courses
        </h3>
        <p className="mt-2 text-sm leading-6 text-[#667085]">
          All country facts require source guidance and verification. Zero values remain explicit; unknown values remain blank.
        </p>
      </div>

      {error ? (
        <div id="course-workspace-error">
          <CatalogError message={error} onRetry={load} />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 border-b border-[#E8ECF3] pb-3">
        {tabs.map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${
              tab === value ? 'bg-[#1657CF] text-white' : 'border border-[#D9E0EA]'
            }`}
            onClick={() => {
              setError('');
              setTab(value);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'availability' ? (
        <Availability
          mappings={mappings}
          countries={countries}
          mapping={mapping}
          errors={mappingErrors}
          setMapping={(value) => {
            setMapping(value);
            setMappingErrors({});
          }}
          editMapping={editMapping}
          saveMapping={saveMapping}
          setPending={setPending}
          onReset={() => {
            setEditMapping(null);
            setMapping({ ...blankMapping });
            setMappingErrors({});
            setError('');
          }}
          onEdit={(row) => {
            setEditMapping(row);
            setMapping(mappingDraft(row));
            setMappingErrors({});
            setError('');
          }}
          onIntakes={(row) => void loadIntakes(row)}
        />
      ) : null}

      {tab === 'content' ? (
        <Content
          sections={sections}
          section={section}
          errors={sectionErrors}
          setSection={(value) => {
            setSection(value);
            setSectionErrors({});
          }}
          editSection={editSection}
          saveSection={saveSection}
          setPending={setPending}
          onReset={() => {
            setEditSection(null);
            setSection({ ...blankSection });
            setSectionErrors({});
            setError('');
          }}
          onEdit={(row) => {
            setEditSection(row);
            setSection({
              sectionKey: row.sectionKey,
              sectionType: row.sectionType,
              heading: row.heading ?? '',
              subheading: row.subheading ?? '',
              bodyText: sectionBodyText(row.bodyJson),
              mediaId: row.media?.id ?? '',
              status: row.status,
              displayOrder: String(row.displayOrder),
            });
            setSectionErrors({});
            setError('');
          }}
          media={media}
        />
      ) : null}

      {tab === 'faqs' ? (
        <Faqs
          faqs={faqs}
          faq={faq}
          setFaq={setFaq}
          editFaq={editFaq}
          saveFaq={saveFaq}
          setPending={setPending}
          onReset={() => {
            setEditFaq(null);
            setFaq({ ...blankFaq });
            setError('');
          }}
          onEdit={(row) => {
            setEditFaq(row);
            setFaq({
              question: row.question,
              answer: row.answer,
              status: row.status,
              displayOrder: String(row.displayOrder),
            });
            setError('');
          }}
        />
      ) : null}

      {tab === 'seo' ? (
        <CatalogSeoEditor
          seo={seo}
          media={media}
          busy={seoPending}
          onSave={async (data) => {
            const result = await saveCourseSeo(courseId, data);
            setSeoState(result.data);
            setError('');
          }}
          onDelete={() => void removeSeo()}
          onError={setError}
        />
      ) : null}

      {tab === 'related' ? (
        <Related
          related={related}
          options={relatedOptions}
          selected={relatedIds}
          setSelected={setRelatedIds}
          query={relatedQuery}
          setQuery={setRelatedQuery}
          save={saveRelated}
        />
      ) : null}

      {pending ? (
        <CatalogDialog
          title="Remove course record?"
          description="This action is audited and may be blocked when the record is required. Confirm to continue."
          onClose={() => setPending(null)}
        >
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setPending(null)}
              className="rounded-lg border px-4 py-2 text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void remove()}
              className="rounded-lg bg-[#B42318] px-4 py-2 text-sm font-semibold text-white"
            >
              Remove
            </button>
          </div>
        </CatalogDialog>
      ) : null}

      {intakeMapping ? (
        <CatalogDialog
          title="Manage intakes"
          description="Select active intakes and optionally record a deadline. Empty dates remain unknown."
          wide
          onClose={() => setIntakeMapping(null)}
        >
          <form onSubmit={saveIntakes} className="space-y-4">
            <p className="text-sm font-semibold">
              <FieldLabel
                label="Active intakes and deadlines"
                helpKey="course-intakes.deadline"
              />
            </p>
            {intakes.map((item) => (
              <label
                key={item.id}
                className="grid gap-3 rounded-xl border border-[#E8ECF3] p-3 sm:grid-cols-[auto_1fr_180px]"
              >
                <input
                  type="checkbox"
                  checked={intakeIds.includes(item.id)}
                  onChange={() =>
                    setIntakeIds((current) =>
                      current.includes(item.id)
                        ? current.filter((id) => id !== item.id)
                        : [...current, item.id],
                    )
                  }
                />
                <span>
                  <strong>{item.name}</strong>
                  <small className="block text-[#667085]">
                    {item.shortLabel ?? item.seasonName ?? 'Active intake'}
                  </small>
                </span>
                <input
                  type="date"
                  aria-label={`${item.name} deadline`}
                  value={deadlines[item.id] ?? ''}
                  onChange={(event) =>
                    setDeadlines((current) => ({
                      ...current,
                      [item.id]: event.target.value,
                    }))
                  }
                />
              </label>
            ))}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIntakeMapping(null)}
                className="rounded-lg border px-4 py-2 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-[#1657CF] px-4 py-2 text-sm font-semibold text-white"
              >
                Save intakes
              </button>
            </div>
          </form>
        </CatalogDialog>
      ) : null}
    </section>
  );
}

function Availability({
  mappings,
  countries,
  mapping,
  errors,
  setMapping,
  editMapping,
  saveMapping,
  setPending,
  onReset,
  onEdit,
  onIntakes,
}: {
  mappings: CourseMappingRecord[];
  countries: CountryRecord[];
  mapping: MappingDraft;
  errors: MappingErrors;
  setMapping: (value: MappingDraft) => void;
  editMapping: CourseMappingRecord | null;
  saveMapping: (event: React.FormEvent) => void;
  setPending: (value: Pending) => void;
  onReset: () => void;
  onEdit: (row: CourseMappingRecord) => void;
  onIntakes: (row: CourseMappingRecord) => void;
}) {
  const needsVerification = mapping.availabilityStatus !== 'UNAVAILABLE';

  const field = (
    key: keyof MappingDraft,
    label: string,
    helpKey?: string,
    options: {
      type?: string;
      inputMode?: 'decimal' | 'numeric' | 'text';
      maxLength?: number;
      placeholder?: string;
    } = {},
  ) => (
    <div className="text-sm font-semibold">
      <FieldLabel label={label} htmlFor={`mapping-${key}`} helpKey={helpKey} />
      <input
        id={`mapping-${key}`}
        type={options.type}
        inputMode={options.inputMode}
        maxLength={options.maxLength}
        placeholder={options.placeholder}
        className={inputClass(errors[key])}
        value={String(mapping[key])}
        onChange={(event) => setMapping({ ...mapping, [key]: event.target.value })}
      />
      <ErrorText message={errors[key]} />
    </div>
  );

  return (
    <div className="space-y-5">
      <form
        onSubmit={saveMapping}
        className="rounded-2xl border border-[#E8ECF3] bg-white p-6"
      >
        <h4 className="text-xl font-semibold">
          {editMapping ? 'Edit country mapping' : 'Add country mapping'}
        </h4>
        <p className="mt-2 text-sm text-[#667085]">
          Add where this generic course is available. Available and Limited mappings must include an official source and verification date.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div className="text-sm font-semibold">
            <FieldLabel
              label="Country"
              htmlFor="mapping-countryId"
              required
              help={commonFieldHelp.country}
            />
            <select
              id="mapping-countryId"
              required
              className={inputClass(errors.countryId)}
              value={mapping.countryId}
              onChange={(event) =>
                setMapping({ ...mapping, countryId: event.target.value })
              }
            >
              <option value="">Select published country</option>
              {countries.map((country) => (
                <option key={country.id} value={country.id}>
                  {country.name}
                </option>
              ))}
            </select>
            <ErrorText message={errors.countryId} />
            {!countries.length ? (
              <p className="mt-2 text-xs font-normal text-[#B54708]">
                No published countries are available. Publish a Country first.
              </p>
            ) : null}
          </div>

          <div className="text-sm font-semibold">
            <FieldLabel
              label="Availability status"
              htmlFor="mapping-availabilityStatus"
              helpKey="course-mappings.availabilityStatus"
            />
            <select
              id="mapping-availabilityStatus"
              className={inputClass(errors.availabilityStatus)}
              value={mapping.availabilityStatus}
              onChange={(event) =>
                setMapping({ ...mapping, availabilityStatus: event.target.value })
              }
            >
              <option value="AVAILABLE">Available</option>
              <option value="LIMITED">Limited</option>
              <option value="UNAVAILABLE">Unavailable</option>
            </select>
            <ErrorText message={errors.availabilityStatus} />
          </div>

          <div className="text-sm font-semibold">
            <FieldLabel
              label="Record status"
              htmlFor="mapping-status"
              help={commonFieldHelp.status}
            />
            <select
              id="mapping-status"
              className={inputClass(errors.status)}
              value={mapping.status}
              onChange={(event) =>
                setMapping({ ...mapping, status: event.target.value })
              }
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
            <ErrorText message={errors.status} />
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-4">
          {field(
            'indicativeTuitionMin',
            'Tuition min',
            'course-mappings.indicativeTuitionMin',
            { inputMode: 'decimal' },
          )}
          {field(
            'indicativeTuitionMax',
            'Tuition max',
            'course-mappings.indicativeTuitionMax',
            { inputMode: 'decimal' },
          )}
          {field(
            'currencyCode',
            'Currency (ISO 4217)',
            'course-mappings.currencyCode',
            { maxLength: 3, placeholder: 'GBP' },
          )}
          <div className="text-sm font-semibold">
            <FieldLabel
              label="Tuition period"
              htmlFor="mapping-tuitionPeriod"
              helpKey="course-mappings.tuitionPeriod"
            />
            <select
              id="mapping-tuitionPeriod"
              className={inputClass(errors.tuitionPeriod)}
              value={mapping.tuitionPeriod}
              onChange={(event) =>
                setMapping({ ...mapping, tuitionPeriod: event.target.value })
              }
            >
              <option value="PER_YEAR">Per year</option>
              <option value="PER_SEMESTER">Per semester</option>
              <option value="PER_MONTH">Per month</option>
              <option value="TOTAL">Total</option>
            </select>
            <ErrorText message={errors.tuitionPeriod} />
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {field(
            'applicationFeeMin',
            'Application fee min',
            'course-mappings.applicationFeeMin',
            { inputMode: 'decimal' },
          )}
          {field(
            'applicationFeeMax',
            'Application fee max',
            'course-mappings.applicationFeeMax',
            { inputMode: 'decimal' },
          )}
          {field(
            'workExperienceMonths',
            'Work experience (months)',
            'course-mappings.workExperienceMonths',
            { inputMode: 'numeric' },
          )}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {field(
            'academicMinPercentage',
            'Academic minimum %',
            'course-mappings.academicMinPercentage',
            { inputMode: 'decimal' },
          )}
          {field(
            'academicMinCgpa',
            'Academic minimum CGPA',
            'course-mappings.academicMinCgpa',
            { inputMode: 'decimal' },
          )}
          {field('ieltsMinScore', 'IELTS minimum', 'course-mappings.ieltsMinScore', {
            inputMode: 'decimal',
          })}
          {field('pteMinScore', 'PTE minimum', 'course-mappings.pteMinScore', {
            inputMode: 'decimal',
          })}
          {field(
            'toeflMinScore',
            'TOEFL minimum',
            'course-mappings.toeflMinScore',
            { inputMode: 'decimal' },
          )}
          {field(
            'duolingoMinScore',
            'Duolingo minimum',
            'course-mappings.duolingoMinScore',
            { inputMode: 'decimal' },
          )}
          {field(
            'durationMinOverride',
            'Duration min',
            'course-mappings.durationMinOverride',
            { inputMode: 'decimal' },
          )}
          {field(
            'durationMaxOverride',
            'Duration max',
            'course-mappings.durationMaxOverride',
            { inputMode: 'decimal' },
          )}

          <div className="text-sm font-semibold">
            <FieldLabel
              label="Duration unit"
              htmlFor="mapping-durationUnitOverride"
              helpKey="course-mappings.durationUnitOverride"
            />
            <select
              id="mapping-durationUnitOverride"
              className={inputClass(errors.durationUnitOverride)}
              value={mapping.durationUnitOverride}
              onChange={(event) =>
                setMapping({ ...mapping, durationUnitOverride: event.target.value })
              }
            >
              <option value="">Use course duration unit</option>
              <option value="MONTHS">Months</option>
              <option value="YEARS">Years</option>
            </select>
            <ErrorText message={errors.durationUnitOverride} />
          </div>

          <div className="text-sm font-semibold">
            <FieldLabel
              label="Official HTTPS source"
              htmlFor="mapping-sourceReference"
              required={needsVerification}
              helpKey="course-mappings.sourceReference"
            />
            <input
              id="mapping-sourceReference"
              type="url"
              required={needsVerification}
              placeholder="https://official-source.example/..."
              className={inputClass(errors.sourceReference)}
              value={mapping.sourceReference}
              onChange={(event) =>
                setMapping({ ...mapping, sourceReference: event.target.value })
              }
            />
            <ErrorText message={errors.sourceReference} />
          </div>

          <div className="text-sm font-semibold">
            <FieldLabel
              label="Verified date"
              htmlFor="mapping-verifiedAt"
              required={needsVerification}
              helpKey="course-mappings.verifiedAt"
            />
            <input
              id="mapping-verifiedAt"
              type="date"
              required={needsVerification}
              max={new Date().toISOString().slice(0, 10)}
              className={inputClass(errors.verifiedAt)}
              value={mapping.verifiedAt}
              onChange={(event) =>
                setMapping({ ...mapping, verifiedAt: event.target.value })
              }
            />
            <ErrorText message={errors.verifiedAt} />
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="text-sm font-semibold">
            <FieldLabel
              label="Admission requirements"
              htmlFor="mapping-admissionRequirements"
              helpKey="course-mappings.admissionRequirements"
            />
            <textarea
              id="mapping-admissionRequirements"
              className={inputClass(errors.admissionRequirements)}
              value={mapping.admissionRequirements}
              onChange={(event) =>
                setMapping({ ...mapping, admissionRequirements: event.target.value })
              }
            />
            <ErrorText message={errors.admissionRequirements} />
          </div>

          <div className="text-sm font-semibold">
            <FieldLabel
              label="English requirements"
              htmlFor="mapping-englishRequirements"
              helpKey="course-mappings.englishRequirements"
            />
            <textarea
              id="mapping-englishRequirements"
              className={inputClass(errors.englishRequirements)}
              value={mapping.englishRequirements}
              onChange={(event) =>
                setMapping({ ...mapping, englishRequirements: event.target.value })
              }
            />
            <ErrorText message={errors.englishRequirements} />
          </div>

          <div className="text-sm font-semibold">
            <FieldLabel
              label="Application notes"
              htmlFor="mapping-applicationNotes"
              helpKey="course-mappings.applicationNotes"
            />
            <textarea
              id="mapping-applicationNotes"
              className={inputClass(errors.applicationNotes)}
              value={mapping.applicationNotes}
              onChange={(event) =>
                setMapping({ ...mapping, applicationNotes: event.target.value })
              }
            />
            <ErrorText message={errors.applicationNotes} />
          </div>

          <div className="text-sm font-semibold">
            <FieldLabel
              label="Career opportunities"
              htmlFor="mapping-careerOpportunities"
              helpKey="course-mappings.careerOpportunities"
            />
            <textarea
              id="mapping-careerOpportunities"
              className={inputClass(errors.careerOpportunities)}
              value={mapping.careerOpportunities}
              onChange={(event) =>
                setMapping({ ...mapping, careerOpportunities: event.target.value })
              }
            />
            <ErrorText message={errors.careerOpportunities} />
          </div>
        </div>

        <div className="mt-4 max-w-xs text-sm font-semibold">
          <FieldLabel
            label="Display order"
            htmlFor="mapping-displayOrder"
            help={commonFieldHelp.displayOrder}
          />
          <input
            id="mapping-displayOrder"
            type="number"
            min={0}
            max={999999}
            className={inputClass(errors.displayOrder)}
            value={mapping.displayOrder}
            onChange={(event) =>
              setMapping({ ...mapping, displayOrder: event.target.value })
            }
          />
          <ErrorText message={errors.displayOrder} />
        </div>

        <div className="mt-4 flex flex-wrap gap-5 text-sm font-semibold">
          <div className="flex items-center gap-2">
            <input
              id="mapping-scholarshipAvailable"
              type="checkbox"
              checked={mapping.scholarshipAvailable}
              onChange={(event) =>
                setMapping({ ...mapping, scholarshipAvailable: event.target.checked })
              }
            />
            <FieldLabel
              label="Scholarship available"
              htmlFor="mapping-scholarshipAvailable"
              helpKey="course-mappings.scholarshipAvailable"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="mapping-isFeatured"
              type="checkbox"
              checked={mapping.isFeatured}
              onChange={(event) =>
                setMapping({ ...mapping, isFeatured: event.target.checked })
              }
            />
            <FieldLabel
              label="Featured mapping"
              htmlFor="mapping-isFeatured"
              help={commonFieldHelp.featured}
            />
          </div>
        </div>

        <p className="mt-4 text-xs leading-5 text-[#667085]">
          Available or Limited mappings require an official HTTPS source and a verification date. Unavailable mappings may leave those fields blank.
        </p>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onReset}
            className="rounded-lg border px-4 py-2 text-sm font-semibold"
          >
            Reset
          </button>
          <button
            type="submit"
            className="rounded-lg bg-[#1657CF] px-4 py-2 text-sm font-semibold text-white"
          >
            {editMapping ? 'Update mapping' : 'Add mapping'}
          </button>
        </div>
      </form>

      <div className="space-y-3">
        {mappings.length ? (
          [...mappings]
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map((row) => (
              <article
                key={row.id}
                className="rounded-2xl border border-[#E8ECF3] bg-white p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 className="font-semibold">{row.country.name}</h4>
                    <p className="mt-1 text-xs text-[#667085]">
                      {row.availabilityStatus} · {row.status} ·{' '}
                      {row.currencyCode ?? 'Currency unknown'} ·{' '}
                      {row.sourceReference && row.verifiedAt
                        ? `Verified ${row.verifiedAt.slice(0, 10)}`
                        : 'Verification required'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(row)}
                      className="rounded-lg border px-3 py-2 text-sm font-semibold"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onIntakes(row)}
                      className="rounded-lg border px-3 py-2 text-sm font-semibold"
                    >
                      Intakes
                    </button>
                    <button
                      type="button"
                      onClick={() => setPending({ type: 'mapping', id: row.id })}
                      className="rounded-lg border border-[#F2C5C5] px-3 py-2 text-sm font-semibold text-[#B42318]"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </article>
            ))
        ) : (
          <p className="rounded-xl border border-dashed border-[#D9E0EA] p-4 text-sm text-[#667085]">
            No country mappings saved yet.
          </p>
        )}
      </div>
    </div>
  );
}

function Content({
  sections,
  section,
  errors,
  setSection,
  editSection,
  saveSection,
  setPending,
  onReset,
  onEdit,
  media,
}: {
  sections: CourseSectionRecord[];
  section: SectionDraft;
  errors: SectionErrors;
  setSection: (value: SectionDraft) => void;
  editSection: CourseSectionRecord | null;
  saveSection: (event: React.FormEvent) => void;
  setPending: (value: Pending) => void;
  onReset: () => void;
  onEdit: (row: CourseSectionRecord) => void;
  media: EditorialMedia[];
}) {
  const bodyRequired = !(section.sectionType === 'MEDIA' && section.mediaId);
  return (
    <div className="space-y-5">
      <form
        onSubmit={saveSection}
        className="rounded-2xl border border-[#E8ECF3] bg-white p-6"
      >
        <h4 className="text-xl font-semibold">
          {editSection ? 'Edit content section' : 'Add content section'}
        </h4>
        <p className="mt-2 text-sm text-[#667085]">
          Write normal content below. Universta converts it to the structured format internally; you do not need to write JSON.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="text-sm font-semibold">
            <FieldLabel
              label="Section key"
              htmlFor="section-sectionKey"
              helpKey="course-sections.sectionKey"
            />
            <select
              id="section-sectionKey"
              className={inputClass(errors.sectionKey)}
              value={section.sectionKey}
              onChange={(event) =>
                setSection({ ...section, sectionKey: event.target.value })
              }
            >
              {[
                ['curriculum', 'Curriculum'],
                ['skills', 'Skills'],
                ['admission-requirements', 'Admission requirements'],
                ['documents', 'Documents'],
                ['career-outcomes', 'Career outcomes'],
                ['application-process', 'Application process'],
                ['source-trust', 'Source / trust information'],
                ['counselling-cta', 'Counselling call-to-action'],
              ].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <ErrorText message={errors.sectionKey} />
          </div>

          <div className="text-sm font-semibold">
            <FieldLabel
              label="Section type"
              htmlFor="section-sectionType"
              helpKey="course-sections.sectionType"
            />
            <select
              id="section-sectionType"
              className={inputClass(errors.sectionType)}
              value={section.sectionType}
              onChange={(event) =>
                setSection({ ...section, sectionType: event.target.value })
              }
            >
              <option value="RICH_TEXT">Rich text</option>
              <option value="FACT_GRID">Fact grid</option>
              <option value="CARD_GRID">Card grid</option>
              <option value="STEPS">Steps</option>
              <option value="CHECKLIST">Checklist</option>
              <option value="CTA">Call to action</option>
              <option value="MEDIA">Media</option>
            </select>
            <ErrorText message={errors.sectionType} />
          </div>

          <div className="text-sm font-semibold">
            <FieldLabel
              label="Heading"
              htmlFor="section-heading"
              required
              helpKey="course-sections.heading"
            />
            <input
              id="section-heading"
              required
              maxLength={500}
              className={inputClass(errors.heading)}
              value={section.heading}
              onChange={(event) =>
                setSection({ ...section, heading: event.target.value })
              }
            />
            <ErrorText message={errors.heading} />
          </div>

          <div className="text-sm font-semibold">
            <FieldLabel
              label="Subheading"
              htmlFor="section-subheading"
              helpKey="course-sections.subheading"
            />
            <input
              id="section-subheading"
              maxLength={5000}
              className={inputClass(errors.subheading)}
              value={section.subheading}
              onChange={(event) =>
                setSection({ ...section, subheading: event.target.value })
              }
            />
            <ErrorText message={errors.subheading} />
          </div>

          <div className="text-sm font-semibold">
            <FieldLabel
              label="Display order"
              htmlFor="section-displayOrder"
              help={commonFieldHelp.displayOrder}
            />
            <input
              id="section-displayOrder"
              type="number"
              min={0}
              max={999999}
              className={inputClass(errors.displayOrder)}
              value={section.displayOrder}
              onChange={(event) =>
                setSection({ ...section, displayOrder: event.target.value })
              }
            />
            <ErrorText message={errors.displayOrder} />
          </div>

          <div className="text-sm font-semibold">
            <FieldLabel
              label="Status"
              htmlFor="section-status"
              help={commonFieldHelp.status}
            />
            <select
              id="section-status"
              className={inputClass(errors.status)}
              value={section.status}
              onChange={(event) =>
                setSection({ ...section, status: event.target.value })
              }
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
            <ErrorText message={errors.status} />
          </div>

          <MediaPickerDialog
            label="Section media"
            value={section.mediaId}
            media={media}
            onChange={(value) => setSection({ ...section, mediaId: value })}
          />
        </div>

        <div className="mt-4 block text-sm font-semibold">
          <FieldLabel
            label="Body content"
            htmlFor="section-bodyText"
            required={bodyRequired}
            helpKey="course-sections.bodyJson"
          />
          <textarea
            id="section-bodyText"
            required={bodyRequired}
            className={`${inputClass(errors.bodyText)} min-h-40 leading-6`}
            value={section.bodyText}
            onChange={(event) =>
              setSection({ ...section, bodyText: event.target.value })
            }
            placeholder={
              section.sectionType === 'CHECKLIST' || section.sectionType === 'STEPS'
                ? 'Write one item per line.'
                : 'Write the section content normally. Use a blank line for a new paragraph.'
            }
          />
          <ErrorText message={errors.bodyText} />
          <p className="mt-2 text-xs font-normal text-[#667085]">
            No JSON required. For Checklist and Steps, use one item per line.
          </p>
        </div>

        <div className="mt-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onReset}
            className="rounded-lg border px-4 py-2 text-sm font-semibold"
          >
            Reset
          </button>
          <button
            type="submit"
            className="rounded-lg bg-[#1657CF] px-4 py-2 text-sm font-semibold text-white"
          >
            {editSection ? 'Update section' : 'Add section'}
          </button>
        </div>
      </form>

      <div className="space-y-3">
        {sections.length ? (
          [...sections]
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map((row) => (
              <article
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E8ECF3] bg-white p-4"
              >
                <span>
                  <strong>{row.heading || row.sectionKey}</strong>
                  <small className="ml-2 text-[#667085]">
                    {row.sectionType} · {row.status} · order {row.displayOrder}
                  </small>
                </span>
                <span className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => onEdit(row)}
                    className="font-semibold text-[#1657CF]"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setPending({ type: 'section', id: row.id })}
                    className="font-semibold text-[#B42318]"
                  >
                    Remove
                  </button>
                </span>
              </article>
            ))
        ) : (
          <p className="rounded-xl border border-dashed border-[#D9E0EA] p-4 text-sm text-[#667085]">
            No content sections saved yet.
          </p>
        )}
      </div>
    </div>
  );
}

function Faqs({
  faqs,
  faq,
  setFaq,
  editFaq,
  saveFaq,
  setPending,
  onReset,
  onEdit,
}: {
  faqs: CourseFaqRecord[];
  faq: FaqDraft;
  setFaq: (value: FaqDraft) => void;
  editFaq: CourseFaqRecord | null;
  saveFaq: (event: React.FormEvent) => void;
  setPending: (value: Pending) => void;
  onReset: () => void;
  onEdit: (row: CourseFaqRecord) => void;
}) {
  return (
    <div className="space-y-5">
      <form
        onSubmit={saveFaq}
        className="rounded-2xl border border-[#E8ECF3] bg-white p-6"
      >
        <h4 className="text-xl font-semibold">{editFaq ? 'Edit FAQ' : 'Add FAQ'}</h4>
        <div className="mt-5 block text-sm font-semibold">
          <FieldLabel
            label="Question"
            htmlFor="faq-question"
            required
            helpKey="course-faqs.question"
          />
          <input
            id="faq-question"
            required
            maxLength={1000}
            className="mt-2 w-full rounded-lg border border-[#D9E0EA] px-3 py-2 font-normal"
            value={faq.question}
            onChange={(event) => setFaq({ ...faq, question: event.target.value })}
          />
        </div>
        <div className="mt-4 block text-sm font-semibold">
          <FieldLabel
            label="Answer"
            htmlFor="faq-answer"
            required
            helpKey="course-faqs.answer"
          />
          <textarea
            id="faq-answer"
            required
            maxLength={30000}
            className="mt-2 min-h-28 w-full rounded-lg border border-[#D9E0EA] px-3 py-2 font-normal"
            value={faq.answer}
            onChange={(event) => setFaq({ ...faq, answer: event.target.value })}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <div className="text-sm font-semibold">
            <FieldLabel
              label="Display order"
              htmlFor="faq-display-order"
              help={commonFieldHelp.displayOrder}
            />
            <input
              id="faq-display-order"
              type="number"
              min={0}
              max={999999}
              className="mt-2 w-32 rounded-lg border border-[#D9E0EA] px-3 py-2 font-normal"
              value={faq.displayOrder}
              onChange={(event) => setFaq({ ...faq, displayOrder: event.target.value })}
            />
          </div>
          <div className="text-sm font-semibold">
            <FieldLabel
              label="Status"
              htmlFor="faq-status"
              help={commonFieldHelp.status}
            />
            <select
              id="faq-status"
              className="mt-2 rounded-lg border border-[#D9E0EA] px-3 py-2 font-normal"
              value={faq.status}
              onChange={(event) => setFaq({ ...faq, status: event.target.value })}
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onReset}
            className="rounded-lg border px-4 py-2 text-sm font-semibold"
          >
            Reset
          </button>
          <button
            type="submit"
            className="rounded-lg bg-[#1657CF] px-4 py-2 text-sm font-semibold text-white"
          >
            {editFaq ? 'Update FAQ' : 'Add FAQ'}
          </button>
        </div>
      </form>

      {[...faqs]
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((row) => (
          <article
            key={row.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E8ECF3] bg-white p-4"
          >
            <span>
              <strong>{row.question}</strong>
              <small className="ml-2 text-[#667085]">{row.status}</small>
            </span>
            <span className="flex gap-3">
              <button
                type="button"
                onClick={() => onEdit(row)}
                className="font-semibold text-[#1657CF]"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => setPending({ type: 'faq', id: row.id })}
                className="font-semibold text-[#B42318]"
              >
                Remove
              </button>
            </span>
          </article>
        ))}
    </div>
  );
}

function Related({
  related,
  options,
  selected,
  setSelected,
  query,
  setQuery,
  save,
}: {
  related: CourseRelatedRecord[];
  options: CourseRecord[];
  selected: string[];
  setSelected: (value: string[]) => void;
  query: string;
  setQuery: (value: string) => void;
  save: () => Promise<void>;
}) {
  return (
    <section className="rounded-2xl border border-[#E8ECF3] bg-white p-6">
      <h4 className="text-xl font-semibold">Related courses</h4>
      <p className="mt-2 text-sm text-[#667085]">
        Select published or draft courses. The API prevents self-relations and duplicates transactionally.
      </p>
      <div className="mt-4">
        <FieldLabel label="Search related courses" helpKey="course-related.selection" />
        <input
          aria-label="Search related courses"
          className="mt-2 w-full rounded-lg border border-[#D9E0EA] px-3 py-2"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search courses"
        />
      </div>
      <div className="mt-4 grid gap-2">
        {options.slice(0, 20).map((item) => (
          <label
            key={item.id}
            className="flex items-center gap-3 rounded-lg border border-[#E8ECF3] p-3 text-sm"
          >
            <input
              type="checkbox"
              checked={selected.includes(item.id)}
              onChange={() =>
                setSelected(
                  selected.includes(item.id)
                    ? selected.filter((id) => id !== item.id)
                    : [...selected, item.id],
                )
              }
            />
            {item.name}
            <span className="ml-auto text-xs text-[#667085]">{item.status}</span>
          </label>
        ))}
      </div>
      <p className="mt-4 text-xs text-[#667085]">Saved relations: {related.length}</p>
      <button
        type="button"
        onClick={() => void save()}
        className="mt-5 rounded-lg bg-[#1657CF] px-4 py-2 text-sm font-semibold text-white"
      >
        Save related courses
      </button>
    </section>
  );
}
