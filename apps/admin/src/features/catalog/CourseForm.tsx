'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CatalogError, CatalogLoading } from './CatalogDialog';
import {
  createCourse,
  getAdminCourse,
  listCourseLevels,
  listEditorialMedia,
  listStudyModes,
  listSubjects,
  listSubSubjects,
  publishCourse,
  replaceCourseModes,
  updateCourse,
} from './catalog-client';
import { CourseEditorialWorkspace } from './CourseEditorialWorkspace';
import { MediaPickerDialog } from './editorial/MediaPickerDialog';
import type {
  CatalogMutationError,
  CourseRecord,
  EditorialMedia,
  MasterRecord,
  SubjectRecord,
  SubSubjectRecord,
} from './catalog.types';
import { FieldLabel } from '@/features/shared/FieldLabel';
import { FieldHelpIcon } from '@/features/shared/FieldHelpIcon';
import { commonFieldHelp } from '@/lib/field-help/common';
import { getFieldHelp } from '@/lib/field-help/registry';

type FormState = {
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

type ValidationKey =
  | keyof FormState
  | 'studyModes'
  | 'availability';

type ValidationErrors = Partial<Record<ValidationKey, string>>;

type ReadinessDetail = { field?: unknown; message?: unknown };

const empty: FormState = {
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

const decimalPattern = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const fieldIds: Partial<Record<ValidationKey, string>> = {
  subjectId: 'course-subject',
  subSubjectId: 'course-specialization',
  courseLevelId: 'course-level',
  name: 'course-name',
  shortName: 'course-short-name',
  qualificationName: 'course-qualification',
  slug: 'course-slug',
  courseCode: 'course-code',
  shortDescription: 'course-short-description',
  overview: 'course-overview',
  durationMin: 'course-duration-min',
  durationMax: 'course-duration-max',
  credits: 'course-credits',
  careerSummary: 'course-career-summary',
  popularityScore: 'course-popularity-score',
  displayOrder: 'course-display-order',
  studyModes: 'course-study-modes',
  availability: 'course-availability-requirement',
};

function clean(form: FormState) {
  const result: Record<string, unknown> = {
    subjectId: form.subjectId,
    courseLevelId: form.courseLevelId,
    name: form.name.trim(),
    isFeatured: form.isFeatured,
    displayOrder: Number(form.displayOrder) || 0,
    ...(form.featuredMediaId ? { featuredMediaId: form.featuredMediaId } : {}),
  };
  for (const key of [
    'subSubjectId',
    'shortName',
    'qualificationName',
    'slug',
    'courseCode',
    'shortDescription',
    'overview',
    'durationMin',
    'durationMax',
    'durationUnit',
    'credits',
    'careerSummary',
    'popularityScore',
  ] as const) {
    if (form[key]) result[key] = form[key].trim();
  }
  return result;
}

function inputClass(error?: string) {
  return `mt-2 w-full rounded-xl border px-3 py-3 font-normal outline-none transition ${
    error
      ? 'border-[#D92D20] bg-[#FFF8F7] ring-2 ring-[#FEE4E2] focus:border-[#D92D20]'
      : 'border-[#D9E0EA] focus:border-[#1657CF] focus:ring-2 focus:ring-[#DCE8FF]'
  }`;
}

function ErrorText({ message }: { message?: string }) {
  return message ? (
    <p className="mt-2 text-xs font-semibold text-[#B42318]">{message}</p>
  ) : null;
}

function uniqueMessages(errors: ValidationErrors) {
  return [...new Set(Object.values(errors).filter(Boolean))] as string[];
}

function serverReadinessErrors(details: unknown): ValidationErrors {
  if (!Array.isArray(details)) return {};
  const result: ValidationErrors = {};
  for (const item of details as ReadinessDetail[]) {
    if (!item || typeof item !== 'object' || typeof item.message !== 'string') {
      continue;
    }
    const message = item.message;
    switch (item.field) {
      case 'core':
        result.name = message;
        result.slug = message;
        break;
      case 'subject':
        result.subjectId = message;
        break;
      case 'subSubject':
        result.subSubjectId = message.replace('Sub-Subject', 'Specialization');
        break;
      case 'courseLevel':
        result.courseLevelId = message;
        break;
      case 'studyModes':
        result.studyModes = message;
        break;
      case 'countries':
        result.availability = message;
        break;
      default:
        break;
    }
  }
  return result;
}

function publishReadiness(course: CourseRecord): ValidationErrors {
  const result: ValidationErrors = {};
  if (!course.name || !course.slug) {
    result.name = 'Course name and generated slug are required before publishing.';
    result.slug = 'A valid slug is required before publishing.';
  }
  if (course.subject.status !== 'PUBLISHED') {
    result.subjectId = 'Selected Subject must be published before this course.';
  }
  if (course.subSubject && course.subSubject.status !== 'PUBLISHED') {
    result.subSubjectId = 'Selected Specialization must be published before this course.';
  }
  if (course.courseLevel.status !== 'ACTIVE') {
    result.courseLevelId = 'Selected Course level must be active.';
  }
  if (!course.studyModes.some((mode) => mode.status === 'ACTIVE')) {
    result.studyModes = 'Select at least one active Study mode before publishing.';
  }
  const hasVerifiedCountry = course.countries.some((raw) => {
    const mapping = raw as {
      availabilityStatus?: string;
      status?: string;
      sourceReference?: string | null;
      verifiedAt?: string | null;
      country?: { status?: string; deletedAt?: unknown };
    };
    return (
      mapping.status === 'ACTIVE' &&
      ['AVAILABLE', 'LIMITED'].includes(mapping.availabilityStatus ?? '') &&
      mapping.country?.status === 'PUBLISHED' &&
      !mapping.country?.deletedAt &&
      Boolean(mapping.sourceReference) &&
      Boolean(mapping.verifiedAt)
    );
  });
  if (!hasVerifiedCountry) {
    result.availability =
      'Add at least one active Available/Limited country mapping with a published country, HTTPS source reference and verification date.';
  }
  return result;
}

export function CourseForm({ id }: { id?: string }) {
  const router = useRouter();
  const [record, setRecord] = useState<CourseRecord | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [specializations, setSpecializations] = useState<SubSubjectRecord[]>([]);
  const [specializationsSubjectId, setSpecializationsSubjectId] = useState('');
  const [levels, setLevels] = useState<MasterRecord[]>([]);
  const [modes, setModes] = useState<MasterRecord[]>([]);
  const [media, setMedia] = useState<EditorialMedia[]>([]);
  const [selectedModes, setSelectedModes] = useState<string[]>([]);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [savingIntent, setSavingIntent] = useState<'draft' | 'publish' | null>(null);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const studyModesHelp = getFieldHelp('courses.studyModes');
  const loadingSpecializations =
    Boolean(form.subjectId) && specializationsSubjectId !== form.subjectId;

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      listSubjects({ limit: 100 }),
      listCourseLevels({ status: 'ACTIVE', limit: 100 }),
      listStudyModes({ status: 'ACTIVE', limit: 100 }),
      listEditorialMedia({ limit: 50 }),
      id ? getAdminCourse(id) : Promise.resolve(null),
    ])
      .then(([subjectResult, levelResult, modeResult, mediaResult, courseResult]) => {
        if (cancelled) return;
        setSubjects(subjectResult.data);
        setLevels(levelResult.data);
        setModes(modeResult.data);
        setMedia(mediaResult.data);
        if (courseResult) {
          setRecord(courseResult.data);
          const c = courseResult.data;
          setForm({
            subjectId: c.subject.id,
            subSubjectId: c.subSubject?.id ?? '',
            courseLevelId: c.courseLevel.id,
            name: c.name,
            shortName: c.shortName ?? '',
            qualificationName: c.qualificationName ?? '',
            slug: c.slug,
            courseCode: c.courseCode ?? '',
            shortDescription: c.shortDescription ?? '',
            overview: c.overview ?? '',
            durationMin: c.durationMin ?? '',
            durationMax: c.durationMax ?? '',
            durationUnit: c.durationUnit ?? 'YEARS',
            credits: c.credits ?? '',
            careerSummary: c.careerSummary ?? '',
            popularityScore: c.popularityScore ?? '',
            isFeatured: c.featured,
            displayOrder: String(c.displayOrder),
            featuredMediaId: c.featuredMedia?.id ?? '',
          });
          setSelectedModes(c.studyModes.map((mode) => mode.id));
        }
      })
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Unable to load course options'),
      )
      .finally(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    const subjectId = form.subjectId;
    if (!subjectId) return;
    let cancelled = false;
    void listSubSubjects(subjectId, { limit: 100 })
      .then((result) => {
        if (cancelled) return;
        setSpecializations(result.data);
        setSpecializationsSubjectId(subjectId);
        setForm((current) => {
          if (
            current.subSubjectId &&
            !result.data.some((item) => item.id === current.subSubjectId)
          ) {
            return { ...current, subSubjectId: '' };
          }
          return current;
        });
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setSpecializations([]);
        setSpecializationsSubjectId(subjectId);
        setError(
          cause instanceof Error
            ? cause.message
            : 'Unable to load specializations for this subject',
        );
      });
    return () => {
      cancelled = true;
    };
  }, [form.subjectId]);

  function clearValidation(key: ValidationKey) {
    setValidationErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function set(key: keyof FormState, value: string | boolean) {
    setForm((current) => ({ ...current, [key]: value }));
    clearValidation(key);
  }

  function setSubject(subjectId: string) {
    setSpecializations([]);
    setSpecializationsSubjectId('');
    setForm((current) => ({ ...current, subjectId, subSubjectId: '' }));
    clearValidation('subjectId');
    clearValidation('subSubjectId');
  }

  function toggleMode(modeId: string) {
    setSelectedModes((current) =>
      current.includes(modeId)
        ? current.filter((idValue) => idValue !== modeId)
        : [...current, modeId],
    );
    clearValidation('studyModes');
  }

  function validate(intent: 'draft' | 'publish'): ValidationErrors {
    const errors: ValidationErrors = {};
    const trimmedName = form.name.trim();
    if (!form.subjectId) errors.subjectId = 'Subject is required.';
    if (!form.courseLevelId) errors.courseLevelId = 'Course level is required.';
    if (!trimmedName) errors.name = 'Course name is required.';
    else if (trimmedName.length > 255) errors.name = 'Course name must be 255 characters or fewer.';

    if (form.shortName.length > 150) errors.shortName = 'Short name must be 150 characters or fewer.';
    if (form.qualificationName.length > 255) errors.qualificationName = 'Qualification must be 255 characters or fewer.';
    if (form.slug && (!slugPattern.test(form.slug) || form.slug.length > 255)) {
      errors.slug = 'Use lowercase letters, numbers and single hyphens only.';
    }
    if (form.courseCode.length > 100) errors.courseCode = 'Course code must be 100 characters or fewer.';
    if (form.shortDescription.length > 1000) errors.shortDescription = 'Short description must be 1,000 characters or fewer.';
    if (form.overview.length > 20000) errors.overview = 'Overview must be 20,000 characters or fewer.';
    if (form.careerSummary.length > 20000) errors.careerSummary = 'Career summary must be 20,000 characters or fewer.';

    for (const [key, label] of [
      ['durationMin', 'Minimum duration'],
      ['durationMax', 'Maximum duration'],
      ['credits', 'Credits'],
      ['popularityScore', 'Popularity score'],
    ] as const) {
      const value = form[key];
      if (value && !decimalPattern.test(value)) {
        errors[key] = `${label} must be a non-negative number with at most 2 decimal places.`;
      }
    }
    if (
      form.durationMin &&
      form.durationMax &&
      decimalPattern.test(form.durationMin) &&
      decimalPattern.test(form.durationMax) &&
      Number(form.durationMin) > Number(form.durationMax)
    ) {
      errors.durationMin = 'Minimum duration cannot be greater than maximum duration.';
      errors.durationMax = 'Maximum duration cannot be less than minimum duration.';
    }
    if (
      form.displayOrder === '' ||
      !/^\d+$/.test(form.displayOrder) ||
      Number(form.displayOrder) < 0 ||
      Number(form.displayOrder) > 999999
    ) {
      errors.displayOrder = 'Display order must be a whole number from 0 to 999999.';
    }

    if (intent === 'publish') {
      const subject = subjects.find((item) => item.id === form.subjectId);
      if (subject && subject.status !== 'PUBLISHED') {
        errors.subjectId = 'Selected Subject must be published before this course.';
      }
      const specialization = specializations.find((item) => item.id === form.subSubjectId);
      if (form.subSubjectId && specialization && specialization.status !== 'PUBLISHED') {
        errors.subSubjectId = 'Selected Specialization must be published before this course.';
      }
      if (!selectedModes.length) {
        errors.studyModes = 'Select at least one Study mode before publishing.';
      }
    }
    return errors;
  }

  function focusFirst(errors: ValidationErrors) {
    const firstKey = Object.keys(errors)[0] as ValidationKey | undefined;
    if (!firstKey) return;
    const targetId = fieldIds[firstKey];
    if (!targetId) return;
    window.setTimeout(() => {
      const element = document.getElementById(targetId);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (element instanceof HTMLElement && 'focus' in element) element.focus();
    }, 0);
  }

  function applyValidation(errors: ValidationErrors, summary: string) {
    setValidationErrors(errors);
    setError(summary);
    focusFirst(errors);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const intent: 'draft' | 'publish' = submitter?.value === 'publish' ? 'publish' : 'draft';
    const localErrors = validate(intent);
    if (Object.keys(localErrors).length) {
      applyValidation(localErrors, 'Fix the highlighted fields before continuing.');
      return;
    }

    setSaving(true);
    setSavingIntent(intent);
    setError('');
    setValidationErrors({});
    try {
      const result = record
        ? await updateCourse(record.id, {
            ...clean(form),
            expectedUpdatedAt: record.updatedAt,
          })
        : await createCourse(clean(form));
      const modesResult = await replaceCourseModes(
        result.data.id,
        selectedModes,
        result.data.updatedAt,
      );
      setRecord(modesResult.data);

      if (intent === 'publish') {
        const readiness = publishReadiness(modesResult.data);
        if (Object.keys(readiness).length) {
          applyValidation(
            readiness,
            'Course is saved as a draft. Complete the highlighted publishing requirements.',
          );
          return;
        }
        const published = await publishCourse(modesResult.data.id, modesResult.data.updatedAt);
        setRecord(published.data);
      }
      router.push(`/courses/${result.data.id}`);
    } catch (cause: unknown) {
      const typed = cause as Partial<CatalogMutationError>;
      const readiness = serverReadinessErrors(typed.details);
      if (Object.keys(readiness).length) {
        applyValidation(
          readiness,
          typed.message ?? 'Complete the highlighted publishing requirements.',
        );
      } else {
        setError(
          typed.message ??
            (intent === 'publish' ? 'Unable to publish course' : 'Unable to save course'),
        );
      }
    } finally {
      setSaving(false);
      setSavingIntent(null);
    }
  }

  if (loading) return <CatalogLoading label="Loading course editor…" />;

  const validationMessages = uniqueMessages(validationErrors);
  const status = record?.status ?? 'NOT SAVED';

  return (
    <section aria-labelledby="course-form-heading" className="mx-auto max-w-[1100px]">
      <Link href="/courses" className="text-sm font-semibold text-[#1657CF]">← Courses</Link>
      <p className="mt-8 text-xs font-bold uppercase tracking-[0.16em] text-[#828B9B]">Course editor</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h2 id="course-form-heading" className="text-3xl font-semibold">{record ? 'Edit course' : 'Create course'}</h2>
        <span className={`rounded-full px-3 py-1 text-xs font-bold tracking-wide ${status === 'PUBLISHED' ? 'bg-[#ECFDF3] text-[#027A48]' : 'bg-[#F2F4F7] text-[#475467]'}`}>
          STATUS: {status}
        </span>
      </div>

      {error ? <div className="mt-5"><CatalogError message={error} onRetry={() => setError('')} /></div> : null}
      {validationMessages.length ? (
        <div className="mt-4 rounded-xl border border-[#FECACA] bg-[#FFF7F7] px-4 py-3 text-sm text-[#B42318]">
          <p className="font-semibold">Please fix:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">{validationMessages.map((message) => <li key={message}>{message}</li>)}</ul>
        </div>
      ) : null}

      <form noValidate onSubmit={submit} className="mt-8 space-y-7 rounded-2xl border border-[#E8ECF3] bg-white p-6 sm:p-8">
        <div className="grid gap-5 sm:grid-cols-3">
          <div className="text-sm font-semibold">
            <FieldLabel label="Subject" htmlFor="course-subject" required help={commonFieldHelp.subject} />
            <select id="course-subject" className={inputClass(validationErrors.subjectId)} value={form.subjectId} onChange={(event) => setSubject(event.target.value)}>
              <option value="">Select subject</option>
              {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}{subject.status !== 'PUBLISHED' ? ` — ${subject.status}` : ''}</option>)}
            </select>
            <ErrorText message={validationErrors.subjectId} />
          </div>
          <div className="text-sm font-semibold">
            <FieldLabel label="Course level" htmlFor="course-level" required helpKey="courses.courseLevelId" />
            <select id="course-level" className={inputClass(validationErrors.courseLevelId)} value={form.courseLevelId} onChange={(event) => set('courseLevelId', event.target.value)}>
              <option value="">Select level</option>
              {levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}
            </select>
            <ErrorText message={validationErrors.courseLevelId} />
          </div>
          <div className="text-sm font-semibold">
            <FieldLabel label="Specialization" htmlFor="course-specialization" helpKey="courses.subSubjectId" />
            <select
              id="course-specialization"
              className={`${inputClass(validationErrors.subSubjectId)} disabled:bg-[#F7F9FC] disabled:text-[#98A2B3]`}
              value={form.subSubjectId}
              disabled={!form.subjectId || loadingSpecializations}
              onChange={(event) => set('subSubjectId', event.target.value)}
            >
              <option value="">{!form.subjectId ? 'Select a subject first' : loadingSpecializations ? 'Loading specializations…' : 'No specialization / General course'}</option>
              {specializations.map((specialization) => <option key={specialization.id} value={specialization.id}>{specialization.name}{specialization.status !== 'PUBLISHED' ? ` — ${specialization.status}` : ''}</option>)}
            </select>
            <ErrorText message={validationErrors.subSubjectId} />
            {form.subjectId && !loadingSpecializations && !validationErrors.subSubjectId ? (
              <p className="mt-2 text-xs font-normal text-[#667085]">{specializations.length ? 'Only specializations created under the selected Subject are shown.' : 'No specializations have been created under this Subject yet.'}</p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="text-sm font-semibold">
            <FieldLabel label="Course name" htmlFor="course-name" required help={commonFieldHelp.name} />
            <input id="course-name" maxLength={255} className={inputClass(validationErrors.name)} value={form.name} onChange={(event) => set('name', event.target.value)} />
            <ErrorText message={validationErrors.name} />
          </div>
          <div className="text-sm font-semibold">
            <FieldLabel label="Slug" htmlFor="course-slug" help={commonFieldHelp.slug} />
            <input id="course-slug" className={inputClass(validationErrors.slug)} value={form.slug} onChange={(event) => set('slug', event.target.value)} placeholder="Optional; generated from course name" />
            <ErrorText message={validationErrors.slug} />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          <div className="text-sm font-semibold">
            <FieldLabel label="Short name" htmlFor="course-short-name" helpKey="courses.shortName" />
            <input id="course-short-name" className={inputClass(validationErrors.shortName)} value={form.shortName} onChange={(event) => set('shortName', event.target.value)} />
            <ErrorText message={validationErrors.shortName} />
          </div>
          <div className="text-sm font-semibold">
            <FieldLabel label="Qualification" htmlFor="course-qualification" helpKey="courses.qualificationName" />
            <input id="course-qualification" className={inputClass(validationErrors.qualificationName)} value={form.qualificationName} onChange={(event) => set('qualificationName', event.target.value)} />
            <ErrorText message={validationErrors.qualificationName} />
          </div>
          <MediaPickerDialog label="Featured course media" value={form.featuredMediaId} media={media} onChange={(value) => set('featuredMediaId', value)} />
          <div className="text-sm font-semibold">
            <FieldLabel label="Course code" htmlFor="course-code" helpKey="courses.courseCode" />
            <input id="course-code" className={inputClass(validationErrors.courseCode)} value={form.courseCode} onChange={(event) => set('courseCode', event.target.value)} />
            <ErrorText message={validationErrors.courseCode} />
          </div>
        </div>

        <div className="block text-sm font-semibold">
          <FieldLabel label="Short description" htmlFor="course-short-description" help={commonFieldHelp.shortDescription} />
          <textarea id="course-short-description" maxLength={1000} className={`${inputClass(validationErrors.shortDescription)} min-h-24`} value={form.shortDescription} onChange={(event) => set('shortDescription', event.target.value)} />
          <ErrorText message={validationErrors.shortDescription} />
        </div>
        <div className="block text-sm font-semibold">
          <FieldLabel label="Overview" htmlFor="course-overview" help={commonFieldHelp.overview} />
          <textarea id="course-overview" maxLength={20000} className={`${inputClass(validationErrors.overview)} min-h-36`} value={form.overview} onChange={(event) => set('overview', event.target.value)} />
          <ErrorText message={validationErrors.overview} />
        </div>

        <fieldset id="course-study-modes" className={`rounded-xl border p-4 ${validationErrors.studyModes ? 'border-[#D92D20] bg-[#FFF8F7] ring-2 ring-[#FEE4E2]' : 'border-[#E8ECF3]'}`}>
          <legend className="px-2 text-sm font-semibold">Study modes</legend>
          {studyModesHelp ? <FieldHelpIcon fieldLabel="Study modes" help={studyModesHelp} /> : null}
          <div className="mt-3 flex flex-wrap gap-3">{modes.map((mode) => (
            <label key={mode.id} className="flex items-center gap-2 rounded-lg border border-[#E8ECF3] bg-white px-3 py-2 text-sm">
              <input type="checkbox" checked={selectedModes.includes(mode.id)} onChange={() => toggleMode(mode.id)} />{mode.name}
            </label>
          ))}</div>
          <ErrorText message={validationErrors.studyModes} />
        </fieldset>

        <div className="grid gap-5 sm:grid-cols-4">
          <div className="text-sm font-semibold">
            <FieldLabel label="Duration min" htmlFor="course-duration-min" helpKey="courses.durationMin" />
            <input id="course-duration-min" inputMode="decimal" className={inputClass(validationErrors.durationMin)} value={form.durationMin} onChange={(event) => set('durationMin', event.target.value)} />
            <ErrorText message={validationErrors.durationMin} />
          </div>
          <div className="text-sm font-semibold">
            <FieldLabel label="Duration max" htmlFor="course-duration-max" helpKey="courses.durationMax" />
            <input id="course-duration-max" inputMode="decimal" className={inputClass(validationErrors.durationMax)} value={form.durationMax} onChange={(event) => set('durationMax', event.target.value)} />
            <ErrorText message={validationErrors.durationMax} />
          </div>
          <div className="text-sm font-semibold">
            <FieldLabel label="Unit" htmlFor="course-duration-unit" helpKey="courses.durationUnit" />
            <select id="course-duration-unit" className={inputClass()} value={form.durationUnit} onChange={(event) => set('durationUnit', event.target.value)}>
              <option value="YEARS">Years</option><option value="MONTHS">Months</option><option value="SEMESTERS">Semesters</option>
            </select>
          </div>
          <div className="text-sm font-semibold">
            <FieldLabel label="Credits" htmlFor="course-credits" helpKey="courses.credits" />
            <input id="course-credits" inputMode="decimal" className={inputClass(validationErrors.credits)} value={form.credits} onChange={(event) => set('credits', event.target.value)} />
            <ErrorText message={validationErrors.credits} />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="text-sm font-semibold">
            <FieldLabel label="Career summary" htmlFor="course-career-summary" helpKey="courses.careerSummary" />
            <textarea id="course-career-summary" className={`${inputClass(validationErrors.careerSummary)} min-h-24`} value={form.careerSummary} onChange={(event) => set('careerSummary', event.target.value)} />
            <ErrorText message={validationErrors.careerSummary} />
          </div>
          <div className="text-sm font-semibold">
            <FieldLabel label="Popularity score" htmlFor="course-popularity-score" helpKey="courses.popularityScore" />
            <input id="course-popularity-score" inputMode="decimal" className={inputClass(validationErrors.popularityScore)} value={form.popularityScore} onChange={(event) => set('popularityScore', event.target.value)} />
            <ErrorText message={validationErrors.popularityScore} />
          </div>
        </div>

        <div className="grid gap-5 rounded-xl bg-[#F8FAFC] p-5 sm:grid-cols-3">
          <div className="text-sm font-semibold">
            <FieldLabel label="Status" htmlFor="course-status" />
            <div id="course-status" className="mt-2 rounded-xl border border-[#D9E0EA] bg-white px-3 py-3 font-semibold">{status}</div>
            <p className="mt-2 text-xs font-normal text-[#667085]">Status changes through Save draft / Publish, so it is not edited separately.</p>
          </div>
          <div className="text-sm font-semibold">
            <FieldLabel label="Display order" htmlFor="course-display-order" help={commonFieldHelp.displayOrder} />
            <input id="course-display-order" type="number" min="0" max="999999" step="1" className={inputClass(validationErrors.displayOrder)} value={form.displayOrder} onChange={(event) => set('displayOrder', event.target.value)} />
            <ErrorText message={validationErrors.displayOrder} />
          </div>
          <div className="flex items-center gap-3 self-center text-sm font-semibold">
            <input id="course-featured" type="checkbox" checked={form.isFeatured} onChange={(event) => set('isFeatured', event.target.checked)} />
            <FieldLabel label="Featured course" htmlFor="course-featured" help={commonFieldHelp.featured} />
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          <Link href="/courses" className="rounded-xl border border-[#D9E0EA] px-5 py-3 text-sm font-semibold">Cancel</Link>
          <button type="submit" name="intent" value="draft" disabled={saving} className="rounded-xl border border-[#1657CF] px-5 py-3 text-sm font-semibold text-[#1657CF] disabled:opacity-50">
            {savingIntent === 'draft' ? 'Saving…' : record?.status === 'PUBLISHED' ? 'Save changes' : 'Save draft'}
          </button>
          {record?.status !== 'PUBLISHED' ? (
            <button type="submit" name="intent" value="publish" disabled={saving} className="rounded-xl bg-[#1657CF] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
              {savingIntent === 'publish' ? 'Publishing…' : 'Publish'}
            </button>
          ) : null}
        </div>
      </form>

      {record && validationErrors.availability ? (
        <div id="course-availability-requirement" tabIndex={-1} className="mt-6 rounded-2xl border border-[#D92D20] bg-[#FFF8F7] p-5 ring-2 ring-[#FEE4E2]">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#B42318]">Publishing requirement</p>
          <h3 className="mt-2 text-lg font-semibold text-[#B42318]">Availability needs attention</h3>
          <p className="mt-2 text-sm text-[#7A271A]">{validationErrors.availability}</p>
          <p className="mt-2 text-sm text-[#7A271A]">Use the Availability tab below, save the country mapping, then press Publish again.</p>
        </div>
      ) : null}

      {record ? (
        <CourseEditorialWorkspace courseId={record.id} course={record} media={media} />
      ) : (
        <p className="mt-5 text-sm text-[#667085]">Save the course core to open its editorial workspace for availability, content, FAQs, SEO, and related courses.</p>
      )}
    </section>
  );
}
