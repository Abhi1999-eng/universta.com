'use client';

import Link from 'next/link';
import { useEffect, useId, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createCourse,
  createCourseFaq,
  createCourseMapping,
  createCourseSection,
  deleteCourseFaq,
  deleteCourseMapping,
  deleteCourseSection,
  deleteCourseSeo,
  getAdminCourse,
  getCourseSeo,
  listAdminCourses,
  listCountries,
  listCourseFaqs,
  listCourseLevels,
  listCourseMappings,
  listCourseRelated,
  listCourseSections,
  listEditorialMedia,
  listIntakeOptions,
  listStudyModes,
  listSubjects,
  listSubSubjects,
  publishCourse,
  replaceCourseIntakes,
  replaceCourseModes,
  replaceCourseRelated,
  saveCourseSeo,
  unpublishCourse,
  updateCourse,
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
  MasterRecord,
  SubjectRecord,
  SubSubjectRecord,
} from './catalog.types';
import { MediaPickerDialog } from './editorial/MediaPickerDialog';
import { FieldLabel } from '@/features/shared/FieldLabel';
import { UnifiedEditorActions } from '@/features/shared/UnifiedEditorActions';
import { blankUnifiedSeo, seoPayload, UnifiedSeoFields, type UnifiedSeoDraft } from '@/features/shared/UnifiedSeoFields';

type Intent = 'draft' | 'publish';
type CoreState = {
  subjectId: string;
  subSubjectId: string;
  courseLevelId: string;
  name: string;
  shortName: string;
  qualificationName: string;
  slug: string;
  courseCode: string;
  shortDescription: string;
  overview: string;
  durationMin: string;
  durationMax: string;
  durationUnit: string;
  credits: string;
  careerSummary: string;
  popularityScore: string;
  isFeatured: boolean;
  displayOrder: string;
  featuredMediaId: string;
};
type IntakeDraft = { intakeId: string; applicationDeadline: string };
type MappingDraft = {
  id?: string;
  updatedAt?: string;
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
  intakes: IntakeDraft[];
};
type SectionDraft = {
  id?: string;
  updatedAt?: string;
  sectionKey: string;
  sectionType: string;
  heading: string;
  subheading: string;
  bodyText: string;
  mediaId: string;
  status: string;
  displayOrder: string;
};
type FaqDraft = {
  id?: string;
  updatedAt?: string;
  question: string;
  answer: string;
  status: string;
  displayOrder: string;
};

const coreBlank: CoreState = {
  subjectId: '',
  subSubjectId: '',
  courseLevelId: '',
  name: '',
  shortName: '',
  qualificationName: '',
  slug: '',
  courseCode: '',
  shortDescription: '',
  overview: '',
  durationMin: '',
  durationMax: '',
  durationUnit: 'YEARS',
  credits: '',
  careerSummary: '',
  popularityScore: '',
  isFeatured: false,
  displayOrder: '0',
  featuredMediaId: '',
};
const mappingBlank = (): MappingDraft => ({
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
  intakes: [],
});
const sectionBlank = (): SectionDraft => ({ sectionKey: 'curriculum', sectionType: 'RICH_TEXT', heading: '', subheading: '', bodyText: '', mediaId: '', status: 'ACTIVE', displayOrder: '0' });
const faqBlank = (): FaqDraft => ({ question: '', answer: '', status: 'ACTIVE', displayOrder: '0' });
const input = 'mt-2 w-full rounded-xl border border-[#D9E0EA] bg-white px-4 py-3 text-sm font-normal outline-none focus:border-[#1657CF] focus:ring-2 focus:ring-[#DCE8FF]';
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const decimalPattern = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;
const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-');
const optional = (value: string) => value.trim() ? value.trim() : undefined;
const hasSeo = (value: UnifiedSeoDraft) => Boolean(value.seoTitle.trim() || value.metaDescription.trim() || value.canonicalUrl.trim() || value.focusKeyword.trim() || value.ogTitle.trim() || value.ogDescription.trim() || value.ogMediaId || value.twitterTitle.trim() || value.twitterDescription.trim() || value.twitterMediaId);
const seoFromRecord = (row: EditorialSeo | null): UnifiedSeoDraft => row ? {
  seoTitle: row.seoTitle ?? '',
  metaDescription: row.metaDescription ?? '',
  canonicalUrl: row.canonicalUrl ?? '',
  focusKeyword: row.focusKeyword ?? '',
  ogTitle: row.ogTitle ?? '',
  ogDescription: row.ogDescription ?? '',
  ogMediaId: row.ogMediaId ?? '',
  twitterTitle: row.twitterTitle ?? '',
  twitterDescription: row.twitterDescription ?? '',
  twitterMediaId: row.twitterMediaId ?? '',
  robotsIndex: row.robotsIndex,
  robotsFollow: row.robotsFollow,
} : blankUnifiedSeo;

function mappingFromRecord(row: CourseMappingRecord): MappingDraft {
  return {
    id: row.id,
    updatedAt: row.updatedAt,
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
    workExperienceMonths: row.workExperienceMonths === null ? '' : String(row.workExperienceMonths),
    scholarshipAvailable: row.scholarshipAvailable,
    admissionRequirements: row.admissionRequirements ?? '',
    englishRequirements: row.englishRequirements ?? '',
    applicationNotes: row.applicationNotes ?? '',
    careerOpportunities: row.careerOpportunities ?? '',
    sourceReference: row.sourceReference ?? '',
    verifiedAt: row.verifiedAt ? row.verifiedAt.slice(0, 10) : '',
    isFeatured: row.isFeatured,
    displayOrder: String(row.displayOrder),
    intakes: (row.intakes ?? []).map((raw) => {
      const item = raw as Record<string, unknown>;
      const nested = item.intake as Record<string, unknown> | undefined;
      return {
        intakeId: String(item.intakeId ?? nested?.id ?? ''),
        applicationDeadline: item.applicationDeadline ? String(item.applicationDeadline).slice(0, 10) : item.deadline ? String(item.deadline).slice(0, 10) : '',
      };
    }).filter((item) => item.intakeId),
  };
}

function sectionBodyText(body: Record<string, unknown> | null) {
  if (!body) return '';
  if (Array.isArray(body.paragraphs)) return body.paragraphs.filter((x): x is string => typeof x === 'string').join('\n\n');
  const values: string[] = [];
  const collect = (value: unknown) => {
    if (typeof value === 'string' || typeof value === 'number') values.push(String(value));
    else if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === 'object') Object.values(value as Record<string, unknown>).forEach(collect);
  };
  collect(body);
  return values.join('\n');
}

function sectionFromRecord(row: CourseSectionRecord): SectionDraft {
  return {
    id: row.id,
    updatedAt: row.updatedAt,
    sectionKey: row.sectionKey,
    sectionType: row.sectionType,
    heading: row.heading ?? '',
    subheading: row.subheading ?? '',
    bodyText: sectionBodyText(row.bodyJson),
    mediaId: row.media?.id ?? '',
    status: row.status,
    displayOrder: String(row.displayOrder),
  };
}
function faqFromRecord(row: CourseFaqRecord): FaqDraft {
  return { id: row.id, updatedAt: row.updatedAt, question: row.question, answer: row.answer, status: row.status, displayOrder: String(row.displayOrder) };
}
function bodyJson(text: string, type: string) {
  const paragraphs = text.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
  const lines = text.split(/\n+/).map((x) => x.trim()).filter(Boolean);
  if (type === 'CHECKLIST') return { paragraphs, items: lines };
  if (type === 'STEPS') return { paragraphs, steps: lines.map((value, index) => ({ order: index + 1, text: value })) };
  return { paragraphs };
}

export function CourseForm({ id }: { id?: string }) {
  const router = useRouter();
  const [record, setRecord] = useState<CourseRecord | null>(null);
  const [existingSeo, setExistingSeo] = useState<EditorialSeo | null>(null);
  const [core, setCore] = useState<CoreState>(coreBlank);
  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [specializations, setSpecializations] = useState<SubSubjectRecord[]>([]);
  const [levels, setLevels] = useState<MasterRecord[]>([]);
  const [modes, setModes] = useState<MasterRecord[]>([]);
  const [selectedModes, setSelectedModes] = useState<string[]>([]);
  const [media, setMedia] = useState<EditorialMedia[]>([]);
  const [countries, setCountries] = useState<CountryRecord[]>([]);
  const [intakeOptions, setIntakeOptions] = useState<IntakeOption[]>([]);
  const [allCourses, setAllCourses] = useState<CourseRecord[]>([]);
  const [mappings, setMappings] = useState<MappingDraft[]>(() => [mappingBlank()]);
  const [sections, setSections] = useState<SectionDraft[]>(() => [sectionBlank()]);
  const [faqs, setFaqs] = useState<FaqDraft[]>(() => [faqBlank()]);
  const [relatedIds, setRelatedIds] = useState<string[]>([]);
  const [seo, setSeo] = useState<UnifiedSeoDraft>(blankUnifiedSeo);
  const [removedMappings, setRemovedMappings] = useState<MappingDraft[]>([]);
  const [removedSections, setRemovedSections] = useState<SectionDraft[]>([]);
  const [removedFaqs, setRemovedFaqs] = useState<FaqDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingIntent, setSavingIntent] = useState<Intent | null>(null);
  const [error, setError] = useState('');
  const [issues, setIssues] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const base = await Promise.all([
          listSubjects({ limit: 100 }),
          listCourseLevels({ status: 'ACTIVE', limit: 100 }),
          listStudyModes({ status: 'ACTIVE', limit: 100 }),
          listEditorialMedia({ limit: 50 }),
          listCountries({ status: 'PUBLISHED', limit: 100 }),
          listIntakeOptions(),
          listAdminCourses({ limit: 100 }),
        ]);
        if (!active) return;
        setSubjects(base[0].data);
        setLevels(base[1].data);
        setModes(base[2].data);
        setMedia(base[3].data);
        setCountries(base[4].data);
        setIntakeOptions(base[5].data);
        setAllCourses(base[6].data);
        if (!id) return;

        const [courseResult, mappingResult, sectionResult, faqResult, relatedResult, seoResult] = await Promise.all([
          getAdminCourse(id),
          listCourseMappings(id),
          listCourseSections(id),
          listCourseFaqs(id),
          listCourseRelated(id),
          getCourseSeo(id),
        ]);
        if (!active) return;
        const course = courseResult.data;
        const loadedMappings = mappingResult.data.map(mappingFromRecord);
        const loadedSections = sectionResult.data.map(sectionFromRecord);
        const loadedFaqs = faqResult.data.map(faqFromRecord);
        setRecord(course);
        setCore({
          subjectId: course.subject.id,
          subSubjectId: course.subSubject?.id ?? '',
          courseLevelId: course.courseLevel.id,
          name: course.name,
          shortName: course.shortName ?? '',
          qualificationName: course.qualificationName ?? '',
          slug: course.slug,
          courseCode: course.courseCode ?? '',
          shortDescription: course.shortDescription ?? '',
          overview: course.overview ?? '',
          durationMin: course.durationMin ?? '',
          durationMax: course.durationMax ?? '',
          durationUnit: course.durationUnit ?? 'YEARS',
          credits: course.credits ?? '',
          careerSummary: course.careerSummary ?? '',
          popularityScore: course.popularityScore ?? '',
          isFeatured: course.featured,
          displayOrder: String(course.displayOrder),
          featuredMediaId: course.featuredMedia?.id ?? '',
        });
        setSelectedModes(course.studyModes.map((mode) => mode.id));
        setMappings(loadedMappings.length ? loadedMappings : [mappingBlank()]);
        setSections(loadedSections.length ? loadedSections : [sectionBlank()]);
        setFaqs(loadedFaqs.length ? loadedFaqs : [faqBlank()]);
        setRelatedIds(relatedResult.data.map((row: CourseRelatedRecord) => row.relatedCourse.id));
        setExistingSeo(seoResult.data);
        setSeo(seoFromRecord(seoResult.data));
        const subResult = await listSubSubjects(course.subject.id, { limit: 100 });
        if (active) setSpecializations(subResult.data);
      } catch (cause: unknown) {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load course editor');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    if (!core.subjectId) {
      const timer = window.setTimeout(() => setSpecializations([]), 0);
      return () => window.clearTimeout(timer);
    }
    let active = true;
    void listSubSubjects(core.subjectId, { limit: 100 })
      .then((result) => {
        if (!active) return;
        setSpecializations(result.data);
        setCore((current) => current.subSubjectId && !result.data.some((row) => row.id === current.subSubjectId) ? { ...current, subSubjectId: '' } : current);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [core.subjectId]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (dirty) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const setCoreField = <K extends keyof CoreState>(key: K, value: CoreState[K]) => {
    setCore((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setIssues([]);
  };
  const updateMapping = (index: number, patch: Partial<MappingDraft>) => {
    setMappings((rows) => rows.map((row, i) => i === index ? { ...row, ...patch } : row));
    setDirty(true);
  };
  const updateSection = (index: number, patch: Partial<SectionDraft>) => {
    setSections((rows) => rows.map((row, i) => i === index ? { ...row, ...patch } : row));
    setDirty(true);
  };
  const updateFaq = (index: number, patch: Partial<FaqDraft>) => {
    setFaqs((rows) => rows.map((row, i) => i === index ? { ...row, ...patch } : row));
    setDirty(true);
  };
  const removeMapping = (index: number) => {
    const row = mappings[index];
    if (row.id) setRemovedMappings((old) => [...old, row]);
    setMappings((rows) => {
      const next = rows.filter((_, i) => i !== index);
      return next.length ? next : [mappingBlank()];
    });
    setDirty(true);
  };
  const removeSection = (index: number) => {
    const row = sections[index];
    if (row.id) setRemovedSections((old) => [...old, row]);
    setSections((rows) => {
      const next = rows.filter((_, i) => i !== index);
      return next.length ? next : [sectionBlank()];
    });
    setDirty(true);
  };
  const removeFaq = (index: number) => {
    const row = faqs[index];
    if (row.id) setRemovedFaqs((old) => [...old, row]);
    setFaqs((rows) => {
      const next = rows.filter((_, i) => i !== index);
      return next.length ? next : [faqBlank()];
    });
    setDirty(true);
  };
  const toggleMode = (modeId: string) => {
    setSelectedModes((ids) => ids.includes(modeId) ? ids.filter((idValue) => idValue !== modeId) : [...ids, modeId]);
    setDirty(true);
  };
  const toggleRelated = (courseId: string) => {
    setRelatedIds((ids) => ids.includes(courseId) ? ids.filter((idValue) => idValue !== courseId) : [...ids, courseId]);
    setDirty(true);
  };

  const activeMappings = useMemo(() => mappings.filter((row) => row.id || row.countryId || row.sourceReference || row.indicativeTuitionMin || row.indicativeTuitionMax), [mappings]);
  const activeSections = useMemo(() => sections.filter((row) => row.id || row.heading.trim() || row.bodyText.trim()), [sections]);
  const activeFaqs = useMemo(() => faqs.filter((row) => row.id || row.question.trim() || row.answer.trim()), [faqs]);

  function validate(intent: Intent) {
    const next: string[] = [];
    if (!core.subjectId) next.push('Subject is required.');
    if (!core.courseLevelId) next.push('Course level is required.');
    if (!core.name.trim()) next.push('Course name is required.');
    if (core.slug && !slugPattern.test(core.slug)) next.push('Course slug must use lowercase letters, numbers and single hyphens.');
    if (!/^\d+$/.test(core.displayOrder) || Number(core.displayOrder) > 999999) next.push('Course display order must be 0-999999.');
    for (const [value, label] of [[core.durationMin, 'Minimum duration'], [core.durationMax, 'Maximum duration'], [core.credits, 'Credits'], [core.popularityScore, 'Popularity score']] as const) {
      if (value && !decimalPattern.test(value)) next.push(`${label} must be a non-negative number with at most 2 decimal places.`);
    }
    if (core.durationMin && core.durationMax && Number(core.durationMin) > Number(core.durationMax)) next.push('Minimum duration cannot exceed maximum duration.');
    activeMappings.forEach((row, index) => {
      const label = `Availability ${index + 1}`;
      if (!row.countryId) next.push(`${label}: country is required.`);
      if (!/^\d+$/.test(row.displayOrder) || Number(row.displayOrder) > 999999) next.push(`${label}: display order must be 0-999999.`);
      if (row.currencyCode && !/^[A-Za-z]{3}$/.test(row.currencyCode.trim())) next.push(`${label}: currency must be a 3-letter code.`);
      if (row.availabilityStatus !== 'UNAVAILABLE') {
        if (!/^https:\/\//i.test(row.sourceReference.trim())) next.push(`${label}: an official HTTPS source is required.`);
        if (!row.verifiedAt) next.push(`${label}: verified date is required.`);
      }
    });
    activeSections.forEach((row, index) => {
      if (!row.sectionKey.trim()) next.push(`Content section ${index + 1}: section key is required.`);
      if (!/^\d+$/.test(row.displayOrder)) next.push(`Content section ${index + 1}: display order must be a whole number.`);
    });
    activeFaqs.forEach((row, index) => {
      if (!row.question.trim() || !row.answer.trim()) next.push(`FAQ ${index + 1}: both question and answer are required.`);
    });
    if (hasSeo(seo) && (!seo.seoTitle.trim() || !seo.metaDescription.trim())) next.push('SEO title and meta description are both required when SEO is configured.');
    if (intent === 'publish') {
      const subject = subjects.find((row) => row.id === core.subjectId);
      if (subject && subject.status !== 'PUBLISHED') next.push('Selected Subject must be published before this Course.');
      const specialization = specializations.find((row) => row.id === core.subSubjectId);
      if (specialization && specialization.status !== 'PUBLISHED') next.push('Selected Specialization must be published before this Course.');
      if (selectedModes.length === 0) next.push('Select at least one Study mode before publishing.');
      const verified = activeMappings.some((row) => ['AVAILABLE', 'LIMITED'].includes(row.availabilityStatus) && /^https:\/\//i.test(row.sourceReference.trim()) && Boolean(row.verifiedAt));
      if (!verified) next.push('Publish requires at least one Available/Limited country with source URL and verified date.');
    }
    setIssues(next);
    return next.length === 0;
  }

  function mappingPayload(row: MappingDraft) {
    const data: Record<string, unknown> = {
      countryId: row.countryId,
      availabilityStatus: row.availabilityStatus,
      status: row.status,
      tuitionPeriod: row.tuitionPeriod,
      scholarshipAvailable: row.scholarshipAvailable,
      isFeatured: row.isFeatured,
      displayOrder: Number(row.displayOrder) || 0,
    };
    const stringKeys = ['indicativeTuitionMin','indicativeTuitionMax','currencyCode','applicationFeeMin','applicationFeeMax','durationMinOverride','durationMaxOverride','durationUnitOverride','academicMinPercentage','academicMinCgpa','ieltsMinScore','pteMinScore','toeflMinScore','duolingoMinScore','admissionRequirements','englishRequirements','applicationNotes','careerOpportunities','sourceReference','verifiedAt'] as const;
    stringKeys.forEach((key) => {
      const value = row[key].trim();
      if (value) data[key] = key === 'currencyCode' ? value.toUpperCase() : value;
    });
    if (row.workExperienceMonths) data.workExperienceMonths = Number(row.workExperienceMonths);
    if (row.updatedAt) data.expectedUpdatedAt = row.updatedAt;
    return data;
  }

  async function syncMappings(courseId: string) {
    for (const row of removedMappings) if (row.id) await deleteCourseMapping(courseId, row.id, row.updatedAt);
    const saved: MappingDraft[] = [];
    for (const row of activeMappings) {
      const result = row.id ? await updateCourseMapping(courseId, row.id, mappingPayload(row)) : await createCourseMapping(courseId, mappingPayload(row));
      const current = result.data;
      await replaceCourseIntakes(
        courseId,
        current.id,
        row.intakes.filter((item) => item.intakeId).map((item) => ({ intakeId: item.intakeId, ...(item.applicationDeadline ? { applicationDeadline: item.applicationDeadline } : {}), status: 'ACTIVE' })),
        current.updatedAt,
      );
      saved.push({ ...mappingFromRecord(current), intakes: row.intakes });
    }
    setMappings(saved.length ? saved : [mappingBlank()]);
    setRemovedMappings([]);
  }

  async function syncSections(courseId: string) {
    for (const row of removedSections) if (row.id) await deleteCourseSection(courseId, row.id, row.updatedAt);
    const saved: SectionDraft[] = [];
    for (const row of activeSections) {
      const payload = {
        sectionKey: row.sectionKey.trim(),
        sectionType: row.sectionType,
        heading: optional(row.heading),
        subheading: optional(row.subheading),
        bodyJson: bodyJson(row.bodyText, row.sectionType),
        ...(row.mediaId ? { mediaId: row.mediaId } : {}),
        status: row.status,
        displayOrder: Number(row.displayOrder) || 0,
        ...(row.updatedAt ? { expectedUpdatedAt: row.updatedAt } : {}),
      };
      const result = row.id ? await updateCourseSection(courseId, row.id, payload) : await createCourseSection(courseId, payload);
      saved.push(sectionFromRecord(result.data));
    }
    setSections(saved.length ? saved : [sectionBlank()]);
    setRemovedSections([]);
  }

  async function syncFaqs(courseId: string) {
    for (const row of removedFaqs) if (row.id) await deleteCourseFaq(courseId, row.id, row.updatedAt);
    const saved: FaqDraft[] = [];
    for (const row of activeFaqs) {
      const payload = {
        question: row.question.trim(),
        answer: row.answer.trim(),
        status: row.status,
        displayOrder: Number(row.displayOrder) || 0,
        ...(row.updatedAt ? { expectedUpdatedAt: row.updatedAt } : {}),
      };
      const result = row.id ? await updateCourseFaq(courseId, row.id, payload) : await createCourseFaq(courseId, payload);
      saved.push(faqFromRecord(result.data));
    }
    setFaqs(saved.length ? saved : [faqBlank()]);
    setRemovedFaqs([]);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const intent: Intent = submitter?.value === 'publish' ? 'publish' : 'draft';
    if (!validate(intent)) return;
    setSaving(true);
    setSavingIntent(intent);
    setError('');
    try {
      const corePayload = {
        subjectId: core.subjectId,
        subSubjectId: optional(core.subSubjectId),
        courseLevelId: core.courseLevelId,
        name: core.name.trim(),
        shortName: optional(core.shortName),
        qualificationName: optional(core.qualificationName),
        slug: optional(core.slug) ?? slugify(core.name),
        courseCode: optional(core.courseCode),
        shortDescription: optional(core.shortDescription),
        overview: optional(core.overview),
        durationMin: optional(core.durationMin),
        durationMax: optional(core.durationMax),
        durationUnit: optional(core.durationUnit),
        credits: optional(core.credits),
        careerSummary: optional(core.careerSummary),
        popularityScore: optional(core.popularityScore),
        isFeatured: core.isFeatured,
        displayOrder: Number(core.displayOrder) || 0,
        ...(core.featuredMediaId ? { featuredMediaId: core.featuredMediaId } : {}),
        ...(record ? { expectedUpdatedAt: record.updatedAt } : {}),
      };
      let saved = record ? (await updateCourse(record.id, corePayload)).data : (await createCourse(corePayload)).data;
      saved = (await replaceCourseModes(saved.id, selectedModes, saved.updatedAt)).data;
      await syncMappings(saved.id);
      await syncSections(saved.id);
      await syncFaqs(saved.id);
      await replaceCourseRelated(saved.id, relatedIds.map((relatedCourseId, index) => ({ relatedCourseId, relationshipType: 'RELATED', displayOrder: index })));
      if (hasSeo(seo)) {
        const result = await saveCourseSeo(saved.id, seoPayload(seo));
        setExistingSeo(result.data);
      } else if (existingSeo) {
        await deleteCourseSeo(saved.id, existingSeo.updatedAt);
        setExistingSeo(null);
      }
      const refreshed = (await getAdminCourse(saved.id)).data;
      const finalRecord = intent === 'publish'
        ? (refreshed.status === 'PUBLISHED' ? refreshed : (await publishCourse(refreshed.id, refreshed.updatedAt)).data)
        : (refreshed.status === 'PUBLISHED' ? (await unpublishCourse(refreshed.id, refreshed.updatedAt)).data : refreshed);
      setRecord(finalRecord);
      setDirty(false);
      if (!id) router.replace(`/courses/${finalRecord.id}`);
      router.refresh();
    } catch (cause: unknown) {
      const typed = cause as Partial<CatalogMutationError>;
      setError(typed.message ?? (cause instanceof Error ? cause.message : 'Unable to save course'));
    } finally {
      setSaving(false);
      setSavingIntent(null);
    }
  }

  if (loading) return <section className="mx-auto max-w-[1100px] rounded-2xl border border-[#E8ECF3] bg-white p-8"><p className="text-sm text-[#667085]">Loading complete course editor…</p></section>;

  return (
    <section className="mx-auto max-w-[1180px]" aria-labelledby="course-form-heading">
      <Link href="/courses" className="text-sm font-semibold text-[#1657CF]">← Courses</Link>
      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#828B9B]">Unified course editor</p>
          <h2 id="course-form-heading" className="mt-2 text-3xl font-semibold">{record ? 'Edit course' : 'Create course'}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#667085]">Core data, availability, content, FAQs, related courses and SEO load on one page and save together.</p>
          <p className="mt-2 text-xs font-semibold text-[#667085]"><span className="font-bold text-[#D92D20]">*</span> Required field. Some fields are required only when a section is used or when publishing.</p>
        </div>
        <span className="rounded-full border border-[#D9E0EA] px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#667085]">{record?.status ?? 'DRAFT'}</span>
      </div>
      {error ? <p role="alert" className="mt-5 rounded-xl border border-[#F2C5C5] bg-[#FFF7F7] px-4 py-3 text-sm font-semibold text-[#B42318]">{error}</p> : null}
      {issues.length ? <div role="alert" className="mt-5 rounded-xl border border-[#F2C5C5] bg-[#FFF7F7] p-4 text-sm text-[#B42318]"><p className="font-semibold">Fix these fields:</p><ul className="mt-2 list-disc space-y-1 pl-5">{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul></div> : null}

      <form onSubmit={submit} className="mt-8 space-y-6">
        <EditorCard eyebrow="Course" title="Basic information" description="Identity, classification and public summary.">
          <div className="grid gap-5 sm:grid-cols-2">
            <Select label="Subject" value={core.subjectId} onChange={(value) => setCoreField('subjectId', value)} options={subjects.map((row) => ({ id: row.id, label: `${row.name}${row.status !== 'PUBLISHED' ? ' · Draft' : ''}` }))} required />
            <Select label="Specialization" value={core.subSubjectId} onChange={(value) => setCoreField('subSubjectId', value)} options={specializations.map((row) => ({ id: row.id, label: `${row.name}${row.status !== 'PUBLISHED' ? ' · Draft' : ''}` }))} emptyLabel="No specialization / General course" />
            <Select label="Course level" value={core.courseLevelId} onChange={(value) => setCoreField('courseLevelId', value)} options={levels.map((row) => ({ id: row.id, label: row.name }))} required />
            <Input label="Course name" value={core.name} onChange={(value) => setCoreField('name', value)} required />
            <Input label="Slug" value={core.slug} onChange={(value) => setCoreField('slug', value)} placeholder="Generated from name" />
            <Input label="Short name" value={core.shortName} onChange={(value) => setCoreField('shortName', value)} />
            <Input label="Qualification" value={core.qualificationName} onChange={(value) => setCoreField('qualificationName', value)} />
            <Input label="Course code" value={core.courseCode} onChange={(value) => setCoreField('courseCode', value)} />
            <Input label="Short description" value={core.shortDescription} onChange={(value) => setCoreField('shortDescription', value)} textarea span />
            <Input label="Overview" value={core.overview} onChange={(value) => setCoreField('overview', value)} textarea span rows={6} />
            <MediaPickerDialog label="Featured media" value={core.featuredMediaId} media={media} onChange={(value) => setCoreField('featuredMediaId', value)} />
            <Input label="Display order" value={core.displayOrder} onChange={(value) => setCoreField('displayOrder', value)} type="number" />
          </div>
          <label className="mt-5 flex items-center gap-3 rounded-xl border border-[#D9E0EA] px-4 py-3 text-sm font-semibold"><input type="checkbox" checked={core.isFeatured} onChange={(event) => setCoreField('isFeatured', event.target.checked)} /> Featured course</label>
        </EditorCard>

        <EditorCard eyebrow="Delivery" title="Study details" description="Duration, credits, career summary and supported study modes.">
          <div className="grid gap-5 sm:grid-cols-3">
            <Input label="Duration minimum" value={core.durationMin} onChange={(value) => setCoreField('durationMin', value)} />
            <Input label="Duration maximum" value={core.durationMax} onChange={(value) => setCoreField('durationMax', value)} />
            <Select label="Duration unit" value={core.durationUnit} onChange={(value) => setCoreField('durationUnit', value)} options={[{ id: 'MONTHS', label: 'Months' }, { id: 'YEARS', label: 'Years' }]} />
            <Input label="Credits" value={core.credits} onChange={(value) => setCoreField('credits', value)} />
            <Input label="Popularity score" value={core.popularityScore} onChange={(value) => setCoreField('popularityScore', value)} />
            <Input label="Career summary" value={core.careerSummary} onChange={(value) => setCoreField('careerSummary', value)} textarea span rows={4} />
          </div>
          <div className="mt-5">
            <div className="flex flex-wrap items-center gap-2"><FieldLabel label="Study modes" required /><span className="text-xs font-medium text-[#667085]">required to publish</span></div>
            <div className="mt-3 flex flex-wrap gap-3">{modes.map((mode) => <label key={mode.id} className="flex items-center gap-2 rounded-xl border border-[#D9E0EA] px-4 py-3 text-sm font-semibold"><input type="checkbox" checked={selectedModes.includes(mode.id)} onChange={() => toggleMode(mode.id)} /> {mode.name}</label>)}</div>
          </div>
        </EditorCard>

        <EditorCard eyebrow="Destinations" title="Country availability" description="The first availability form is always open. Add more countries only when needed.">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-medium text-[#667085]"><span className="font-bold text-[#D92D20]">*</span> At least one complete Available/Limited country mapping is required to publish.</p>
            <button type="button" onClick={() => { setMappings((rows) => [...rows, mappingBlank()]); setDirty(true); }} className="rounded-xl border border-[#1657CF] px-4 py-2 text-sm font-semibold text-[#1657CF]">+ Add another country</button>
          </div>
          <div className="space-y-5">{mappings.map((row, index) => <AvailabilityRow key={row.id ?? `mapping-${index}`} index={index} row={row} countries={countries} intakes={intakeOptions} onChange={(patch) => updateMapping(index, patch)} onRemove={() => removeMapping(index)} />)}</div>
        </EditorCard>

        <EditorCard eyebrow="Editorial" title="Content sections" description="The first content section is open immediately. Add more sections only when needed.">
          <div className="mb-5 flex justify-end"><button type="button" onClick={() => { setSections((rows) => [...rows, sectionBlank()]); setDirty(true); }} className="rounded-xl border border-[#1657CF] px-4 py-2 text-sm font-semibold text-[#1657CF]">+ Add another section</button></div>
          <div className="space-y-5">{sections.map((row, index) => <ContentRow key={row.id ?? `section-${index}`} index={index} row={row} media={media} onChange={(patch) => updateSection(index, patch)} onRemove={() => removeSection(index)} />)}</div>
        </EditorCard>

        <EditorCard eyebrow="Questions" title="FAQs" description="The first FAQ form is open immediately. Leave it completely blank if this course needs no FAQ.">
          <div className="mb-5 flex justify-end"><button type="button" onClick={() => { setFaqs((rows) => [...rows, faqBlank()]); setDirty(true); }} className="rounded-xl border border-[#1657CF] px-4 py-2 text-sm font-semibold text-[#1657CF]">+ Add another FAQ</button></div>
          <div className="space-y-4">{faqs.map((row, index) => <div key={row.id ?? `faq-${index}`} className="rounded-2xl border border-[#E8ECF3] bg-[#FBFCFE] p-5"><div className="flex justify-between gap-3"><h4 className="font-semibold">FAQ {index + 1}</h4>{faqs.length > 1 || row.id ? <button type="button" onClick={() => removeFaq(index)} className="text-sm font-semibold text-[#B42318]">Remove</button> : null}</div><div className="mt-4 grid gap-4 sm:grid-cols-2"><Input label="Question" value={row.question} onChange={(value) => updateFaq(index, { question: value })} span required={Boolean(row.question || row.answer || row.id)} /><Input label="Answer" value={row.answer} onChange={(value) => updateFaq(index, { answer: value })} textarea span rows={4} required={Boolean(row.question || row.answer || row.id)} /><Select label="Status" value={row.status} onChange={(value) => updateFaq(index, { status: value })} options={[{ id: 'ACTIVE', label: 'Active' }, { id: 'INACTIVE', label: 'Inactive' }]} /><Input label="Display order" value={row.displayOrder} onChange={(value) => updateFaq(index, { displayOrder: value })} type="number" /></div></div>)}</div>
        </EditorCard>

        <EditorCard eyebrow="Discovery" title="Related courses" description="Select related courses; changes persist with the main record.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{allCourses.filter((course) => course.id !== record?.id).map((course) => <label key={course.id} className="flex items-start gap-3 rounded-xl border border-[#D9E0EA] p-4 text-sm"><input className="mt-1" type="checkbox" checked={relatedIds.includes(course.id)} onChange={() => toggleRelated(course.id)} /><span><strong className="block text-[#1D2939]">{course.name}</strong><span className="text-xs text-[#667085]">{course.subject.name}</span></span></label>)}</div>
        </EditorCard>

        <UnifiedSeoFields value={seo} onChange={(next) => { setSeo(next); setDirty(true); }} media={media} />
        <UnifiedEditorActions cancelHref="/courses" busy={saving} savingIntent={savingIntent} published={record?.status === 'PUBLISHED'} />
      </form>
    </section>
  );
}

function EditorCard({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: React.ReactNode }) {
  return <fieldset className="rounded-2xl border border-[#E8ECF3] bg-white p-6 sm:p-8"><legend className="sr-only">{title}</legend><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1657CF]">{eyebrow}</p><h3 className="mt-2 text-xl font-semibold text-[#101828]">{title}</h3><p className="mt-2 text-sm leading-6 text-[#667085]">{description}</p><div className="mt-6">{children}</div></fieldset>;
}

function Input({ label, value, onChange, type = 'text', textarea = false, span = false, rows = 3, required = false, placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; textarea?: boolean; span?: boolean; rows?: number; required?: boolean; placeholder?: string }) {
  const reactId = useId();
  const id = `course-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return <div className={`text-sm font-semibold ${span ? 'sm:col-span-full' : ''}`}><FieldLabel label={label} htmlFor={id} required={required} />{textarea ? <textarea id={id} required={required} aria-required={required} rows={rows} className={input} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /> : <input id={id} required={required} aria-required={required} type={type} className={input} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />}</div>;
}

function Select({ label, value, onChange, options, required = false, emptyLabel = 'Select' }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ id: string; label: string }>; required?: boolean; emptyLabel?: string }) {
  const reactId = useId();
  const id = `course-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return <div className="text-sm font-semibold"><FieldLabel label={label} htmlFor={id} required={required} /><select id={id} required={required} aria-required={required} className={input} value={value} onChange={(event) => onChange(event.target.value)}><option value="">{emptyLabel}</option>{options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></div>;
}

function AvailabilityRow({ index, row, countries, intakes, onChange, onRemove }: { index: number; row: MappingDraft; countries: CountryRecord[]; intakes: IntakeOption[]; onChange: (patch: Partial<MappingDraft>) => void; onRemove: () => void }) {
  const selectedIntake = (id: string) => row.intakes.find((item) => item.intakeId === id);
  const toggleIntake = (id: string, checked: boolean) => onChange({ intakes: checked ? [...row.intakes, { intakeId: id, applicationDeadline: '' }] : row.intakes.filter((item) => item.intakeId !== id) });
  const deadline = (id: string, value: string) => onChange({ intakes: row.intakes.map((item) => item.intakeId === id ? { ...item, applicationDeadline: value } : item) });
  const sourceRequired = row.availabilityStatus !== 'UNAVAILABLE' && Boolean(row.countryId || row.sourceReference || row.verifiedAt || row.id);
  return <div className="rounded-2xl border border-[#E8ECF3] bg-[#FBFCFE] p-5"><div className="flex items-center justify-between gap-3"><h4 className="font-semibold">Country availability {index + 1}</h4>{index > 0 || row.id ? <button type="button" onClick={onRemove} className="text-sm font-semibold text-[#B42318]">Remove</button> : null}</div><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Select label="Country" value={row.countryId} onChange={(value) => onChange({ countryId: value })} options={countries.map((country) => ({ id: country.id, label: country.name }))} required={Boolean(row.countryId || row.sourceReference || row.verifiedAt || row.id)} /><Select label="Availability" value={row.availabilityStatus} onChange={(value) => onChange({ availabilityStatus: value })} options={[{ id: 'AVAILABLE', label: 'Available' }, { id: 'LIMITED', label: 'Limited' }, { id: 'UNAVAILABLE', label: 'Unavailable' }]} /><Select label="Status" value={row.status} onChange={(value) => onChange({ status: value })} options={[{ id: 'ACTIVE', label: 'Active' }, { id: 'INACTIVE', label: 'Inactive' }]} /><Input label="Tuition minimum" value={row.indicativeTuitionMin} onChange={(value) => onChange({ indicativeTuitionMin: value })} /><Input label="Tuition maximum" value={row.indicativeTuitionMax} onChange={(value) => onChange({ indicativeTuitionMax: value })} /><Input label="Currency" value={row.currencyCode} onChange={(value) => onChange({ currencyCode: value.toUpperCase() })} /><Select label="Tuition period" value={row.tuitionPeriod} onChange={(value) => onChange({ tuitionPeriod: value })} options={[{ id: 'PER_YEAR', label: 'Per year' }, { id: 'PER_SEMESTER', label: 'Per semester' }, { id: 'TOTAL', label: 'Total' }]} /><Input label="Application fee min" value={row.applicationFeeMin} onChange={(value) => onChange({ applicationFeeMin: value })} /><Input label="Application fee max" value={row.applicationFeeMax} onChange={(value) => onChange({ applicationFeeMax: value })} /><Input label="Academic minimum %" value={row.academicMinPercentage} onChange={(value) => onChange({ academicMinPercentage: value })} /><Input label="Minimum CGPA" value={row.academicMinCgpa} onChange={(value) => onChange({ academicMinCgpa: value })} /><Input label="IELTS minimum" value={row.ieltsMinScore} onChange={(value) => onChange({ ieltsMinScore: value })} /><Input label="PTE minimum" value={row.pteMinScore} onChange={(value) => onChange({ pteMinScore: value })} /><Input label="TOEFL minimum" value={row.toeflMinScore} onChange={(value) => onChange({ toeflMinScore: value })} /><Input label="Duolingo minimum" value={row.duolingoMinScore} onChange={(value) => onChange({ duolingoMinScore: value })} /><Input label="Work experience months" value={row.workExperienceMonths} onChange={(value) => onChange({ workExperienceMonths: value })} /><Input label="Official source URL" value={row.sourceReference} onChange={(value) => onChange({ sourceReference: value })} type="url" required={sourceRequired} /><Input label="Verified date" value={row.verifiedAt} onChange={(value) => onChange({ verifiedAt: value })} type="date" required={sourceRequired} /><Input label="Display order" value={row.displayOrder} onChange={(value) => onChange({ displayOrder: value })} type="number" /><label className="flex items-center gap-3 self-end rounded-xl border border-[#D9E0EA] px-4 py-3 text-sm font-semibold"><input type="checkbox" checked={row.scholarshipAvailable} onChange={(event) => onChange({ scholarshipAvailable: event.target.checked })} /> Scholarship available</label><label className="flex items-center gap-3 self-end rounded-xl border border-[#D9E0EA] px-4 py-3 text-sm font-semibold"><input type="checkbox" checked={row.isFeatured} onChange={(event) => onChange({ isFeatured: event.target.checked })} /> Featured mapping</label><Input label="Admission requirements" value={row.admissionRequirements} onChange={(value) => onChange({ admissionRequirements: value })} textarea span /><Input label="English requirements" value={row.englishRequirements} onChange={(value) => onChange({ englishRequirements: value })} textarea span /><Input label="Application notes" value={row.applicationNotes} onChange={(value) => onChange({ applicationNotes: value })} textarea span /><Input label="Career opportunities" value={row.careerOpportunities} onChange={(value) => onChange({ careerOpportunities: value })} textarea span /></div><div className="mt-5"><p className="text-sm font-semibold">Intakes</p><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{intakes.map((intake) => { const selected = selectedIntake(intake.id); return <div key={intake.id} className="rounded-xl border border-[#D9E0EA] p-3"><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={Boolean(selected)} onChange={(event) => toggleIntake(intake.id, event.target.checked)} /> {intake.name}</label>{selected ? <input aria-label={`${intake.name} deadline`} type="date" className={input} value={selected.applicationDeadline} onChange={(event) => deadline(intake.id, event.target.value)} /> : null}</div>; })}</div></div></div>;
}

function ContentRow({ index, row, media, onChange, onRemove }: { index: number; row: SectionDraft; media: EditorialMedia[]; onChange: (patch: Partial<SectionDraft>) => void; onRemove: () => void }) {
  const sectionUsed = Boolean(row.id || row.heading.trim() || row.bodyText.trim() || row.subheading.trim() || row.mediaId);
  return <div className="rounded-2xl border border-[#E8ECF3] bg-[#FBFCFE] p-5"><div className="flex justify-between gap-3"><h4 className="font-semibold">Content section {index + 1}</h4>{index > 0 || row.id ? <button type="button" onClick={onRemove} className="text-sm font-semibold text-[#B42318]">Remove</button> : null}</div><div className="mt-4 grid gap-4 sm:grid-cols-2"><Input label="Section key" value={row.sectionKey} onChange={(value) => onChange({ sectionKey: value })} required={sectionUsed} /><Select label="Section type" value={row.sectionType} onChange={(value) => onChange({ sectionType: value })} options={['RICH_TEXT','CHECKLIST','STEPS','FACT_GRID','CARD_GRID'].map((id) => ({ id, label: id.replaceAll('_', ' ') }))} required={sectionUsed} /><Input label="Heading" value={row.heading} onChange={(value) => onChange({ heading: value })} /><Input label="Subheading" value={row.subheading} onChange={(value) => onChange({ subheading: value })} /><Input label="Body" value={row.bodyText} onChange={(value) => onChange({ bodyText: value })} textarea span rows={6} /><MediaPickerDialog label="Section media" value={row.mediaId} media={media} onChange={(value) => onChange({ mediaId: value })} /><Select label="Status" value={row.status} onChange={(value) => onChange({ status: value })} options={[{ id: 'ACTIVE', label: 'Active' }, { id: 'INACTIVE', label: 'Inactive' }]} /><Input label="Display order" value={row.displayOrder} onChange={(value) => onChange({ displayOrder: value })} type="number" /></div></div>;
}
