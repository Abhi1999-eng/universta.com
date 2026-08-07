"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { authFetch } from "@/features/auth/auth-client";

type City = {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  country: { name: string };
  state: { name: string } | null;
  _count: { campuses: number; consultantLocations: number; jobs: number; events: number };
};
type Envelope<T> = { data?: T; error?: { message?: string } | null };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authFetch(`/api/v1/admin${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = (await response.json()) as Envelope<T>;
  if (!response.ok || body.error) throw new Error(body.error?.message ?? "Request failed");
  return body.data as T;
}

const inputClass = "mt-1 w-full rounded-lg border border-[#D9E0EA] bg-white px-3 py-2 text-sm outline-none focus:border-[#1657CF]";

export function ArchivedCitiesRecovery() {
  const searchParams = useSearchParams();
  const isCities = searchParams.get("tab") !== "states";
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!isCities) return;
    setLoading(true);
    try {
      setCities(await api<City[]>("/cities-recovery"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load archived cities");
    } finally {
      setLoading(false);
    }
  }, [isCities]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!isCities) return;
    const refresh = () => void load();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [isCities, load]);

  if (!isCities) return null;

  function edit(city: City) {
    setEditingId(city.id);
    setName(city.name);
    setSlug(city.slug);
    setShortDescription(city.shortDescription ?? "");
    setMessage("");
  }

  async function save(city: City) {
    if (!name.trim() || !slug.trim()) return setMessage("City name and slug are required.");
    setBusyId(city.id);
    try {
      await api(`/cities-recovery/${city.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: name.trim(), slug: slug.trim(), shortDescription: shortDescription.trim() }),
      });
      setEditingId(null);
      setMessage("Archived city updated.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update archived city");
    } finally { setBusyId(null); }
  }

  async function restore(city: City) {
    setBusyId(city.id);
    try {
      await api(`/cities-recovery/${city.id}/restore`, { method: "POST" });
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to restore city");
      setBusyId(null);
    }
  }

  async function remove(city: City) {
    const references = city._count.campuses + city._count.consultantLocations + city._count.jobs + city._count.events;
    if (!window.confirm(references
      ? `${city.name} has ${references} reference(s). Deletion will be blocked until they are removed. Continue?`
      : `Permanently delete ${city.name}? This frees the slug “${city.slug}” for reuse and cannot be undone.`)) return;
    setBusyId(city.id);
    try {
      await api(`/cities-recovery/${city.id}`, { method: "DELETE" });
      setMessage(`${city.name} permanently deleted. Its slug can now be reused.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete city");
    } finally { setBusyId(null); }
  }

  return (
    <section className="mx-auto mt-8 max-w-[1240px] rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-800">Recovery</p>
          <h3 className="mt-1 text-xl font-semibold">Archived cities</h3>
          <p className="mt-1 max-w-3xl text-sm text-[#667085]">Archived cities stay hidden publicly but still reserve their slug. Restore one as Draft, edit it here, or permanently delete it before reusing that slug.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900 disabled:opacity-60">
          {loading ? "Refreshing…" : "Refresh archived cities"}
        </button>
      </div>

      {message ? <p className="mt-4 rounded-lg bg-white px-3 py-2 text-sm" role="status">{message}</p> : null}
      {!loading && cities.length === 0 ? <p className="mt-4 text-sm text-[#667085]">No archived cities.</p> : null}

      <div className="mt-4 space-y-3">
        {cities.map((city) => {
          const editing = editingId === city.id;
          const references = city._count.campuses + city._count.consultantLocations + city._count.jobs + city._count.events;
          return (
            <div key={city.id} className="rounded-xl border border-amber-200 bg-white p-4">
              {editing ? (
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="text-xs font-semibold">City name<input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} /></label>
                  <label className="text-xs font-semibold">Slug<input className={inputClass} value={slug} onChange={(e) => setSlug(e.target.value)} /></label>
                  <label className="text-xs font-semibold">Short description<input className={inputClass} value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} /></label>
                </div>
              ) : (
                <div>
                  <p className="font-semibold">{city.name} <span className="font-normal text-[#9AA3B2]">({city.slug})</span></p>
                  <p className="mt-1 text-xs text-[#667085]">{city.country.name} · {city.state?.name ?? "No state/province"} · {references} reference{references === 1 ? "" : "s"}</p>
                  {city.shortDescription ? <p className="mt-2 text-sm text-[#48505F]">{city.shortDescription}</p> : null}
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {editing ? <>
                  <button type="button" disabled={busyId === city.id} onClick={() => void save(city)} className="rounded-lg bg-[#1657CF] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">Save changes</button>
                  <button type="button" onClick={() => setEditingId(null)} className="rounded-lg border px-3 py-2 text-xs font-semibold">Cancel</button>
                </> : <button type="button" onClick={() => edit(city)} className="rounded-lg border px-3 py-2 text-xs font-semibold">Edit archived city</button>}
                <button type="button" disabled={busyId === city.id} onClick={() => void restore(city)} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">Restore as draft</button>
                <button type="button" disabled={busyId === city.id} onClick={() => void remove(city)} className="rounded-lg border border-red-300 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-60">Delete permanently</button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
