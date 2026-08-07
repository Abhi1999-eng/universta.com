"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { authFetch } from "@/features/auth/auth-client";

type ArchivedCity = {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  status: string;
  country: { id: string; name: string; slug: string };
  state: { id: string; name: string; slug: string } | null;
  _count: {
    campuses: number;
    consultantLocations: number;
    jobs: number;
    events: number;
  };
};

type Envelope<T> = {
  data?: T;
  error?: { message?: string } | null;
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authFetch(`/api/v1/admin${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = (await response.json()) as Envelope<T>;
  if (!response.ok || body.error) {
    throw new Error(body.error?.message ?? "Request failed");
  }
  return body.data as T;
}

const inputClass =
  "w-full rounded-lg border border-[#D9E0EA] bg-white px-2.5 py-2 text-sm outline-none focus:border-[#1657CF] focus:ring-2 focus:ring-[#DCE8FF]";

export function ArchivedCitiesRecovery() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") === "states" ? "states" : "cities";
  const [cities, setCities] = useState<ArchivedCity[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (tab !== "cities") return;
    setLoading(true);
    try {
      setCities(await api<ArchivedCity[]>("/cities-recovery"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load archived cities");
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (tab !== "cities") return;
    const refresh = () => void load();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [load, tab]);

  if (tab !== "cities") return null;

  function beginEdit(city: ArchivedCity) {
    setEditingId(city.id);
    setName(city.name);
    setSlug(city.slug);
    setShortDescription(city.shortDescription ?? "");
    setMessage("");
  }

  async function save(city: ArchivedCity) {
    if (!name.trim() || !slug.trim()) {
      setMessage("City name and slug are required.");
      return;
    }
    setBusyId(city.id);
    setMessage("");
    try {
      await api(`/cities-recovery/${city.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          shortDescription: shortDescription.trim(),
        }),
      });
      setEditingId(null);
      setMessage("Archived city updated.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update archived city");
    } finally {
      setBusyId(null);
    }
  }

  async function restore(city: ArchivedCity) {
    setBusyId(city.id);
    setMessage("");
    try {
      await api(`/cities-recovery/${city.id}/restore`, { method: "POST" });
      setMessage(`${city.name} restored as DRAFT. Reloading so it appears in the main Cities table…`);
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to restore city");
      setBusyId(null);
    }
  }

  async function removePermanently(city: ArchivedCity) {
    const references =
      city._count.campuses +
      city._count.consultantLocations +
      city._count.jobs +
      city._count.events;
    const warning = references
      ? `${city.name} is referenced by ${references} record(s). The API will block deletion while references remain. Continue?`
      : `Permanently delete ${city.name}? This cannot be undone and will free the slug “${city.slug}” for reuse.`;
    if (!window.confirm(warning)) return;

    setBusyId(city.id);
    setMessage("");
    try {
      await api(`/cities-recovery/${city.id}`, { method: "DELETE" });
      setMessage(`${city.name} permanently deleted. Its slug can now be used again.`);
      if (editingId === city.id) setEditingId(null);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to permanently delete city");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="mx-auto mt-8 max-w-[1240px] rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-800">Recovery</p>
          <h3 className="mt-1 text-xl font-semibold text-[#161C2D]">Archived cities</h3>
          <p className="mt-1 max-w-3xl text-sm text-[#667085]">
            Archived cities are hidden from the public site but still reserve their country + slug. Restore the existing city, edit it while archived, or permanently delete it to reuse the same slug.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900 disabled:opacity-60"
        >
          {loading ? "Refreshing…" : "Refresh archived cities"}
        </button>
      </div>

      {message ? (
        <p className="mt-4 rounded-lg bg-white px-3 py-2 text-sm text-[#48505F]" role="status">
          {message}
        </p>
      ) : null}

      {loading && cities.length === 0 ? (
        <p className="mt-4 text-sm text-[#667085]">Loading archived cities…</p>
      ) : cities.length === 0 ? (
        <p className="mt-4 text-sm text-[#667085]">No archived cities.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {cities.map((city) => {
            const editing = editingId === city.id;
            const references =
              city._count.campuses +
              city._count.consultantLocations +
              city._count.jobs +
              city._count.events;
            return (
              <div key={city.id} className="rounded-xl border border-amber-200 bg-white p-4">
                {editing ? (
                  <div className="grid gap-3 md:grid-cols-3">
                    <label className="text-xs font-semibold text-[#48505F]">
                      City name
                      <input className={`mt-1 ${inputClass}`} value={name} onChange={(event) => setName(event.target.value)} />
                    </label>
                    <label className="text-xs font-semibold text-[#48505F]">
                      Slug
                      <input className={`mt-1 ${inputClass}`} value={slug} onChange={(event) => setSlug(event.target.value)} />
                    </label>
                    <label className="text-xs font-semibold text-[#48505F]">
                      Short description
                      <input
                        className={`mt-1 ${inputClass}`}
                        value={shortDescription}
                        onChange={(event) => setShortDescription(event.target.value)}
                      />
                    </label>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#161C2D]">
                        {city.name} <span className="font-normal text-[#9AA3B2]">({city.slug})</span>
                      </p>
                      <p className="mt-1 text-xs text-[#667085]">
                        {city.country.name} · {city.state?.name ?? "No state/province"} · {references} active reference{references === 1 ? "" : "s"}
                      </p>
                      {city.shortDescription ? (
                        <p className="mt-2 text-sm text-[#48505F]">{city.shortDescription}</p>
                      ) : null}
                    </div>
                    <span className="rounded-full bg-[#F2F4F7] px-2.5 py-1 text-xs font-semibold text-[#667085]">ARCHIVED</span>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {editing ? (
                    <>
                      <button
                        type="button"
                        disabled={busyId === city.id}
                        onClick={() => void save(city)}
                        className="rounded-lg bg-[#1657CF] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                      >
                        Save changes
                      </button>
                      <button
                        type="button"
                        disabled={busyId === city.id}
                        onClick={() => setEditingId(null)}
                        className="rounded-lg border border-[#D9E0EA] px-3 py-2 text-xs font-semibold text-[#48505F]"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => beginEdit(city)}
                      className="rounded-lg border border-[#D9E0EA] px-3 py-2 text-xs font-semibold text-[#48505F]"
                    >
                      Edit archived city
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busyId === city.id}
                    onClick={() => void restore(city)}
                    className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    Restore as draft
                  </button>
                  <button
                    type="button"
                    disabled={busyId === city.id}
                    onClick={() => void removePermanently(city)}
                    className="rounded-lg border border-red-300 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-60"
                  >
                    Delete permanently
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
