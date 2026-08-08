'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createSubject,
  deleteSubjectSeo,
  getSubject,
  getSubjectSeo,
  listEditorialMedia,
  listSubSubjects,
  publishSubSubject,
  publishSubject,
  saveSubjectSeo,
  unpublishSubSubject,
  unpublishSubject,
  updateSubject,
} from './catalog-client';
import type {
  CatalogMutationError,
  EditorialMedia,
  EditorialSeo,
  SubSubjectRecord,
  SubjectRecord,
} from './catalog.types';
import { SubSubjectsEditor } from './SubSubjectsEditor';
import { CatalogDialog } from './CatalogDialog';
import { CatalogSeoEditor } from './CatalogSeoEditor';
import { MediaPickerDialog } from './editorial/MediaPickerDialog';
import { FieldLabel } from '@/features/shared/FieldLabel';
import { commonFieldHelp } from '@/lib/field-help/common';

type SubmitIntent = 'draft' | 'publish';

export function SubjectForm({ id }: { id?: string }) {
  const router = useRouter();
  const [record, setRecord] = useState<SubjectRecord | null>(null);
  const [media, setMedia] = useState<EditorialMedia[]>([]);
  const [seo, setSeo] = useState<EditorialSeo | null>(null);
  const [seoError, setSeoError] = useState('');
  const [seoDelete, setSeoDelete] = useState(false);
  const [form, setForm] = useState({
    name: '',
    slug: '',
    shortDescription: '',
    overview: '',
    iconMediaId: '',
    listingMediaId: '',
    heroMediaId: '',
    isFeatured: false,
    displayOrder: '0',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingIntent, setSavingIntent] = useState<SubmitIntent | null>(null);

  useEffect(() => {
    void listEditorialMedia({ limit: 50 })
      .then((result) => setMedia(result.data))
      .catch(() =>
        setError(
          'Unable to load the media library. Image pickers will be empty until this is resolved.',
        ),
      );

    if (id) {
      void Promise.all([getSubject(id), getSubjectSeo(id)])
        .then(([subject, seoResult]) => {
          setRecord(subject.data);
          setSeo(seoResult.data);
          setForm({
            name: subject.data.name,
            slug: subject.data.slug,
            shortDescription: subject.data.shortDescription ?? '',
            overview: subject.data.overview ?? '',
            iconMediaId: subject.data.iconMedia?.id ?? '',
            listingMediaId: subject.data.listingMedia?.id ?? '',
            heroMediaId: subject.data.heroMedia?.id ?? '',
            isFeatured: subject.data.isFeatured,
            displayOrder: String(subject.data.displayOrder),
          });
        })
        .catch((cause: unknown) =>
          setError(
            cause instanceof Error ? cause.message : 'Unable to load subject',
          ),
        );
    }
  }, [id]);

  function set(key: string, value: string | boolean) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function allSpecializations(subjectId: string) {
    const rows: SubSubjectRecord[] = [];
    let page = 1;
    while (true) {
      const result = await listSubSubjects(subjectId, { page, limit: 50 });
      rows.push(...result.data);
      if (!result.meta || page >= result.meta.totalPages) return rows;
      page += 1;
    }
  }

  async function publishBundle(subject: SubjectRecord) {
    const specializations = await allSpecializations(subject.id);
    const incomplete = specializations.find(
      (item) => !item.shortDescription?.trim(),
    );
    if (incomplete) {
      throw new Error(
        `Complete the short description for specialization "${incomplete.name}" before publishing the Subject.`,
      );
    }

    let current = subject;
    if (current.status !== 'PUBLISHED') {
      current = (await publishSubject(current.id, current.updatedAt)).data;
    }

    for (const specialization of specializations) {
      if (specialization.status !== 'PUBLISHED') {
        await publishSubSubject(
          current.id,
          specialization.id,
          specialization.updatedAt,
        );
      }
    }
    return current;
  }

  async function moveBundleToDraft(subject: SubjectRecord) {
    const specializations = await allSpecializations(subject.id);
    for (const specialization of specializations) {
      if (specialization.status === 'PUBLISHED') {
        await unpublishSubSubject(
          subject.id,
          specialization.id,
          specialization.updatedAt,
        );
      }
    }
    if (subject.status === 'PUBLISHED') {
      return (await unpublishSubject(subject.id, subject.updatedAt)).data;
    }
    return subject;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    const intent: SubmitIntent =
      submitter?.value === 'publish' ? 'publish' : 'draft';

    setSaving(true);
    setSavingIntent(intent);
    setError('');

    try {
      const optional = (value: string) =>
        value.trim() ? value.trim() : undefined;
      const data = {
        ...form,
        slug: optional(form.slug),
        iconMediaId: optional(form.iconMediaId),
        listingMediaId: optional(form.listingMediaId),
        heroMediaId: optional(form.heroMediaId),
        displayOrder: Number(form.displayOrder),
        ...(record ? { expectedUpdatedAt: record.updatedAt } : {}),
      };

      const saved = record
        ? await updateSubject(record.id, data)
        : await createSubject(data);

      const finalRecord =
        intent === 'publish'
          ? await publishBundle(saved.data)
          : await moveBundleToDraft(saved.data);

      setRecord(finalRecord);
      router.push(`/subjects/${finalRecord.id}`);
      router.refresh();
    } catch (cause: unknown) {
      const typed = cause as Partial<CatalogMutationError>;
      setError(
        typed.message ??
          (intent === 'publish'
            ? 'Unable to publish Subject'
            : 'Unable to save Subject draft'),
      );
    } finally {
      setSaving(false);
      setSavingIntent(null);
    }
  }

  async function saveSeo(data: Record<string, unknown>) {
    if (!record) return;
    setSeoError('');
    try {
      const result = await saveSubjectSeo(record.id, data);
      setSeo(result.data);
    } catch (cause: unknown) {
      setSeoError(
        cause instanceof Error ? cause.message : 'Unable to save SEO metadata',
      );
    }
  }

  async function removeSeo() {
    if (!record || !seo) return;
    try {
      await deleteSubjectSeo(record.id, seo.updatedAt);
      setSeo(null);
      setSeoDelete(false);
    } catch (cause: unknown) {
      setSeoError(
        cause instanceof Error
          ? cause.message
          : 'Unable to remove SEO metadata',
      );
      setSeoDelete(false);
    }
  }

  return (
    <section
      aria-labelledby="subject-form-heading"
      className="mx-auto max-w-[900px]"
    >
      <Link href="/subjects" className="text-sm font-semibold text-[#1657CF]">
        ← Subjects
      </Link>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#828B9B]">
            Subject editor
          </p>
          <h2 id="subject-form-heading" className="mt-2 text-3xl font-semibold">
            {record ? 'Edit subject' : 'Create subject'}
          </h2>
        </div>
        {record ? (
          <div className="rounded-full border border-[#D9E0EA] px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#667085]">
            {record.status}
          </div>
        ) : null}
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-5 rounded-xl bg-[#FFF7F7] px-4 py-3 text-sm font-semibold text-[#B42318]"
        >
          {error}
        </p>
      ) : null}

      <form
        onSubmit={submit}
        className="mt-8 space-y-6 rounded-2xl border border-[#E8ECF3] bg-white p-6 sm:p-8"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="text-sm font-semibold">
            <FieldLabel
              label="Name"
              htmlFor="subject-name"
              required
              help={commonFieldHelp.name}
            />
            <input
              id="subject-name"
              required
              className="mt-2 w-full rounded-xl border border-[#D9E0EA] px-4 py-3 font-normal"
              value={form.name}
              onChange={(event) => set('name', event.target.value)}
            />
          </div>
          <div className="text-sm font-semibold">
            <FieldLabel
              label="Slug"
              htmlFor="subject-slug"
              help={commonFieldHelp.slug}
            />
            <input
              id="subject-slug"
              className="mt-2 w-full rounded-xl border border-[#D9E0EA] px-4 py-3 font-normal"
              value={form.slug}
              onChange={(event) => set('slug', event.target.value)}
              placeholder="Generated from name"
            />
          </div>
        </div>

        <div className="block text-sm font-semibold">
          <FieldLabel
            label="Short description"
            htmlFor="subject-short-description"
            required
            help={commonFieldHelp.shortDescription}
          />
          <textarea
            id="subject-short-description"
            required
            maxLength={1000}
            className="mt-2 min-h-24 w-full rounded-xl border border-[#D9E0EA] px-4 py-3 font-normal"
            value={form.shortDescription}
            onChange={(event) => set('shortDescription', event.target.value)}
          />
        </div>

        <div className="block text-sm font-semibold">
          <FieldLabel
            label="Overview"
            htmlFor="subject-overview"
            help={commonFieldHelp.overview}
          />
          <textarea
            id="subject-overview"
            maxLength={20000}
            className="mt-2 min-h-40 w-full rounded-xl border border-[#D9E0EA] px-4 py-3 font-normal"
            value={form.overview}
            onChange={(event) => set('overview', event.target.value)}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <MediaPickerDialog
            label="Icon media"
            value={form.iconMediaId}
            media={media}
            onChange={(value) => set('iconMediaId', value)}
            help={{
              ...commonFieldHelp.media,
              purpose:
                'The small icon shown for this subject, e.g. in navigation or subject cards.',
            }}
          />
          <MediaPickerDialog
            label="Listing media"
            value={form.listingMediaId}
            media={media}
            onChange={(value) => set('listingMediaId', value)}
            help={{
              ...commonFieldHelp.media,
              purpose:
                'The image shown for this subject on listing/directory cards.',
            }}
          />
          <MediaPickerDialog
            label="Hero media"
            value={form.heroMediaId}
            media={media}
            onChange={(value) => set('heroMediaId', value)}
            help={{
              ...commonFieldHelp.media,
              purpose:
                'The large banner image shown at the top of this subject’s own page.',
            }}
          />
          <div className="flex items-center gap-3 self-end text-sm font-semibold">
            <input
              id="subject-featured"
              type="checkbox"
              checked={form.isFeatured}
              onChange={(event) => set('isFeatured', event.target.checked)}
            />
            <FieldLabel
              label="Featured subject"
              htmlFor="subject-featured"
              help={commonFieldHelp.featured}
            />
          </div>
        </div>

        <div className="block text-sm font-semibold">
          <FieldLabel
            label="Display order"
            htmlFor="subject-display-order"
            help={commonFieldHelp.displayOrder}
          />
          <input
            id="subject-display-order"
            type="number"
            min="0"
            className="mt-2 w-full rounded-xl border border-[#D9E0EA] px-4 py-3 font-normal"
            value={form.displayOrder}
            onChange={(event) => set('displayOrder', event.target.value)}
          />
        </div>

        <div className="rounded-xl bg-[#F7F9FC] p-4 text-sm text-[#667085]">
          <strong className="text-[#1D2939]">One publishing state.</strong>{' '}
          Save draft moves the Subject and all of its Specializations to draft.
          Publish publishes the Subject and every complete Specialization
          together.
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          <Link
            href="/subjects"
            className="rounded-xl border border-[#D9E0EA] px-5 py-3 text-sm font-semibold"
          >
            Cancel
          </Link>
          <button
            type="submit"
            name="intent"
            value="draft"
            disabled={saving}
            className="rounded-xl border border-[#1657CF] px-5 py-3 text-sm font-semibold text-[#1657CF] disabled:opacity-50"
          >
            {savingIntent === 'draft' ? 'Saving draft…' : 'Save draft'}
          </button>
          <button
            type="submit"
            name="intent"
            value="publish"
            disabled={saving}
            className="rounded-xl bg-[#1657CF] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {savingIntent === 'publish' ? 'Publishing…' : 'Publish'}
          </button>
        </div>
      </form>

      {record ? (
        <>
          <SubSubjectsEditor subjectId={record.id} media={media} />

          {seoError ? (
            <p
              role="alert"
              className="mt-6 rounded-xl bg-[#FFF7F7] px-4 py-3 text-sm font-semibold text-[#B42318]"
            >
              {seoError}
            </p>
          ) : null}

          <div className="mt-6">
            <CatalogSeoEditor
              seo={seo}
              media={media}
              onSave={saveSeo}
              onDelete={() => setSeoDelete(true)}
              onError={setSeoError}
            />
          </div>

          {seoDelete ? (
            <CatalogDialog
              title="Remove Subject SEO?"
              description="The public subject page will use its default metadata after removal."
              onClose={() => setSeoDelete(false)}
            >
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSeoDelete(false)}
                  className="rounded-lg border px-4 py-2 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void removeSeo()}
                  className="rounded-lg bg-[#B42318] px-4 py-2 text-sm font-semibold text-white"
                >
                  Remove SEO
                </button>
              </div>
            </CatalogDialog>
          ) : null}
        </>
      ) : (
        <p className="mt-6 rounded-xl border border-dashed border-[#CBD5E4] p-5 text-sm text-[#667085]">
          Save the Subject once to unlock Specializations and SEO.
        </p>
      )}
    </section>
  );
}
