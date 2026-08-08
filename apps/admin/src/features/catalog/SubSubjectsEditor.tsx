'use client';

import { useCallback, useEffect, useState } from 'react';
import { CatalogDialog, CatalogError, CatalogLoading } from './CatalogDialog';
import {
  createSubSubject,
  deleteSubSubject,
  listSubSubjects,
  updateSubSubject,
} from './catalog-client';
import type {
  CatalogMutationError,
  EditorialMedia,
  SubSubjectRecord,
} from './catalog.types';
import { MediaPickerDialog } from './editorial/MediaPickerDialog';
import { FieldLabel } from '@/features/shared/FieldLabel';
import { commonFieldHelp } from '@/lib/field-help/common';

type SpecializationDraft = {
  name: string;
  slug: string;
  shortDescription: string;
  overview: string;
  iconMediaId: string;
  listingMediaId: string;
  isFeatured: boolean;
  displayOrder: string;
};

const emptyDraft: SpecializationDraft = {
  name: '',
  slug: '',
  shortDescription: '',
  overview: '',
  iconMediaId: '',
  listingMediaId: '',
  isFeatured: false,
  displayOrder: '0',
};

function draftFrom(row: SubSubjectRecord): SpecializationDraft {
  return {
    name: row.name,
    slug: row.slug,
    shortDescription: row.shortDescription ?? '',
    overview: row.overview ?? '',
    iconMediaId: row.iconMedia?.id ?? '',
    listingMediaId: row.listingMedia?.id ?? '',
    isFeatured: row.featured,
    displayOrder: String(row.displayOrder),
  };
}

function payload(draft: SpecializationDraft) {
  const optional = (value: string) =>
    value.trim() ? value.trim() : undefined;
  return {
    name: draft.name.trim(),
    slug: optional(draft.slug),
    shortDescription: optional(draft.shortDescription),
    overview: optional(draft.overview),
    iconMediaId: optional(draft.iconMediaId),
    listingMediaId: optional(draft.listingMediaId),
    isFeatured: draft.isFeatured,
    displayOrder: Number(draft.displayOrder),
  };
}

export function SubSubjectsEditor({
  subjectId,
  media,
}: {
  subjectId: string;
  media: EditorialMedia[];
}) {
  const [rows, setRows] = useState<SubSubjectRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<SpecializationDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<SubSubjectRecord | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    void listSubSubjects(subjectId, { limit: 50 })
      .then((result) => setRows(result.data))
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error
            ? cause.message
            : 'Unable to load Specializations',
        ),
      )
      .finally(() => setLoading(false));
  }, [subjectId]);

  useEffect(() => {
    const timer = window.setTimeout(() => load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function setDraftField(
    key: keyof SpecializationDraft,
    value: string | boolean,
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (saving || !draft.name.trim()) return;
    setSaving(true);
    setError('');
    try {
      await createSubSubject(subjectId, payload(draft));
      setDraft(emptyDraft);
      load();
    } catch (cause: unknown) {
      const typed = cause as Partial<CatalogMutationError>;
      setError(typed.message ?? 'Unable to create Specialization');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!pending) return;
    try {
      await deleteSubSubject(subjectId, pending.id, pending.updatedAt);
      setPending(null);
      load();
    } catch (cause: unknown) {
      const typed = cause as Partial<CatalogMutationError>;
      setError(typed.message ?? 'Unable to delete Specialization');
      setPending(null);
    }
  }

  return (
    <section
      aria-labelledby="specializations-heading"
      className="mt-6 rounded-2xl border border-[#E8ECF3] bg-white p-6"
    >
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#828B9B]">
          Subject structure
        </p>
        <h3 id="specializations-heading" className="mt-2 text-xl font-semibold">
          Specializations
        </h3>
        <p className="mt-2 text-sm text-[#667085]">
          Build the specializations that sit under this Subject. They do not
          have separate Publish buttons; the Subject-level Publish action
          publishes every complete specialization together.
        </p>
      </div>

      {error ? (
        <div className="mt-4">
          <CatalogError message={error} onRetry={load} />
        </div>
      ) : null}

      <form
        onSubmit={add}
        className="mt-5 space-y-4 rounded-xl border border-[#E8ECF3] bg-[#FBFCFE] p-5"
      >
        <div className="flex items-center justify-between gap-3">
          <h4 className="font-semibold">Add specialization</h4>
          <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[#828B9B]">
            Follows Subject status
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="text-sm font-semibold">
            <FieldLabel
              label="Name"
              htmlFor="specialization-name"
              required
              help={commonFieldHelp.name}
            />
            <input
              id="specialization-name"
              required
              className="mt-2 w-full rounded-xl border border-[#D9E0EA] px-3 py-2.5 font-normal"
              value={draft.name}
              onChange={(event) => setDraftField('name', event.target.value)}
            />
          </div>
          <div className="text-sm font-semibold">
            <FieldLabel
              label="Slug"
              htmlFor="specialization-slug"
              help={commonFieldHelp.slug}
            />
            <input
              id="specialization-slug"
              className="mt-2 w-full rounded-xl border border-[#D9E0EA] px-3 py-2.5 font-normal"
              value={draft.slug}
              onChange={(event) => setDraftField('slug', event.target.value)}
              placeholder="Generated from name"
            />
          </div>
        </div>

        <div className="text-sm font-semibold">
          <FieldLabel
            label="Short description"
            htmlFor="specialization-short-description"
            required
            help={commonFieldHelp.shortDescription}
          />
          <textarea
            id="specialization-short-description"
            required
            maxLength={1000}
            rows={3}
            className="mt-2 w-full rounded-xl border border-[#D9E0EA] px-3 py-2.5 font-normal"
            value={draft.shortDescription}
            onChange={(event) =>
              setDraftField('shortDescription', event.target.value)
            }
          />
        </div>

        <div className="text-sm font-semibold">
          <FieldLabel
            label="Overview"
            htmlFor="specialization-overview"
            help={commonFieldHelp.overview}
          />
          <textarea
            id="specialization-overview"
            maxLength={20000}
            rows={5}
            className="mt-2 w-full rounded-xl border border-[#D9E0EA] px-3 py-2.5 font-normal"
            value={draft.overview}
            onChange={(event) => setDraftField('overview', event.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <MediaPickerDialog
            label="Icon media"
            value={draft.iconMediaId}
            media={media}
            onChange={(value) => setDraftField('iconMediaId', value)}
            help={commonFieldHelp.media}
          />
          <MediaPickerDialog
            label="Listing media"
            value={draft.listingMediaId}
            media={media}
            onChange={(value) => setDraftField('listingMediaId', value)}
            help={commonFieldHelp.media}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="text-sm font-semibold">
            <FieldLabel
              label="Display order"
              htmlFor="specialization-display-order"
              help={commonFieldHelp.displayOrder}
            />
            <input
              id="specialization-display-order"
              type="number"
              min="0"
              className="mt-2 w-full rounded-xl border border-[#D9E0EA] px-3 py-2.5 font-normal"
              value={draft.displayOrder}
              onChange={(event) =>
                setDraftField('displayOrder', event.target.value)
              }
            />
          </div>
          <div className="flex items-center gap-3 self-end pb-3 text-sm font-semibold">
            <input
              id="specialization-featured"
              type="checkbox"
              checked={draft.isFeatured}
              onChange={(event) =>
                setDraftField('isFeatured', event.target.checked)
              }
            />
            <FieldLabel
              label="Featured specialization"
              htmlFor="specialization-featured"
              help={commonFieldHelp.featured}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            disabled={saving}
            className="rounded-xl bg-[#1657CF] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Adding…' : 'Add specialization'}
          </button>
        </div>
      </form>

      {loading ? (
        <div className="mt-5">
          <CatalogLoading label="Loading Specializations…" />
        </div>
      ) : rows.length ? (
        <div className="mt-5 space-y-4">
          {rows.map((row) => (
            <SpecializationCard
              key={row.id}
              subjectId={subjectId}
              row={row}
              media={media}
              onSaved={load}
              onDelete={() => setPending(row)}
              onError={setError}
            />
          ))}
        </div>
      ) : (
        <p className="mt-5 rounded-xl border border-dashed border-[#CBD5E4] p-6 text-center text-sm text-[#667085]">
          No Specializations yet.
        </p>
      )}

      {pending ? (
        <CatalogDialog
          title="Delete Specialization?"
          description="This removes the specialization only when it is not referenced by a course."
          onClose={() => setPending(null)}
        >
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setPending(null)}
              className="rounded-lg border border-[#D9E0EA] px-4 py-2 text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void remove()}
              className="rounded-lg bg-[#B42318] px-4 py-2 text-sm font-semibold text-white"
            >
              Delete
            </button>
          </div>
        </CatalogDialog>
      ) : null}
    </section>
  );
}

function SpecializationCard({
  subjectId,
  row,
  media,
  onSaved,
  onDelete,
  onError,
}: {
  subjectId: string;
  row: SubSubjectRecord;
  media: EditorialMedia[];
  onSaved: () => void;
  onDelete: () => void;
  onError: (message: string) => void;
}) {
  const [draft, setDraft] = useState<SpecializationDraft>(() => draftFrom(row));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDraft(draftFrom(row)), 0);
    return () => window.clearTimeout(timer);
  }, [row]);

  function set(
    key: keyof SpecializationDraft,
    value: string | boolean,
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    if (saving || !draft.name.trim()) return;
    setSaving(true);
    onError('');
    try {
      await updateSubSubject(subjectId, row.id, {
        ...payload(draft),
        expectedUpdatedAt: row.updatedAt,
      });
      onSaved();
    } catch (cause: unknown) {
      const typed = cause as Partial<CatalogMutationError>;
      onError(typed.message ?? 'Unable to save Specialization');
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="rounded-xl border border-[#E8ECF3] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="font-semibold">{row.name}</h4>
          <p className="mt-1 text-xs text-[#828B9B]">/{row.slug}</p>
        </div>
        <span className="rounded-full bg-[#F2F4F7] px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-[#667085]">
          {row.status}
        </span>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="text-sm font-semibold">
          <FieldLabel
            label="Name"
            htmlFor={`specialization-${row.id}-name`}
            required
            help={commonFieldHelp.name}
          />
          <input
            id={`specialization-${row.id}-name`}
            required
            className="mt-2 w-full rounded-xl border border-[#D9E0EA] px-3 py-2.5 font-normal"
            value={draft.name}
            onChange={(event) => set('name', event.target.value)}
          />
        </div>
        <div className="text-sm font-semibold">
          <FieldLabel
            label="Slug"
            htmlFor={`specialization-${row.id}-slug`}
            help={commonFieldHelp.slug}
          />
          <input
            id={`specialization-${row.id}-slug`}
            className="mt-2 w-full rounded-xl border border-[#D9E0EA] px-3 py-2.5 font-normal"
            value={draft.slug}
            onChange={(event) => set('slug', event.target.value)}
          />
        </div>
      </div>

      <div className="mt-4 text-sm font-semibold">
        <FieldLabel
          label="Short description"
          htmlFor={`specialization-${row.id}-short-description`}
          required
          help={commonFieldHelp.shortDescription}
        />
        <textarea
          id={`specialization-${row.id}-short-description`}
          required
          rows={3}
          maxLength={1000}
          className="mt-2 w-full rounded-xl border border-[#D9E0EA] px-3 py-2.5 font-normal"
          value={draft.shortDescription}
          onChange={(event) => set('shortDescription', event.target.value)}
        />
      </div>

      <div className="mt-4 text-sm font-semibold">
        <FieldLabel
          label="Overview"
          htmlFor={`specialization-${row.id}-overview`}
          help={commonFieldHelp.overview}
        />
        <textarea
          id={`specialization-${row.id}-overview`}
          rows={5}
          maxLength={20000}
          className="mt-2 w-full rounded-xl border border-[#D9E0EA] px-3 py-2.5 font-normal"
          value={draft.overview}
          onChange={(event) => set('overview', event.target.value)}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <MediaPickerDialog
          label="Icon media"
          value={draft.iconMediaId}
          media={media}
          onChange={(value) => set('iconMediaId', value)}
          help={commonFieldHelp.media}
        />
        <MediaPickerDialog
          label="Listing media"
          value={draft.listingMediaId}
          media={media}
          onChange={(value) => set('listingMediaId', value)}
          help={commonFieldHelp.media}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="text-sm font-semibold">
          <FieldLabel
            label="Display order"
            htmlFor={`specialization-${row.id}-display-order`}
            help={commonFieldHelp.displayOrder}
          />
          <input
            id={`specialization-${row.id}-display-order`}
            type="number"
            min="0"
            className="mt-2 w-full rounded-xl border border-[#D9E0EA] px-3 py-2.5 font-normal"
            value={draft.displayOrder}
            onChange={(event) => set('displayOrder', event.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 self-end pb-3 text-sm font-semibold">
          <input
            id={`specialization-${row.id}-featured`}
            type="checkbox"
            checked={draft.isFeatured}
            onChange={(event) => set('isFeatured', event.target.checked)}
          />
          <FieldLabel
            label="Featured specialization"
            htmlFor={`specialization-${row.id}-featured`}
            help={commonFieldHelp.featured}
          />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={onDelete}
          className="rounded-lg border border-[#F2C5C5] px-4 py-2 text-sm font-semibold text-[#B42318]"
        >
          Delete
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="rounded-lg border border-[#1657CF] px-4 py-2 text-sm font-semibold text-[#1657CF] disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save specialization'}
        </button>
      </div>
    </article>
  );
}
