"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/features/auth/auth-client";
import { DevicePreview } from "@/features/website/DevicePreview";

type Source = { value: string; label: string; count: number };
type Item = {
  id: string;
  visible: boolean;
  label: string;
  singularLabel?: string;
  sourceMode: "AUTOMATIC" | "MANUAL";
  automaticSource: string;
  manualValue: number | string | null;
  displayOrder: number;
};
type Config = {
  visible: boolean;
  variant: "pill" | "badge";
  icon: { visible: boolean; name: "dot" | "globe" | "book" };
  items: Item[];
};
type Payload = {
  page: { title: string; slug: string };
  draft: Config;
  published: Config;
  sources: Source[];
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authFetch(`/api/v1/admin/stats-pills/${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = (await response.json()) as {
    data?: T;
    error?: {
      message?: string;
      details?: { fields?: Record<string, string> };
    } | null;
  };
  if (!response.ok || body.error) {
    const error = new Error(
      body.error?.message ?? "Request failed",
    ) as Error & { fields?: Record<string, string> };
    error.fields = body.error?.details?.fields;
    throw error;
  }
  return body.data as T;
}

const input =
  "mt-1 w-full rounded-xl border border-[#D9E0EA] bg-white px-3 py-2 text-sm outline-none focus:border-[#1657CF] focus:ring-2 focus:ring-[#DCE8FF] disabled:bg-[#F2F4F7] disabled:text-[#667085]";

export function StatsPillEditor({
  pageId,
  index,
  total,
  onMove,
}: {
  pageId: string;
  index: number;
  total: number;
  onMove: (direction: -1 | 1) => void;
}) {
  const [data, setData] = useState<Payload | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [previewOpen, setPreviewOpen] = useState(false);

  const load = useCallback(async () => {
    setData(null);
    setConfig(null);
    setFields({});
    setPreviewOpen(false);
    setMessage("");
    try {
      const next = await request<Payload>(pageId);
      setData(next);
      setConfig(structuredClone(next.draft));
      setDirty(false);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load statistics pill.",
      );
    }
  }, [pageId]);

  useEffect(() => {
    // Data belongs to this exact Page id; switching pages always reloads and
    // cannot retain another page's draft form state.
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function change(next: Config) {
    setConfig(next);
    setDirty(true);
    setFields({});
    setMessage("");
  }

  function updateItem(id: string, patch: Partial<Item>) {
    if (!config) return;
    change({
      ...config,
      items: config.items.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    });
  }

  function moveItem(id: string, direction: -1 | 1) {
    if (!config) return;
    const ordered = [...config.items].sort(
      (a, b) => a.displayOrder - b.displayOrder,
    );
    const from = ordered.findIndex((item) => item.id === id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= ordered.length) return;
    [ordered[from], ordered[to]] = [ordered[to], ordered[from]];
    change({
      ...config,
      items: ordered.map((item, displayOrder) => ({ ...item, displayOrder })),
    });
  }

  async function saveDraft() {
    if (!config || busy) return;
    setBusy(true);
    setFields({});
    setMessage("");
    try {
      await request(`${pageId}/draft`, {
        method: "PUT",
        body: JSON.stringify({ config }),
      });
      setMessage("Draft saved. Public pages are unchanged until Publish.");
      setDirty(false);
      setData((current) =>
        current ? { ...current, draft: structuredClone(config) } : current,
      );
    } catch (error) {
      const typed = error as Error & { fields?: Record<string, string> };
      setFields(typed.fields ?? {});
      setMessage(typed.message ?? "Unable to save draft.");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (busy || !config) return;
    if (dirty) {
      setMessage("Save draft before publishing.");
      return;
    }
    setBusy(true);
    setMessage("");
    const published = structuredClone(config);
    try {
      await request(`${pageId}/publish`, { method: "POST" });
      setMessage("Published. The public pill now uses this configuration.");
      setData((current) =>
        current ? { ...current, published } : current,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to publish.");
    } finally {
      setBusy(false);
    }
  }

  if (!config || !data)
    return (
      <div className="rounded-2xl border border-[#E8ECF3] bg-white p-5">
        <p>{message || "Loading statistics pill…"}</p>
      </div>
    );

  const ordered = [...config.items].sort(
    (a, b) => a.displayOrder - b.displayOrder,
  );
  return (
    <div
      className="rounded-2xl border border-[#B9CDF7] bg-white p-5"
      data-testid="stats-pill-editor"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1657CF]">
            CMS statistics pill
          </p>
          <h4 className="mt-1 font-semibold">{data.page.title}</h4>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            aria-label="Move section up"
            disabled={index === 0}
            onClick={() => onMove(-1)}
            className="rounded-lg border px-2 py-1 disabled:opacity-40"
          >
            ↑
          </button>
          <button
            type="button"
            aria-label="Move section down"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
            className="rounded-lg border px-2 py-1 disabled:opacity-40"
          >
            ↓
          </button>
        </div>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={config.visible}
            onChange={(event) =>
              change({ ...config, visible: event.target.checked })
            }
          />
          Show complete pill
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={config.icon.visible}
            onChange={(event) =>
              change({
                ...config,
                icon: { ...config.icon, visible: event.target.checked },
              })
            }
          />
          Show icon
        </label>
        <label className="text-sm font-semibold">
          Icon
          <select
            className={input}
            value={config.icon.name}
            disabled={!config.icon.visible}
            onChange={(event) =>
              change({
                ...config,
                icon: {
                  ...config.icon,
                  name: event.target.value as Config["icon"]["name"],
                },
              })
            }
          >
            <option value="dot">Dot</option>
            <option value="globe">Globe</option>
            <option value="book">Book</option>
          </select>
        </label>
      </div>
      <div className="mt-5 space-y-4">
        {ordered.map((item, itemIndex) => {
          const source = data.sources.find(
            (entry) => entry.value === item.automaticSource,
          );
          return (
            <fieldset
              key={item.id}
              className="rounded-xl border border-[#E8ECF3] p-4"
            >
              <legend className="px-2 text-sm font-bold">
                Statistic {itemIndex + 1}
              </legend>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={item.visible}
                    onChange={(event) =>
                      updateItem(item.id, { visible: event.target.checked })
                    }
                  />
                  Show statistic
                </label>
                <label className="text-sm font-semibold">
                  Label
                  <input
                    className={input}
                    value={item.label}
                    maxLength={60}
                    onChange={(event) =>
                      updateItem(item.id, { label: event.target.value })
                    }
                  />
                  {fields[`items.${itemIndex}.label`] ? (
                    <small className="text-[#B42318]">
                      {fields[`items.${itemIndex}.label`]}
                    </small>
                  ) : null}
                </label>
                <label className="text-sm font-semibold">
                  Singular label (optional)
                  <input
                    className={input}
                    value={item.singularLabel ?? ""}
                    maxLength={60}
                    onChange={(event) =>
                      updateItem(item.id, {
                        singularLabel: event.target.value,
                      })
                    }
                  />
                  {fields[`items.${itemIndex}.singularLabel`] ? (
                    <small className="text-[#B42318]">
                      {fields[`items.${itemIndex}.singularLabel`]}
                    </small>
                  ) : null}
                </label>
                <label className="text-sm font-semibold">
                  Source mode
                  <select
                    className={input}
                    value={item.sourceMode}
                    onChange={(event) =>
                      updateItem(item.id, {
                        sourceMode: event.target.value as Item["sourceMode"],
                      })
                    }
                  >
                    <option value="AUTOMATIC">Automatic</option>
                    <option value="MANUAL">Manual override</option>
                  </select>
                </label>
                <label className="text-sm font-semibold">
                  Manual value
                  <input
                    className={input}
                    type="number"
                    min="0"
                    step="1"
                    disabled={item.sourceMode !== "MANUAL"}
                    value={item.manualValue ?? ""}
                    onChange={(event) =>
                      updateItem(item.id, {
                        manualValue:
                          event.target.value === ""
                            ? null
                            : Number(event.target.value),
                      })
                    }
                  />
                  {fields[`items.${itemIndex}.manualValue`] ? (
                    <small className="text-[#B42318]">
                      {fields[`items.${itemIndex}.manualValue`]}
                    </small>
                  ) : null}
                </label>
                <label className="text-sm font-semibold sm:col-span-2">
                  Automatic source
                  <select
                    className={input}
                    value={item.automaticSource}
                    disabled={item.sourceMode !== "AUTOMATIC"}
                    onChange={(event) =>
                      updateItem(item.id, {
                        automaticSource: event.target.value,
                      })
                    }
                  >
                    {data.sources.map((entry) => (
                      <option value={entry.value} key={entry.value}>
                        {entry.label}
                      </option>
                    ))}
                  </select>
                  {item.sourceMode === "AUTOMATIC" ? (
                    <small className="mt-1 block font-normal text-[#18794E]">
                      Current resolved count:{" "}
                      {source?.count.toLocaleString() ?? "—"}
                    </small>
                  ) : null}
                </label>
                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    disabled={itemIndex === 0}
                    onClick={() => moveItem(item.id, -1)}
                    className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
                  >
                    Move up
                  </button>
                  <button
                    type="button"
                    disabled={itemIndex === ordered.length - 1}
                    onClick={() => moveItem(item.id, 1)}
                    className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
                  >
                    Move down
                  </button>
                </div>
              </div>
            </fieldset>
          );
        })}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy || !dirty}
          onClick={() => void saveDraft()}
          className="rounded-xl bg-[#1657CF] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Working…" : "Save Draft"}
        </button>
        <button
          type="button"
          disabled={busy || dirty}
          onClick={() => void publish()}
          className="rounded-xl bg-[#18794E] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Publish
        </button>
        <button
          type="button"
          disabled={dirty}
          onClick={() => setPreviewOpen(true)}
          className="rounded-xl border border-[#D9E0EA] px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          Preview saved draft
        </button>
        {dirty ? (
          <span className="text-xs text-[#B54708]">
            Save draft before previewing or publishing.
          </span>
        ) : null}
      </div>
      {message ? (
        <p className="mt-3 text-sm" role="status">
          {message}
        </p>
      ) : null}
      {previewOpen ? (
        <DevicePreview
          slug={data.page.slug}
          title={data.page.title}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </div>
  );
}
