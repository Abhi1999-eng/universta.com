"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/features/auth/auth-client";

type SectionRef = { id: string; heading?: string | null; sectionKey: string; pageId: string };
type Variant = {
  id: string;
  key: string;
  name: string;
  isControl: boolean;
  trafficWeight: number;
  eyebrow?: string | null;
  heading?: string | null;
  subheading?: string | null;
  ctaPrimaryLabel?: string | null;
  ctaPrimaryUrl?: string | null;
};
type Experiment = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  status: string;
  startsAt?: string | null;
  endsAt?: string | null;
  section: SectionRef;
  variants: Variant[];
};
type PageSummary = { id: string; title: string; slug: string };
type PageDetail = PageSummary & { sections?: SectionRef[] };
type StatRow = {
  variantId: string;
  key: string;
  name: string;
  isControl: boolean;
  exposureCount: number;
  conversionCount: number;
  conversionRate: number;
};

const STATUSES = ["DRAFT", "SCHEDULED", "ACTIVE", "ARCHIVED"];

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authFetch(`/api/v1/admin${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = (await response.json()) as { data?: T; error?: { message?: string } | null };
  if (!response.ok || body.error) throw new Error(body.error?.message ?? "Request failed");
  return body.data as T;
}

const inputClass =
  "mt-1 w-full rounded-xl border border-[#D9E0EA] bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#1657CF] focus:ring-2 focus:ring-[#DCE8FF]";
const buttonClass = "rounded-xl bg-[#1657CF] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60";
const secondaryButtonClass = "rounded-xl border border-[#D9E0EA] px-4 py-2.5 text-sm font-semibold text-[#48505F]";

export function ExperimentsManager() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [message, setMessage] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stats, setStats] = useState<StatRow[] | null>(null);

  const [newPageId, setNewPageId] = useState("");
  const [pageSections, setPageSections] = useState<SectionRef[]>([]);
  const [newSectionId, setNewSectionId] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const [variantName, setVariantName] = useState("");
  const [variantWeight, setVariantWeight] = useState("50");
  const [variantIsControl, setVariantIsControl] = useState(false);
  const [savingVariant, setSavingVariant] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api<Experiment[]>("/experiments");
      setExperiments(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load experiments");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    void api<PageSummary[]>("/phase1/pages").then(setPages).catch(() => undefined);
  }, [load]);

  useEffect(() => {
    const sections = newPageId
      ? api<PageDetail>(`/phase1/pages/${newPageId}`)
          .then((page) => page.sections ?? [])
          .catch(() => [])
      : Promise.resolve([]);
    void sections.then(setPageSections);
  }, [newPageId]);

  const selected = experiments.find((experiment) => experiment.id === selectedId) ?? null;

  async function createExperiment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newSectionId || !newName.trim()) {
      setMessage("Choose a section and enter a name.");
      return;
    }
    setCreating(true);
    setMessage("");
    try {
      const created = await api<Experiment>("/experiments", {
        method: "POST",
        body: JSON.stringify({ name: newName.trim(), sectionId: newSectionId }),
      });
      setNewName("");
      setNewPageId("");
      setNewSectionId("");
      await load();
      setSelectedId(created.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create experiment");
    } finally {
      setCreating(false);
    }
  }

  async function updateStatus(experiment: Experiment, status: string) {
    try {
      await api(`/experiments/${experiment.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update status");
    }
  }

  async function archive(experiment: Experiment) {
    try {
      await api(`/experiments/${experiment.id}`, { method: "DELETE" });
      setMessage("Archived.");
      if (selectedId === experiment.id) setSelectedId(null);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to archive");
    }
  }

  async function addVariant(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !variantName.trim()) return;
    setSavingVariant(true);
    try {
      await api(`/experiments/${selected.id}/variants`, {
        method: "POST",
        body: JSON.stringify({
          name: variantName.trim(),
          isControl: variantIsControl,
          trafficWeight: Number(variantWeight) || 0,
        }),
      });
      setVariantName("");
      setVariantWeight("50");
      setVariantIsControl(false);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to add variant");
    } finally {
      setSavingVariant(false);
    }
  }

  async function saveVariant(variant: Variant, patch: Partial<Variant>) {
    if (!selected) return;
    try {
      await api(`/experiments/${selected.id}/variants/${variant.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          eyebrow: patch.eyebrow ?? variant.eyebrow ?? "",
          heading: patch.heading ?? variant.heading ?? "",
          subheading: patch.subheading ?? variant.subheading ?? "",
          ctaPrimaryLabel: patch.ctaPrimaryLabel ?? variant.ctaPrimaryLabel ?? "",
          ctaPrimaryUrl: patch.ctaPrimaryUrl ?? variant.ctaPrimaryUrl ?? "",
          trafficWeight: patch.trafficWeight ?? variant.trafficWeight,
        }),
      });
      setMessage("Variant saved.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save variant");
    }
  }

  async function removeVariant(variant: Variant) {
    if (!selected) return;
    try {
      await api(`/experiments/${selected.id}/variants/${variant.id}`, { method: "DELETE" });
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to remove variant — an experiment needs at least one variant");
    }
  }

  async function loadStats(experiment: Experiment) {
    setSelectedId(experiment.id);
    setStats(null);
    try {
      const data = await api<StatRow[]>(`/experiments/${experiment.id}/stats`);
      setStats(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load stats");
    }
  }

  return (
    <section className="mx-auto max-w-[1240px]">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#828B9B]">A/B testing</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Experiments</h2>
        <p className="mt-2 text-sm text-[#667085]">
          Run bot-safe, deterministic variant tests against a single CMS section. Each
          visitor sees the same variant on every visit; search crawlers always see the
          control content.
        </p>
      </div>

      <form
        onSubmit={(event) => void createExperiment(event)}
        className="mt-6 grid gap-4 rounded-2xl border border-[#E8ECF3] bg-white p-5 sm:grid-cols-3"
      >
        <div>
          <label className="text-sm font-semibold" htmlFor="exp-page">
            Page
          </label>
          <select
            id="exp-page"
            className={inputClass}
            value={newPageId}
            onChange={(event) => {
              setNewPageId(event.target.value);
              setNewSectionId("");
            }}
          >
            <option value="">Select a page…</option>
            {pages.map((page) => (
              <option key={page.id} value={page.id}>
                {page.title} ({page.slug})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-semibold" htmlFor="exp-section">
            Section
          </label>
          <select
            id="exp-section"
            className={inputClass}
            value={newSectionId}
            onChange={(event) => setNewSectionId(event.target.value)}
            disabled={!pageSections.length}
          >
            <option value="">Select a section…</option>
            {pageSections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.heading || section.sectionKey}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-semibold" htmlFor="exp-name">
            Experiment name
          </label>
          <input
            id="exp-name"
            className={inputClass}
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Home hero CTA copy test"
          />
        </div>
        <div className="sm:col-span-3">
          <button type="submit" disabled={creating} className={buttonClass}>
            {creating ? "Creating…" : "Create experiment"}
          </button>
        </div>
      </form>

      {message ? (
        <p className="mt-4 text-sm text-[#48505F]" role="status">
          {message}
        </p>
      ) : null}

      <div className="mt-6 grid gap-5 lg:grid-cols-[380px_1fr]">
        <div className="space-y-3">
          {experiments.map((experiment) => (
            <button
              key={experiment.id}
              type="button"
              onClick={() => {
                setSelectedId(experiment.id);
                setStats(null);
              }}
              className={`w-full rounded-2xl border p-4 text-left transition ${
                selectedId === experiment.id
                  ? "border-[#1657CF] bg-[#F0F4FA]"
                  : "border-[#E8ECF3] bg-white hover:bg-[#F7F9FC]"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{experiment.name}</p>
                <span className="rounded-full bg-[#EEF2F8] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#48505F]">
                  {experiment.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-[#828B9B]">
                {experiment.section.heading || experiment.section.sectionKey} ·{" "}
                {experiment.variants.length} variant{experiment.variants.length === 1 ? "" : "s"}
              </p>
              <p className="mt-1 font-mono text-[11px] text-[#9AA3B2]">{experiment.key}</p>
            </button>
          ))}
          {experiments.length === 0 ? (
            <p className="text-sm text-[#667085]">No experiments yet.</p>
          ) : null}
        </div>

        {selected ? (
          <div className="rounded-2xl border border-[#E8ECF3] bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">{selected.name}</h3>
                <p className="text-xs text-[#828B9B]">
                  Targets: {selected.section.heading || selected.section.sectionKey}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="rounded-xl border border-[#D9E0EA] bg-white px-3 py-2 text-sm"
                  value={selected.status}
                  onChange={(event) => void updateStatus(selected, event.target.value)}
                >
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void loadStats(selected)}
                  className={secondaryButtonClass}
                >
                  View stats
                </button>
                <button
                  type="button"
                  onClick={() => void archive(selected)}
                  className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700"
                >
                  Archive
                </button>
              </div>
            </div>

            {stats ? (
              <div className="mt-5 overflow-x-auto rounded-xl border border-[#E8ECF3]">
                <table className="w-full text-sm">
                  <thead className="bg-[#F7F9FC] text-left text-xs font-semibold uppercase tracking-[0.08em] text-[#828B9B]">
                    <tr>
                      <th className="px-3 py-2">Variant</th>
                      <th className="px-3 py-2">Exposures</th>
                      <th className="px-3 py-2">Conversions</th>
                      <th className="px-3 py-2">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.map((row) => (
                      <tr key={row.variantId} className="border-t border-[#E8ECF3]">
                        <td className="px-3 py-2 font-medium">
                          {row.name} {row.isControl ? <span className="text-[#828B9B]">(control)</span> : null}
                        </td>
                        <td className="px-3 py-2 tabular-nums">{row.exposureCount}</td>
                        <td className="px-3 py-2 tabular-nums">{row.conversionCount}</td>
                        <td className="px-3 py-2 tabular-nums">{(row.conversionRate * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            <div className="mt-6 space-y-4">
              <h4 className="text-sm font-semibold">Variants</h4>
              {selected.variants.map((variant) => (
                <div key={variant.id} className="rounded-xl border border-[#E8ECF3] p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">
                      {variant.name}{" "}
                      {variant.isControl ? (
                        <span className="text-xs font-normal text-[#828B9B]">(control)</span>
                      ) : null}
                    </p>
                    <button
                      type="button"
                      onClick={() => void removeVariant(variant)}
                      className="text-xs font-semibold text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <input
                      defaultValue={variant.trafficWeight}
                      type="number"
                      min={0}
                      aria-label={`Traffic weight for ${variant.name}`}
                      onBlur={(event) =>
                        void saveVariant(variant, { trafficWeight: Number(event.target.value) || 0 })
                      }
                      className="rounded-lg border border-[#E8ECF3] px-2.5 py-1.5 text-xs"
                      placeholder="Traffic weight"
                    />
                    <input
                      defaultValue={variant.eyebrow ?? ""}
                      aria-label={`Eyebrow for ${variant.name}`}
                      onBlur={(event) => void saveVariant(variant, { eyebrow: event.target.value })}
                      className="rounded-lg border border-[#E8ECF3] px-2.5 py-1.5 text-xs"
                      placeholder="Eyebrow override"
                    />
                    <input
                      defaultValue={variant.heading ?? ""}
                      aria-label={`Heading for ${variant.name}`}
                      onBlur={(event) => void saveVariant(variant, { heading: event.target.value })}
                      className="rounded-lg border border-[#E8ECF3] px-2.5 py-1.5 text-xs sm:col-span-2"
                      placeholder="Heading override"
                    />
                    <input
                      defaultValue={variant.subheading ?? ""}
                      aria-label={`Subheading for ${variant.name}`}
                      onBlur={(event) => void saveVariant(variant, { subheading: event.target.value })}
                      className="rounded-lg border border-[#E8ECF3] px-2.5 py-1.5 text-xs sm:col-span-2"
                      placeholder="Subheading override"
                    />
                    <input
                      defaultValue={variant.ctaPrimaryLabel ?? ""}
                      aria-label={`CTA label for ${variant.name}`}
                      onBlur={(event) => void saveVariant(variant, { ctaPrimaryLabel: event.target.value })}
                      className="rounded-lg border border-[#E8ECF3] px-2.5 py-1.5 text-xs"
                      placeholder="CTA label override"
                    />
                    <input
                      defaultValue={variant.ctaPrimaryUrl ?? ""}
                      aria-label={`CTA URL for ${variant.name}`}
                      onBlur={(event) => void saveVariant(variant, { ctaPrimaryUrl: event.target.value })}
                      className="rounded-lg border border-[#E8ECF3] px-2.5 py-1.5 text-xs"
                      placeholder="CTA URL override"
                    />
                  </div>
                </div>
              ))}

              <form
                onSubmit={(event) => void addVariant(event)}
                className="grid gap-3 rounded-xl border border-dashed border-[#D9E0EA] p-4 sm:grid-cols-3"
              >
                <input
                  value={variantName}
                  onChange={(event) => setVariantName(event.target.value)}
                  placeholder="New variant name"
                  className={inputClass}
                />
                <input
                  value={variantWeight}
                  onChange={(event) => setVariantWeight(event.target.value)}
                  type="number"
                  min={0}
                  placeholder="Traffic weight"
                  className={inputClass}
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={variantIsControl}
                    onChange={(event) => setVariantIsControl(event.target.checked)}
                  />
                  Is control
                </label>
                <div className="sm:col-span-3">
                  <button type="submit" disabled={savingVariant} className={buttonClass}>
                    {savingVariant ? "Adding…" : "Add variant"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#D9E0EA] p-8 text-center text-sm text-[#828B9B]">
            Select an experiment to manage its variants and view stats.
          </div>
        )}
      </div>
    </section>
  );
}
