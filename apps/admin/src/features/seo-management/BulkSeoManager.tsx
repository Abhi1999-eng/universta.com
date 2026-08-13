"use client";

import { useEffect, useMemo, useState } from "react";
import { authFetch } from "@/features/auth/auth-client";

type Template = {
  seoTitleTemplate: string | null;
  metaDescriptionTemplate: string | null;
  ogTitleTemplate: string | null;
  ogDescriptionTemplate: string | null;
  canonicalTemplate: string | null;
  robotsIndex: boolean | null;
  robotsFollow: boolean | null;
};
type Definition = {
  key: string;
  label: string;
  variables: Array<{ key: string; label: string }>;
  template: Template | null;
};
type Preview = {
  record: { id: string; label: string } | null;
  resolved: {
    seoTitle: string;
    metaDescription: string;
    canonicalUrl: string;
    source: { title: string; description: string };
  } | null;
  message: string | null;
};

const inputClass =
  "mt-1 w-full rounded-xl border border-[#D9E0EA] bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#1657CF] focus:ring-2 focus:ring-[#DCE8FF]";
const blank: Template = {
  seoTitleTemplate: "",
  metaDescriptionTemplate: "",
  ogTitleTemplate: "",
  ogDescriptionTemplate: "",
  canonicalTemplate: "",
  robotsIndex: null,
  robotsFollow: null,
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authFetch(`/api/v1/admin/seo-management${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = (await response.json()) as {
    data?: T;
    error?: { message?: string } | null;
  };
  if (!response.ok || body.error)
    throw new Error(body.error?.message ?? "Request failed");
  return body.data as T;
}

function normalise(template: Template | null): Template {
  return { ...blank, ...(template ?? {}) };
}

export function BulkSeoManager() {
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [value, setValue] = useState<Template>(blank);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const selected = useMemo(
    () =>
      definitions.find((definition) => definition.key === selectedKey) ?? null,
    [definitions, selectedKey],
  );

  useEffect(() => {
    void api<Definition[]>("/templates")
      .then((rows) => {
        setDefinitions(rows);
        const initial = rows[0];
        if (initial) {
          setSelectedKey(initial.key);
          setValue(normalise(initial.template));
        }
      })
      .catch((error: unknown) => {
        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to load bulk SEO templates",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  function changeEntity(key: string) {
    const definition = definitions.find((item) => item.key === key);
    setSelectedKey(key);
    setValue(normalise(definition?.template ?? null));
    setPreview(null);
    setMessage("");
  }
  function set(field: keyof Template, next: string | boolean | null) {
    setValue((current) => ({ ...current, [field]: next }));
  }
  async function showPreview() {
    if (!selected) return;
    setMessage("");
    try {
      setPreview(
        await api<Preview>(`/templates/${selected.key}/preview`, {
          method: "POST",
          body: JSON.stringify(value),
        }),
      );
    } catch (error) {
      setPreview(null);
      setMessage(
        error instanceof Error ? error.message : "Unable to render preview",
      );
    }
  }
  async function save() {
    if (!selected) return;
    setSaving(true);
    setMessage("");
    try {
      const saved = await api<Template>(`/templates/${selected.key}`, {
        method: "PUT",
        body: JSON.stringify(value),
      });
      setValue(normalise(saved));
      setDefinitions((current) =>
        current.map((row) =>
          row.key === selected.key ? { ...row, template: saved } : row,
        ),
      );
      setMessage("Saved. Existing manual SEO overrides remain unchanged.");
      await showPreview();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to save template",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return (
      <p className="mt-6 text-sm text-[#667085]">Loading bulk SEO templates…</p>
    );
  return (
    <div className="mt-6 rounded-2xl border border-[#E8ECF3] bg-white p-5 sm:p-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
        <label className="block text-sm font-semibold text-[#344054]">
          Public entity type
          <select
            value={selectedKey}
            onChange={(event) => changeEntity(event.target.value)}
            className={inputClass}
          >
            {definitions.map((definition) => (
              <option key={definition.key} value={definition.key}>
                {definition.label}
              </option>
            ))}
          </select>
        </label>
        <div className="rounded-xl bg-[#F7F9FC] px-4 py-3 text-sm text-[#475467]">
          <p className="font-semibold text-[#344054]">Available variables</p>
          <p className="mt-1 leading-6">
            {selected?.variables
              .map((variable) => `{${variable.key}} — ${variable.label}`)
              .join(" · ")}
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-[#344054]">
          SEO title template
          <input
            className={inputClass}
            value={value.seoTitleTemplate ?? ""}
            onChange={(event) => set("seoTitleTemplate", event.target.value)}
            placeholder="{universityName} in {countryName}"
          />
        </label>
        <label className="block text-sm font-semibold text-[#344054]">
          Open Graph title template (optional)
          <input
            className={inputClass}
            value={value.ogTitleTemplate ?? ""}
            onChange={(event) => set("ogTitleTemplate", event.target.value)}
          />
        </label>
        <label className="block text-sm font-semibold text-[#344054] sm:col-span-2">
          Meta description template
          <textarea
            className={`${inputClass} min-h-24`}
            value={value.metaDescriptionTemplate ?? ""}
            onChange={(event) =>
              set("metaDescriptionTemplate", event.target.value)
            }
            placeholder="Explore {courseName} at {universityName}."
          />
        </label>
        <label className="block text-sm font-semibold text-[#344054] sm:col-span-2">
          Open Graph description template (optional)
          <textarea
            className={`${inputClass} min-h-20`}
            value={value.ogDescriptionTemplate ?? ""}
            onChange={(event) =>
              set("ogDescriptionTemplate", event.target.value)
            }
          />
        </label>
        <label className="block text-sm font-semibold text-[#344054] sm:col-span-2">
          Canonical template (optional)
          <input
            className={inputClass}
            value={value.canonicalTemplate ?? ""}
            onChange={(event) => set("canonicalTemplate", event.target.value)}
            placeholder="Use a site-relative route and an available slug variable"
          />
        </label>
        <label className="block text-sm font-semibold text-[#344054]">
          Indexing behaviour
          <select
            className={inputClass}
            value={
              value.robotsIndex === null ? "inherit" : String(value.robotsIndex)
            }
            onChange={(event) =>
              set(
                "robotsIndex",
                event.target.value === "inherit"
                  ? null
                  : event.target.value === "true",
              )
            }
          >
            <option value="inherit">Inherit global default</option>
            <option value="true">Allow indexing</option>
            <option value="false">Noindex</option>
          </select>
        </label>
        <label className="block text-sm font-semibold text-[#344054]">
          Link following behaviour
          <select
            className={inputClass}
            value={
              value.robotsFollow === null
                ? "inherit"
                : String(value.robotsFollow)
            }
            onChange={(event) =>
              set(
                "robotsFollow",
                event.target.value === "inherit"
                  ? null
                  : event.target.value === "true",
              )
            }
          >
            <option value="inherit">Inherit global default</option>
            <option value="true">Allow following links</option>
            <option value="false">Nofollow</option>
          </select>
        </label>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void showPreview()}
          className="rounded-xl border border-[#1657CF] px-4 py-2.5 text-sm font-semibold text-[#1657CF]"
        >
          Preview
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="rounded-xl bg-[#1657CF] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save bulk SEO"}
        </button>
        {message ? (
          <p
            role={message.startsWith("Saved") ? "status" : "alert"}
            className={`text-sm font-semibold ${message.startsWith("Saved") ? "text-[#18794E]" : "text-[#B42318]"}`}
          >
            {message}
          </p>
        ) : null}
      </div>
      {preview ? (
        <section
          className="mt-5 rounded-xl border border-[#DCE8FF] bg-[#F7FAFF] p-4"
          aria-label="Bulk SEO preview"
        >
          {preview.resolved ? (
            <>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1657CF]">
                Preview using {preview.record?.label}
              </p>
              <p className="mt-2 font-semibold text-[#0D1524]">
                {preview.resolved.seoTitle}
              </p>
              <p className="mt-1 text-sm leading-6 text-[#475467]">
                {preview.resolved.metaDescription}
              </p>
              <p className="mt-2 break-all text-xs text-[#667085]">
                Canonical: {preview.resolved.canonicalUrl}
              </p>
            </>
          ) : (
            <p className="text-sm text-[#667085]">{preview.message}</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
