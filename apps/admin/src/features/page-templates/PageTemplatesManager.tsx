"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/features/auth/auth-client";

export const PAGE_FAMILIES = [
  "HOME",
  "DIRECTORY_LISTING",
  "ENTITY_DETAIL",
  "UNIVERSITY_DETAIL",
  "UNIVERSITY_COURSES_LISTING",
  "UNIVERSITY_COURSE_OFFERING_DETAIL",
  "SUBJECT_LISTING",
  "SUBJECT_DETAIL",
  "SCHOLARSHIP_LISTING",
  "SCHOLARSHIP_DETAIL",
  "COUNSELLING_FORM",
  "EDITORIAL_PAGE",
  "COMPARISON_PAGE",
];
const SECTION_TYPES = [
  "HERO", "RICH_TEXT", "CTA", "IMAGE", "IMAGE_TEXT", "CARD_GRID", "STATS",
  "FAQ_GROUP", "RELATED_LINKS", "COUNTRY_DIRECTORY", "UNIVERSITY_DIRECTORY",
  "COURSE_DIRECTORY", "SCHOLARSHIP_DIRECTORY", "CONSULTANT_DIRECTORY",
  "TESTIMONIALS", "SUCCESS_STORIES", "LEAD_GENERATION", "CUSTOM",
];

type TemplateSection = { sectionKey: string; sectionType: string; heading?: string; displayOrder: number };
type TemplateRow = {
  id: string;
  name: string;
  templateKey: string;
  description: string | null;
  pageFamily: string;
  defaultSectionsJson: TemplateSection[];
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { pages: number };
};

const inputClass =
  "mt-1 w-full rounded-xl border border-[#D9E0EA] bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#1657CF] focus:ring-2 focus:ring-[#DCE8FF]";
const buttonClass = "rounded-xl bg-[#1657CF] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authFetch(`/api/v1/admin/page-templates${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = (await response.json()) as { data?: T; error?: { message?: string } | null };
  if (!response.ok || body.error) throw new Error(body.error?.message ?? "Request failed");
  return body.data as T;
}

function emptySection(order: number): TemplateSection {
  return { sectionKey: "", sectionType: "RICH_TEXT", heading: "", displayOrder: order };
}

export function PageTemplatesManager() {
  const [rows, setRows] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"error" | "info">("error");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<TemplateRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [previewRow, setPreviewRow] = useState<TemplateRow | null>(null);

  const [name, setName] = useState("");
  const [templateKey, setTemplateKey] = useState("");
  const [description, setDescription] = useState("");
  const [pageFamily, setPageFamily] = useState(PAGE_FAMILIES[0]);
  const [isActive, setIsActive] = useState(true);
  const [sections, setSections] = useState<TemplateSection[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await api<TemplateRow[]>(`?includeArchived=${showArchived}`));
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Unable to load templates");
    } finally {
      setLoading(false);
    }
  }, [showArchived]);

  useEffect(() => {
    // The state update happens only after the asynchronous request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setName(""); setTemplateKey(""); setDescription("");
    setPageFamily(PAGE_FAMILIES[0]); setIsActive(true);
    setSections([emptySection(0)]);
    setCreating(true);
  }
  function openEdit(row: TemplateRow) {
    setEditing(row);
    setName(row.name); setTemplateKey(row.templateKey); setDescription(row.description ?? "");
    setPageFamily(row.pageFamily); setIsActive(row.isActive);
    setSections((row.defaultSectionsJson ?? []).length ? row.defaultSectionsJson : [emptySection(0)]);
    setCreating(true);
  }

  function updateSection(index: number, patch: Partial<TemplateSection>) {
    setSections((current) => current.map((section, i) => (i === index ? { ...section, ...patch } : section)));
  }
  function addSection() {
    setSections((current) => [...current, emptySection(current.length)]);
  }
  function removeSection(index: number) {
    setSections((current) => current.filter((_, i) => i !== index));
  }
  function moveSection(index: number, direction: -1 | 1) {
    setSections((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = current.slice();
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((section, i) => ({ ...section, displayOrder: i }));
    });
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const payload = {
        name,
        templateKey: templateKey || undefined,
        description: description || null,
        pageFamily,
        isActive,
        defaultSections: sections.map((section, i) => ({ ...section, displayOrder: i })),
      };
      if (editing) await api(`/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      else await api("", { method: "POST", body: JSON.stringify(payload) });
      setCreating(false);
      setEditing(null);
      await load();
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Unable to save template");
    } finally {
      setSaving(false);
    }
  }

  async function duplicate(row: TemplateRow) {
    try {
      await api(`/${row.id}/duplicate`, { method: "POST" });
      setMessageTone("info");
      setMessage(`Duplicated "${row.name}" as an inactive draft copy.`);
      await load();
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Unable to duplicate template");
    }
  }

  async function archive(row: TemplateRow) {
    if (!window.confirm(`Archive "${row.name}"? Archived templates can no longer be assigned to a page.`)) return;
    try {
      await api(`/${row.id}`, { method: "DELETE" });
      await load();
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Unable to archive template");
    }
  }

  return (
    <section className="mx-auto max-w-[1180px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#828B9B]">Content management</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Page templates</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
            Reusable starting structures for a page family. In Website Pages, Apply template saves the assignment and
            adds only missing sections, without changing existing content.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-[#48505F]">
            <input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />
            Show archived
          </label>
          <button type="button" onClick={openCreate} className={buttonClass}>Create template</button>
        </div>
      </div>

      {message ? (
        <p
          className={`mt-4 text-sm font-semibold ${messageTone === "error" ? "text-[#B42318]" : "text-[#18794E]"}`}
          role={messageTone === "error" ? "alert" : "status"}
        >
          {message}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-8 text-sm text-[#667085]">Loading…</p>
      ) : (
        <div className="mt-8 grid gap-4">
          {rows.map((row) => (
            <div key={row.id} className="rounded-2xl border border-[#E8ECF3] bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">{row.name}</h3>
                    {!row.isActive ? (
                      <span className="rounded-full bg-[#F2E8CF] px-2 py-0.5 text-[10px] font-bold uppercase text-[#8A6D1D]">
                        {row.deletedAt ? "Archived" : "Inactive"}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-[#828B9B]">
                    {row.templateKey} · {row.pageFamily.replaceAll("_", " ")} · {row._count?.pages ?? 0} page(s) assigned
                  </p>
                  {row.description ? <p className="mt-2 max-w-2xl text-sm text-[#48505F]">{row.description}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setPreviewRow(row)} className="rounded-lg border border-[#D9E0EA] px-3 py-2 text-sm font-semibold">Preview</button>
                  <button type="button" onClick={() => openEdit(row)} className="rounded-lg border border-[#D9E0EA] px-3 py-2 text-sm font-semibold">Edit</button>
                  <button type="button" onClick={() => void duplicate(row)} className="rounded-lg border border-[#D9E0EA] px-3 py-2 text-sm font-semibold">Duplicate</button>
                  <button type="button" onClick={() => void archive(row)} className="rounded-lg border border-[#F2C5C5] px-3 py-2 text-sm font-semibold text-[#B42318]">Archive</button>
                </div>
              </div>
            </div>
          ))}
          {rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#D9E0EA] bg-white p-8 text-center text-sm text-[#667085]">
              No page templates yet. <button type="button" onClick={openCreate} className="font-semibold text-[#1657CF]">Create the first one</button>.
            </div>
          ) : null}
        </div>
      )}

      {creating ? (
        <div role="dialog" aria-modal="true" aria-label={editing ? "Edit template" : "Create template"} className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-10">
          <form onSubmit={(event) => void save(event)} className="w-full max-w-2xl space-y-5 rounded-2xl bg-white p-6 sm:p-8">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">{editing ? "Edit template" : "Create template"}</h3>
              <button type="button" onClick={() => setCreating(false)} className="text-sm font-semibold text-[#667085]">Close</button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold">Name
                <input required className={inputClass} value={name} onChange={(event) => setName(event.target.value)} />
              </label>
              <label className="text-sm font-semibold">Template key (optional, auto-generated)
                <input className={inputClass} value={templateKey} onChange={(event) => setTemplateKey(event.target.value)} />
              </label>
              <label className="text-sm font-semibold sm:col-span-2">Description
                <textarea className={`${inputClass} min-h-16`} value={description} onChange={(event) => setDescription(event.target.value)} />
              </label>
              <label className="text-sm font-semibold">Page family
                <select className={inputClass} value={pageFamily} onChange={(event) => setPageFamily(event.target.value)}>
                  {PAGE_FAMILIES.map((family) => <option key={family} value={family}>{family.replaceAll("_", " ")}</option>)}
                </select>
              </label>
              <label className="mt-6 flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
                Active (assignable to pages)
              </label>
            </div>

            <fieldset className="rounded-xl border border-[#E8ECF3] p-4">
              <legend className="px-1 text-sm font-semibold">Sections included in this template</legend>
              <div className="space-y-3">
                {sections.map((section, index) => (
                  <div key={index} className="grid gap-2 rounded-lg border border-[#E8ECF3] p-3 sm:grid-cols-[1fr_1fr_auto]">
                    <label className="text-xs font-semibold">Section type
                      <select className={inputClass} value={section.sectionType} onChange={(event) => updateSection(index, { sectionType: event.target.value })}>
                        {SECTION_TYPES.map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}
                      </select>
                    </label>
                    <label className="text-xs font-semibold">Default heading (optional)
                      <input className={inputClass} value={section.heading ?? ""} onChange={(event) => updateSection(index, { heading: event.target.value })} />
                    </label>
                    <div className="flex items-end gap-1">
                      <button type="button" onClick={() => moveSection(index, -1)} disabled={index === 0} className="rounded-lg border border-[#D9E0EA] px-2 py-2.5 text-xs font-semibold disabled:opacity-40">↑</button>
                      <button type="button" onClick={() => moveSection(index, 1)} disabled={index === sections.length - 1} className="rounded-lg border border-[#D9E0EA] px-2 py-2.5 text-xs font-semibold disabled:opacity-40">↓</button>
                      <button type="button" onClick={() => removeSection(index)} className="rounded-lg border border-[#F2C5C5] px-2 py-2.5 text-xs font-semibold text-[#B42318]">Remove</button>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={addSection} className="rounded-lg border border-dashed border-[#D9E0EA] px-3 py-2 text-sm font-semibold text-[#1657CF]">
                  + Add section
                </button>
              </div>
            </fieldset>

            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setCreating(false)} className="rounded-xl border border-[#D9E0EA] px-4 py-2.5 text-sm font-semibold">Cancel</button>
              <button disabled={saving} className={buttonClass}>{saving ? "Saving…" : "Save template"}</button>
            </div>
          </form>
        </div>
      ) : null}

      {previewRow ? (
        <div role="dialog" aria-modal="true" aria-label="Template preview" className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-10">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 sm:p-8">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">{previewRow.name}</h3>
              <button type="button" onClick={() => setPreviewRow(null)} className="text-sm font-semibold text-[#667085]">Close</button>
            </div>
            <p className="mt-1 text-xs text-[#828B9B]">{previewRow.pageFamily.replaceAll("_", " ")}</p>
            <ol className="mt-5 space-y-3">
              {(previewRow.defaultSectionsJson ?? []).map((section, index) => (
                <li key={section.sectionKey} className="rounded-xl border border-[#E8ECF3] p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#828B9B]">{index + 1}. {section.sectionType.replaceAll("_", " ")}</p>
                  {section.heading ? <p className="mt-1 text-sm font-semibold">{section.heading}</p> : <p className="mt-1 text-sm text-[#9AA3B2]">No default heading</p>}
                </li>
              ))}
              {(previewRow.defaultSectionsJson ?? []).length === 0 ? (
                <p className="text-sm text-[#667085]">This template has no sections included yet.</p>
              ) : null}
            </ol>
          </div>
        </div>
      ) : null}
    </section>
  );
}
