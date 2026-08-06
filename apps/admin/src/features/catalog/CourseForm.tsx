'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CatalogError, CatalogLoading } from './CatalogDialog';
import { createCourse, getAdminCourse, listCourseLevels, listEditorialMedia, listStudyModes, listSubjects, replaceCourseModes, updateCourse } from './catalog-client';
import { CourseEditorialWorkspace } from './CourseEditorialWorkspace';
import { MediaPickerDialog } from './editorial/MediaPickerDialog';
import type { CatalogMutationError, CourseRecord, EditorialMedia, MasterRecord, SubjectRecord } from './catalog.types';
import { FieldLabel } from '@/features/shared/FieldLabel';
import { FieldHelpIcon } from '@/features/shared/FieldHelpIcon';
import { commonFieldHelp } from '@/lib/field-help/common';
import { getFieldHelp } from '@/lib/field-help/registry';

type FormState = { subjectId: string; subSubjectId: string; courseLevelId: string; name: string; shortName: string; qualificationName: string; slug: string; courseCode: string; shortDescription: string; overview: string; durationMin: string; durationMax: string; durationUnit: string; credits: string; careerSummary: string; popularityScore: string; isFeatured: boolean; displayOrder: string; featuredMediaId: string };
const empty: FormState = { subjectId: '', subSubjectId: '', courseLevelId: '', name: '', shortName: '', qualificationName: '', slug: '', courseCode: '', shortDescription: '', overview: '', durationMin: '', durationMax: '', durationUnit: 'YEARS', credits: '', careerSummary: '', popularityScore: '', isFeatured: false, displayOrder: '0', featuredMediaId: '' };

function clean(form: FormState) { const result: Record<string, unknown> = { subjectId: form.subjectId, courseLevelId: form.courseLevelId, name: form.name, isFeatured: form.isFeatured, displayOrder: Number(form.displayOrder) || 0, ...(form.featuredMediaId ? { featuredMediaId: form.featuredMediaId } : {}) }; for (const key of ['subSubjectId', 'shortName', 'qualificationName', 'slug', 'courseCode', 'shortDescription', 'overview', 'durationMin', 'durationMax', 'durationUnit', 'credits', 'careerSummary', 'popularityScore'] as const) if (form[key]) result[key] = form[key]; return result; }

export function CourseForm({ id }: { id?: string }) {
  const router = useRouter();
  const [record, setRecord] = useState<CourseRecord | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [levels, setLevels] = useState<MasterRecord[]>([]);
  const [modes, setModes] = useState<MasterRecord[]>([]);
  const [media, setMedia] = useState<EditorialMedia[]>([]);
  const [selectedModes, setSelectedModes] = useState<string[]>([]);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const studyModesHelp = getFieldHelp('courses.studyModes');

  useEffect(() => {
    let cancelled = false;
    void Promise.all([listSubjects({ limit: 100 }), listCourseLevels({ status: 'ACTIVE', limit: 100 }), listStudyModes({ status: 'ACTIVE', limit: 100 }), listEditorialMedia({ limit: 50 }), id ? getAdminCourse(id) : Promise.resolve(null)])
      .then(([subjectResult, levelResult, modeResult, mediaResult, courseResult]) => {
        if (cancelled) return;
        setSubjects(subjectResult.data);
        setLevels(levelResult.data);
        setModes(modeResult.data);
        setMedia(mediaResult.data);
        if (courseResult) {
          setRecord(courseResult.data);
          const c = courseResult.data;
          setForm({ subjectId: c.subject.id, subSubjectId: c.subSubject?.id ?? '', courseLevelId: c.courseLevel.id, name: c.name, shortName: c.shortName ?? '', qualificationName: c.qualificationName ?? '', slug: c.slug, courseCode: c.courseCode ?? '', shortDescription: c.shortDescription ?? '', overview: c.overview ?? '', durationMin: c.durationMin ?? '', durationMax: c.durationMax ?? '', durationUnit: c.durationUnit ?? 'YEARS', credits: c.credits ?? '', careerSummary: c.careerSummary ?? '', popularityScore: c.popularityScore ?? '', isFeatured: c.featured, displayOrder: String(c.displayOrder), featuredMediaId: c.featuredMedia?.id ?? '' });
          setSelectedModes(c.studyModes.map((mode) => mode.id));
        }
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Unable to load course options'))
      .finally(() => setLoading(false));
    return () => { cancelled = true; };
  }, [id]);

  function set(key: keyof FormState, value: string | boolean) { setForm((current) => ({ ...current, [key]: value })); }
  function toggleMode(modeId: string) { setSelectedModes((current) => current.includes(modeId) ? current.filter((idValue) => idValue !== modeId) : [...current, modeId]); }
  async function submit(event: React.FormEvent) { event.preventDefault(); if (saving) return; setSaving(true); setError(''); try { const result = record ? await updateCourse(record.id, { ...clean(form), expectedUpdatedAt: record.updatedAt }) : await createCourse(clean(form)); await replaceCourseModes(result.data.id, selectedModes, result.data.updatedAt); router.push(`/courses/${result.data.id}`); } catch (cause: unknown) { const typed = cause as Partial<CatalogMutationError>; setError(typed.message ?? 'Unable to save course'); } finally { setSaving(false); } }

  if (loading) return <CatalogLoading label="Loading course editor…" />;
  return (
    <section aria-labelledby="course-form-heading" className="mx-auto max-w-[1100px]">
      <Link href="/courses" className="text-sm font-semibold text-[#1657CF]">← Courses</Link>
      <p className="mt-8 text-xs font-bold uppercase tracking-[0.16em] text-[#828B9B]">Course editor</p>
      <h2 id="course-form-heading" className="mt-2 text-3xl font-semibold">{record ? 'Edit course' : 'Create course'}</h2>
      {error ? <div className="mt-5"><CatalogError message={error} onRetry={() => setError('')} /></div> : null}
      <form onSubmit={submit} className="mt-8 space-y-7 rounded-2xl border border-[#E8ECF3] bg-white p-6 sm:p-8">
        <div className="grid gap-5 sm:grid-cols-3">
          <div className="text-sm font-semibold"><FieldLabel label="Subject" htmlFor="course-subject" required help={commonFieldHelp.subject} /><select id="course-subject" required className="mt-2 w-full rounded-xl border border-[#D9E0EA] px-3 py-3 font-normal" value={form.subjectId} onChange={(event) => set('subjectId', event.target.value)}><option value="">Select subject</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></div>
          <div className="text-sm font-semibold"><FieldLabel label="Course level" htmlFor="course-level" required helpKey="courses.courseLevelId" /><select id="course-level" required className="mt-2 w-full rounded-xl border border-[#D9E0EA] px-3 py-3 font-normal" value={form.courseLevelId} onChange={(event) => set('courseLevelId', event.target.value)}><option value="">Select level</option>{levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}</select></div>
          <div className="text-sm font-semibold"><FieldLabel label="Sub-Subject ID" htmlFor="course-sub-subject-id" helpKey="courses.subSubjectId" /><input id="course-sub-subject-id" className="mt-2 w-full rounded-xl border border-[#D9E0EA] px-3 py-3 font-normal" value={form.subSubjectId} onChange={(event) => set('subSubjectId', event.target.value)} placeholder="Optional UUID" /></div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="text-sm font-semibold"><FieldLabel label="Course name" htmlFor="course-name" required help={commonFieldHelp.name} /><input id="course-name" required maxLength={255} className="mt-2 w-full rounded-xl border border-[#D9E0EA] px-3 py-3 font-normal" value={form.name} onChange={(event) => set('name', event.target.value)} /></div>
          <div className="text-sm font-semibold"><FieldLabel label="Slug" htmlFor="course-slug" help={commonFieldHelp.slug} /><input id="course-slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" className="mt-2 w-full rounded-xl border border-[#D9E0EA] px-3 py-3 font-normal" value={form.slug} onChange={(event) => set('slug', event.target.value)} placeholder="Optional; generated from course name" /></div>
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          <div className="text-sm font-semibold"><FieldLabel label="Short name" htmlFor="course-short-name" helpKey="courses.shortName" /><input id="course-short-name" className="mt-2 w-full rounded-xl border border-[#D9E0EA] px-3 py-3 font-normal" value={form.shortName} onChange={(event) => set('shortName', event.target.value)} /></div>
          <div className="text-sm font-semibold"><FieldLabel label="Qualification" htmlFor="course-qualification" helpKey="courses.qualificationName" /><input id="course-qualification" className="mt-2 w-full rounded-xl border border-[#D9E0EA] px-3 py-3 font-normal" value={form.qualificationName} onChange={(event) => set('qualificationName', event.target.value)} /></div>
          <MediaPickerDialog label="Featured course media" value={form.featuredMediaId} media={media} onChange={(value) => set('featuredMediaId', value)} />
          <div className="text-sm font-semibold"><FieldLabel label="Course code" htmlFor="course-code" helpKey="courses.courseCode" /><input id="course-code" className="mt-2 w-full rounded-xl border border-[#D9E0EA] px-3 py-3 font-normal" value={form.courseCode} onChange={(event) => set('courseCode', event.target.value)} /></div>
        </div>
        <div className="block text-sm font-semibold"><FieldLabel label="Short description" htmlFor="course-short-description" help={commonFieldHelp.shortDescription} /><textarea id="course-short-description" maxLength={1000} className="mt-2 min-h-24 w-full rounded-xl border border-[#D9E0EA] px-3 py-3 font-normal" value={form.shortDescription} onChange={(event) => set('shortDescription', event.target.value)} /></div>
        <div className="block text-sm font-semibold"><FieldLabel label="Overview" htmlFor="course-overview" help={commonFieldHelp.overview} /><textarea id="course-overview" maxLength={20000} className="mt-2 min-h-36 w-full rounded-xl border border-[#D9E0EA] px-3 py-3 font-normal" value={form.overview} onChange={(event) => set('overview', event.target.value)} /></div>
        <fieldset>
          {/* The icon sits beside <legend>, not inside it, so the fieldset's
              own accessible name stays exactly "Study modes" — a help icon
              inside <legend> gets folded into the group's computed name. */}
          <div className="flex items-center"><legend className="text-sm font-semibold">Study modes</legend>{studyModesHelp ? <FieldHelpIcon fieldLabel="Study modes" help={studyModesHelp} /> : null}</div>
          <div className="mt-3 flex flex-wrap gap-3">{modes.map((mode) => <label key={mode.id} className="flex items-center gap-2 rounded-lg border border-[#E8ECF3] px-3 py-2 text-sm"><input type="checkbox" checked={selectedModes.includes(mode.id)} onChange={() => toggleMode(mode.id)} />{mode.name}</label>)}</div>
        </fieldset>
        <div className="grid gap-5 sm:grid-cols-4">
          <div className="text-sm font-semibold"><FieldLabel label="Duration min" htmlFor="course-duration-min" helpKey="courses.durationMin" /><input id="course-duration-min" inputMode="decimal" className="mt-2 w-full rounded-xl border border-[#D9E0EA] px-3 py-3 font-normal" value={form.durationMin} onChange={(event) => set('durationMin', event.target.value)} /></div>
          <div className="text-sm font-semibold"><FieldLabel label="Duration max" htmlFor="course-duration-max" helpKey="courses.durationMax" /><input id="course-duration-max" inputMode="decimal" className="mt-2 w-full rounded-xl border border-[#D9E0EA] px-3 py-3 font-normal" value={form.durationMax} onChange={(event) => set('durationMax', event.target.value)} /></div>
          <div className="text-sm font-semibold"><FieldLabel label="Unit" htmlFor="course-duration-unit" helpKey="courses.durationUnit" /><select id="course-duration-unit" className="mt-2 w-full rounded-xl border border-[#D9E0EA] px-3 py-3 font-normal" value={form.durationUnit} onChange={(event) => set('durationUnit', event.target.value)}><option value="YEARS">Years</option><option value="MONTHS">Months</option><option value="SEMESTERS">Semesters</option></select></div>
          <div className="text-sm font-semibold"><FieldLabel label="Credits" htmlFor="course-credits" helpKey="courses.credits" /><input id="course-credits" inputMode="decimal" className="mt-2 w-full rounded-xl border border-[#D9E0EA] px-3 py-3 font-normal" value={form.credits} onChange={(event) => set('credits', event.target.value)} /></div>
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          <div className="text-sm font-semibold"><FieldLabel label="Career summary" htmlFor="course-career-summary" helpKey="courses.careerSummary" /><textarea id="course-career-summary" className="mt-2 min-h-24 w-full rounded-xl border border-[#D9E0EA] px-3 py-3 font-normal" value={form.careerSummary} onChange={(event) => set('careerSummary', event.target.value)} /></div>
          <div className="text-sm font-semibold"><FieldLabel label="Popularity score" htmlFor="course-popularity-score" helpKey="courses.popularityScore" /><input id="course-popularity-score" inputMode="decimal" className="mt-2 w-full rounded-xl border border-[#D9E0EA] px-3 py-3 font-normal" value={form.popularityScore} onChange={(event) => set('popularityScore', event.target.value)} /></div>
          <div className="flex items-center gap-3 self-center text-sm font-semibold"><input id="course-featured" type="checkbox" checked={form.isFeatured} onChange={(event) => set('isFeatured', event.target.checked)} /><FieldLabel label="Featured course" htmlFor="course-featured" help={commonFieldHelp.featured} /></div>
        </div>
        <div className="flex justify-end gap-3"><Link href="/courses" className="rounded-xl border border-[#D9E0EA] px-5 py-3 text-sm font-semibold">Cancel</Link><button disabled={saving} className="rounded-xl bg-[#1657CF] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save draft'}</button></div>
      </form>
      {record ? <CourseEditorialWorkspace courseId={record.id} course={record} media={media} /> : <p className="mt-5 text-sm text-[#667085]">Save the course core to open its editorial workspace for availability, content, FAQs, SEO, and related courses.</p>}
    </section>
  );
}
