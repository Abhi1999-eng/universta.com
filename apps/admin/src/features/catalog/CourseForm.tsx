'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CatalogDialog, CatalogError, CatalogLoading } from './CatalogDialog';
import { createCourse, createSubject, getAdminCourse, listCourseLevels, listEditorialMedia, listStudyModes, listSubjects, publishSubject, replaceCourseModes, unpublishSubject, updateCourse } from './catalog-client';
import { CourseEditorialWorkspace } from './CourseEditorialWorkspace';
import { MediaPickerDialog } from './editorial/MediaPickerDialog';
import { mergeBackendError, scrollToAndFocusField } from '@/lib/field-errors';
import type { CatalogMutationError, CourseRecord, EditorialMedia, MasterRecord, SubjectRecord } from './catalog.types';

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [subjectQuery, setSubjectQuery] = useState('');
  const [subjectDialogOpen, setSubjectDialogOpen] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [subjectBusy, setSubjectBusy] = useState(false);
  const [subjectError, setSubjectError] = useState('');

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
  async function submit(event: React.FormEvent) { event.preventDefault(); if (saving) return; setSaving(true); setError(''); setFieldErrors({}); try { const result = record ? await updateCourse(record.id, { ...clean(form), expectedUpdatedAt: record.updatedAt }) : await createCourse(clean(form)); await replaceCourseModes(result.data.id, selectedModes, result.data.updatedAt); router.push(`/courses/${result.data.id}`); } catch (cause: unknown) { const typed = cause as Partial<CatalogMutationError>; setError(typed.message ?? 'Unable to save course'); const { next, firstField } = mergeBackendError({}, typed); setFieldErrors(next); if (firstField) window.setTimeout(() => scrollToAndFocusField(firstField), 50); } finally { setSaving(false); } }
  const selectedSubject = subjects.find((subject) => subject.id === form.subjectId);
  const filteredSubjects = subjects.filter((subject) => subject.name.toLowerCase().includes(subjectQuery.trim().toLowerCase()));
  async function createSubjectInline(event: React.FormEvent) {
    event.preventDefault();
    if (!newSubjectName.trim() || subjectBusy) return;
    setSubjectBusy(true);
    setSubjectError('');
    try {
      const result = await createSubject({ name: newSubjectName.trim() });
      setSubjects((current) => [...current, result.data]);
      set('subjectId', result.data.id);
      setNewSubjectName('');
      setSubjectDialogOpen(false);
    } catch (cause: unknown) {
      setSubjectError(cause instanceof Error ? cause.message : 'Unable to create subject');
    } finally {
      setSubjectBusy(false);
    }
  }
  async function toggleSubjectStatus(subject: SubjectRecord) {
    setSubjectBusy(true);
    try {
      const result = subject.status === 'PUBLISHED' ? await unpublishSubject(subject.id, subject.updatedAt) : await publishSubject(subject.id, subject.updatedAt);
      setSubjects((current) => current.map((item) => (item.id === result.data.id ? result.data : item)));
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Unable to update subject status');
    } finally {
      setSubjectBusy(false);
    }
  }

  if (loading) return <CatalogLoading label="Loading course editor…" />;
  return <section aria-labelledby="course-form-heading" className="mx-auto max-w-[1100px]"><Link href="/courses" className="text-sm font-semibold text-[#1657CF]">← Courses</Link><p className="mt-8 text-xs font-bold uppercase tracking-[0.16em] text-[#828B9B]">Course editor</p><h2 id="course-form-heading" className="mt-2 text-3xl font-semibold">{record ? 'Edit course' : 'Create course'}</h2>{error ? <div className="mt-5"><CatalogError message={error} onRetry={() => setError('')} /></div> : null}<form onSubmit={submit} className="mt-8 space-y-7 rounded-2xl border border-[#E8ECF3] bg-white p-6 sm:p-8"><div className="grid gap-5 sm:grid-cols-3"><div className="text-sm font-semibold" data-field="subjectId">
  <label htmlFor="course-subject">Subject</label>
  <input value={subjectQuery} onChange={(event) => setSubjectQuery(event.target.value)} placeholder="Search subjects" aria-label="Search subjects" className="mt-2 w-full rounded-xl border border-[#D9E0EA] px-3 py-2 text-sm font-normal" />
  <select id="course-subject" required className="mt-2 w-full rounded-xl border border-[#D9E0EA] px-3 py-3 font-normal" value={form.subjectId} onChange={(event) => set('subjectId', event.target.value)}>
    <option value="">Select subject</option>
    {filteredSubjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}{subject.status !== 'PUBLISHED' ? ' (Draft)' : ''}</option>)}
  </select>
  {fieldErrors.subjectId ? <span className="mt-1 block text-xs font-normal text-[#B42318]">{fieldErrors.subjectId}</span> : null}
  {selectedSubject ? (
    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-normal">
      <span className={`rounded-full px-2.5 py-1 font-semibold ${selectedSubject.status === 'PUBLISHED' ? 'bg-[#E9F8F0] text-[#18794E]' : 'bg-[#FFF3E1] text-[#9A5B00]'}`}>{selectedSubject.status === 'PUBLISHED' ? 'Published' : 'Draft'}</span>
      <button type="button" disabled={subjectBusy} onClick={() => void toggleSubjectStatus(selectedSubject)} className="font-semibold text-[#1657CF] disabled:opacity-50">{selectedSubject.status === 'PUBLISHED' ? 'Unpublish subject' : 'Publish subject'}</button>
      <Link href={`/subjects/${selectedSubject.id}`} target="_blank" className="font-semibold text-[#1657CF]">Edit subject</Link>
    </div>
  ) : null}
  <button type="button" onClick={() => setSubjectDialogOpen(true)} className="mt-2 text-xs font-semibold text-[#1657CF]">+ New subject</button>
</div><label className="text-sm font-semibold">Course level<select required className="mt-2 w-full rounded-xl border border-[#D9E0EA] px-3 py-3 font-normal" value={form.courseLevelId} onChange={(event) => set('courseLevelId', event.target.value)}><option value="">Select level</option>{levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}</select></label><label className="text-sm font-semibold">Sub-Subject ID<input className="mt-2 w-full rounded-xl border border-[#D9E0EA] px-3 py-3 font-normal" value={form.subSubjectId} onChange={(event) => set('subSubjectId', event.target.value)} placeholder="Optional UUID" /></label></div><div className="grid gap-5 sm:grid-cols-2"><label className="text-sm font-semibold">Course name<input required maxLength={255} className="mt-2 w-full rounded-xl border border-[#D9E0EA] px-3 py-3 font-normal" value={form.name} onChange={(event) => set('name', event.target.value)} /></label><label className="text-sm font-semibold">Slug<input pattern="[a-z0-9]+(?:-[a-z0-9]+)*" className="mt-2 w-full rounded-xl border border-[#D9E0EA] px-3 py-3 font-normal" value={form.slug} onChange={(event) => set('slug', event.target.value)} placeholder="Optional; generated from course name" /></label></div><div className="grid gap-5 sm:grid-cols-3"><label className="text-sm font-semibold">Short name<input className="mt-2 w-full rounded-xl border border-[#D9E0EA] px-3 py-3 font-normal" value={form.shortName} onChange={(event) => set('shortName', event.target.value)} /></label><label className="text-sm font-semibold">Qualification<input className="mt-2 w-full rounded-xl border border-[#D9E0EA] px-3 py-3 font-normal" value={form.qualificationName} onChange={(event) => set('qualificationName', event.target.value)} /></label><MediaPickerDialog label="Featured course media" value={form.featuredMediaId} media={media} onChange={(value) => set('featuredMediaId', value)} /><label className="text-sm font-semibold">Course code<input className="mt-2 w-full rounded-xl border border-[#D9E0EA] px-3 py-3 font-normal" value={form.courseCode} onChange={(event) => set('courseCode', event.target.value)} /></label></div><label className="block text-sm font-semibold">Short description<textarea maxLength={1000} className="mt-2 min-h-24 w-full rounded-xl border border-[#D9E0EA] px-3 py-3 font-normal" value={form.shortDescription} onChange={(event) => set('shortDescription', event.target.value)} /></label><label className="block text-sm font-semibold">Overview<textarea maxLength={20000} className="mt-2 min-h-36 w-full rounded-xl border border-[#D9E0EA] px-3 py-3 font-normal" value={form.overview} onChange={(event) => set('overview', event.target.value)} /></label><fieldset><legend className="text-sm font-semibold">Study modes</legend><div className="mt-3 flex flex-wrap gap-3">{modes.map((mode) => <label key={mode.id} className="flex items-center gap-2 rounded-lg border border-[#E8ECF3] px-3 py-2 text-sm"><input type="checkbox" checked={selectedModes.includes(mode.id)} onChange={() => toggleMode(mode.id)} />{mode.name}</label>)}</div></fieldset><div className="grid gap-5 sm:grid-cols-4"><label className="text-sm font-semibold">Duration min<input inputMode="decimal" className="mt-2 w-full rounded-xl border border-[#D9E0EA] px-3 py-3 font-normal" value={form.durationMin} onChange={(event) => set('durationMin', event.target.value)} /></label><label className="text-sm font-semibold">Duration max<input inputMode="decimal" className="mt-2 w-full rounded-xl border border-[#D9E0EA] px-3 py-3 font-normal" value={form.durationMax} onChange={(event) => set('durationMax', event.target.value)} /></label><label className="text-sm font-semibold">Unit<select className="mt-2 w-full rounded-xl border border-[#D9E0EA] px-3 py-3 font-normal" value={form.durationUnit} onChange={(event) => set('durationUnit', event.target.value)}><option value="YEARS">Years</option><option value="MONTHS">Months</option><option value="SEMESTERS">Semesters</option></select></label><label className="text-sm font-semibold">Credits<input inputMode="decimal" className="mt-2 w-full rounded-xl border border-[#D9E0EA] px-3 py-3 font-normal" value={form.credits} onChange={(event) => set('credits', event.target.value)} /></label></div><div className="grid gap-5 sm:grid-cols-3"><label className="text-sm font-semibold">Career summary<textarea className="mt-2 min-h-24 w-full rounded-xl border border-[#D9E0EA] px-3 py-3 font-normal" value={form.careerSummary} onChange={(event) => set('careerSummary', event.target.value)} /></label><label className="text-sm font-semibold">Popularity score<input inputMode="decimal" className="mt-2 w-full rounded-xl border border-[#D9E0EA] px-3 py-3 font-normal" value={form.popularityScore} onChange={(event) => set('popularityScore', event.target.value)} /></label><label className="flex items-center gap-3 self-center text-sm font-semibold"><input type="checkbox" checked={form.isFeatured} onChange={(event) => set('isFeatured', event.target.checked)} />Featured course</label></div><div className="flex justify-end gap-3"><Link href="/courses" className="rounded-xl border border-[#D9E0EA] px-5 py-3 text-sm font-semibold">Cancel</Link><button disabled={saving} className="rounded-xl bg-[#1657CF] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save draft'}</button></div></form>{record ? <CourseEditorialWorkspace courseId={record.id} course={record} media={media} /> : <p className="mt-5 text-sm text-[#667085]">Save the course core to open its editorial workspace for availability, content, FAQs, SEO, and related courses.</p>}{subjectDialogOpen ? <CatalogDialog title="Create subject" description="Creates a subject you can immediately select above — the new course does not need to be saved first." onClose={() => setSubjectDialogOpen(false)}><form onSubmit={createSubjectInline} className="space-y-4"><label className="block text-sm font-semibold">Subject name<input required autoFocus value={newSubjectName} onChange={(event) => setNewSubjectName(event.target.value)} className="mt-2 w-full rounded-xl border border-[#D9E0EA] px-3 py-3 font-normal" /></label>{subjectError ? <p role="alert" className="text-sm text-[#B42318]">{subjectError}</p> : null}<div className="flex justify-end gap-3"><button type="button" onClick={() => setSubjectDialogOpen(false)} className="rounded-xl border border-[#D9E0EA] px-4 py-2 text-sm font-semibold">Cancel</button><button type="submit" disabled={subjectBusy} className="rounded-xl bg-[#1657CF] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{subjectBusy ? 'Creating…' : 'Create subject'}</button></div></form></CatalogDialog> : null}</section>;
}
