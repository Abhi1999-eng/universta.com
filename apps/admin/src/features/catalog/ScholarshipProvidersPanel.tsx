'use client';

import { useCallback, useEffect, useState } from 'react';
import { authFetch } from '@/features/auth/auth-client';
import { FieldLabel } from '@/features/shared/FieldLabel';
import { commonFieldHelp } from '@/lib/field-help/common';

type ProviderRow = {
  id: string;
  name: string;
  slug: string;
  websiteUrl?: string | null;
  sourceReference?: string | null;
  status: string;
  _count?: { scholarships?: number };
};

type ProviderForm = {
  name: string;
  slug: string;
  websiteUrl: string;
  sourceReference: string;
  status: string;
};

const emptyForm: ProviderForm = {
  name: '',
  slug: '',
  websiteUrl: '',
  sourceReference: '',
  status: 'ACTIVE',
};

async function providerApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authFetch(`/api/v1/admin/scholarship-providers${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  const body = (await response.json()) as {
    data?: T;
    error?: { message?: string } | null;
  };
  if (!response.ok || body.error) {
    throw new Error(body.error?.message ?? 'Request failed');
  }
  return body.data as T;
}

export function ScholarshipProvidersPanel() {
  const [rows, setRows] = useState<ProviderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ProviderRow | null>(null);
  const [form, setForm] = useState<ProviderForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    providerApi<ProviderRow[]>('?status=')
      .then(setRows)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error
            ? cause.message
            : 'Unable to load scholarship providers',
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // State changes after the request resolves, not synchronously in the effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setEditorOpen(true);
    setError('');
  }

  function openEdit(row: ProviderRow) {
    setEditing(row);
    setForm({
      name: row.name,
      slug: row.slug,
      websiteUrl: row.websiteUrl ?? '',
      sourceReference: row.sourceReference ?? '',
      status: row.status,
    });
    setEditorOpen(true);
    setError('');
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditing(null);
    setForm(emptyForm);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name.trim(),
        ...(form.slug.trim() ? { slug: form.slug.trim() } : {}),
        websiteUrl: form.websiteUrl.trim() || null,
        sourceReference: form.sourceReference.trim() || null,
        status: form.status,
      };
      if (editing) {
        await providerApi(`/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await providerApi('', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      closeEditor();
      load();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Unable to save provider');
    } finally {
      setSaving(false);
    }
  }

  async function toggle(row: ProviderRow) {
    setBusyId(row.id);
    setError('');
    try {
      await providerApi(`/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: row.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
        }),
      });
      load();
    } catch (cause: unknown) {
      setError(
        cause instanceof Error ? cause.message : 'Unable to update provider status',
      );
    } finally {
      setBusyId(null);
    }
  }

  async function archive(row: ProviderRow) {
    const inUse = row._count?.scholarships ?? 0;
    if (inUse > 0) {
      setError(
        `${row.name} is used by ${inUse} scholarship${inUse === 1 ? '' : 's'}. Reassign those scholarships before archiving this provider.`,
      );
      return;
    }
    if (
      !window.confirm(
        `Archive "${row.name}"? It will disappear from normal provider management, but this is not a permanent delete.`,
      )
    ) {
      return;
    }
    setBusyId(row.id);
    setError('');
    try {
      await providerApi(`/${row.id}`, { method: 'DELETE' });
      load();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Unable to archive provider');
    } finally {
      setBusyId(null);
    }
  }

  async function removePermanently(row: ProviderRow) {
    const inUse = row._count?.scholarships ?? 0;
    if (inUse > 0) {
      setError(
        `${row.name} is used by ${inUse} scholarship${inUse === 1 ? '' : 's'}. Reassign those scholarships before permanently deleting this provider.`,
      );
      return;
    }
    if (
      !window.confirm(
        `Permanently delete "${row.name}"? This cannot be undone.`,
      )
    ) {
      return;
    }
    setBusyId(row.id);
    setError('');
    try {
      await providerApi(`/${row.id}/permanent`, { method: 'DELETE' });
      load();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Unable to delete provider');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="rounded-2xl border border-[#E8ECF3] bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#828B9B]">
            Master data
          </p>
          <h3 className="mt-2 text-xl font-semibold">Scholarship providers</h3>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-[#667085]">
            Manage the organisation behind a scholarship. Edit provider details,
            deactivate it temporarily, archive it, or permanently delete an
            unreferenced provider.
          </p>
        </div>
        <button
          type="button"
          onClick={editorOpen ? closeEditor : openCreate}
          className="rounded-xl bg-[#1657CF] px-4 py-2 text-sm font-semibold text-white"
        >
          {editorOpen ? 'Close' : 'Add provider'}
        </button>
      </div>

      {error ? (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-[#F2C5C5] bg-[#FFF7F7] px-4 py-3 text-sm font-semibold text-[#B42318]"
        >
          {error}
        </div>
      ) : null}

      {editorOpen ? (
        <form
          onSubmit={(event) => void save(event)}
          className="mt-5 space-y-4 rounded-xl border border-[#E8ECF3] p-4"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#828B9B]">
              {editing ? `Editing: ${editing.name}` : 'New provider'}
            </p>
            <p className="mt-1 text-xs text-[#667085]">
              Slug is generated automatically from the name when left blank.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="text-sm font-semibold">
              <FieldLabel
                label="Name"
                htmlFor="provider-name"
                required
                helpKey="scholarship-providers.name"
              />
              <input
                id="provider-name"
                required
                className="mt-1 w-full rounded-lg border border-[#D9E0EA] px-3 py-2 font-normal"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
              />
            </div>

            <div className="text-sm font-semibold">
              <FieldLabel
                label="Slug (optional)"
                htmlFor="provider-slug"
                help={commonFieldHelp.slug}
              />
              <input
                id="provider-slug"
                pattern="[a-z0-9-]+"
                placeholder="auto-generated-from-name"
                className="mt-1 w-full rounded-lg border border-[#D9E0EA] px-3 py-2 font-normal"
                value={form.slug}
                onChange={(event) =>
                  setForm((current) => ({ ...current, slug: event.target.value }))
                }
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="text-sm font-semibold">
              <FieldLabel
                label="Website URL (optional)"
                htmlFor="provider-website"
                help={commonFieldHelp.websiteUrl}
              />
              <input
                id="provider-website"
                type="url"
                placeholder="https://provider.example"
                className="mt-1 w-full rounded-lg border border-[#D9E0EA] px-3 py-2 font-normal"
                value={form.websiteUrl}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    websiteUrl: event.target.value,
                  }))
                }
              />
            </div>

            <div className="text-sm font-semibold">
              <FieldLabel
                label="Source / reference URL (optional)"
                htmlFor="provider-source"
                help={commonFieldHelp.sourceUrl}
              />
              <input
                id="provider-source"
                type="url"
                placeholder="https://official-source.example"
                className="mt-1 w-full rounded-lg border border-[#D9E0EA] px-3 py-2 font-normal"
                value={form.sourceReference}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    sourceReference: event.target.value,
                  }))
                }
              />
            </div>
          </div>

          <div className="max-w-sm text-sm font-semibold">
            <FieldLabel label="Status" htmlFor="provider-status" />
            <select
              id="provider-status"
              className="mt-1 w-full rounded-lg border border-[#D9E0EA] px-3 py-2 font-normal"
              value={form.status}
              onChange={(event) =>
                setForm((current) => ({ ...current, status: event.target.value }))
              }
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={closeEditor}
              className="rounded-lg border border-[#D9E0EA] px-4 py-2 text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              disabled={saving}
              className="rounded-lg bg-[#1657CF] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create provider'}
            </button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <p className="mt-5 text-sm text-[#667085]">Loading…</p>
      ) : (
        <div className="mt-5 divide-y divide-[#E8ECF3]">
          {rows.map((row) => {
            const inUse = row._count?.scholarships ?? 0;
            const busy = busyId === row.id;
            return (
              <div
                key={row.id}
                className="flex flex-col gap-4 py-4 xl:flex-row xl:items-center xl:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-semibold">{row.name}</p>
                  <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-[#828B9B]">
                    <span>{row.slug}</span>
                    <span>·</span>
                    <span>{row.status}</span>
                    <span>·</span>
                    <span>
                      {inUse} scholarship{inUse === 1 ? '' : 's'}
                    </span>
                  </div>
                  {row.websiteUrl ? (
                    <a
                      href={row.websiteUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block break-all text-xs font-semibold text-[#1657CF] hover:underline"
                    >
                      {row.websiteUrl}
                    </a>
                  ) : null}
                  {row.sourceReference ? (
                    <p className="mt-1 break-all text-xs text-[#667085]">
                      Source: {row.sourceReference}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => openEdit(row)}
                    className="rounded-lg border border-[#D9E0EA] px-3 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void toggle(row)}
                    className="rounded-lg border border-[#D9E0EA] px-3 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    {row.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    type="button"
                    disabled={busy || inUse > 0}
                    title={
                      inUse > 0
                        ? 'Reassign referenced scholarships before archiving.'
                        : 'Archive provider while preserving its record.'
                    }
                    onClick={() => void archive(row)}
                    className="rounded-lg border border-[#E7D7B0] px-3 py-2 text-sm font-semibold text-[#8A6116] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Archive
                  </button>
                  <button
                    type="button"
                    disabled={busy || inUse > 0}
                    title={
                      inUse > 0
                        ? 'Reassign referenced scholarships before permanent deletion.'
                        : 'Permanently delete this unreferenced provider.'
                    }
                    onClick={() => void removePermanently(row)}
                    className="rounded-lg border border-[#F2C5C5] px-3 py-2 text-sm font-semibold text-[#B42318] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
          {rows.length === 0 ? (
            <p className="py-4 text-sm text-[#667085]">No records found.</p>
          ) : null}
        </div>
      )}
    </section>
  );
}
