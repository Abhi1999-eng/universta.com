"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { authFetch } from "@/features/auth/auth-client";
import { FieldLabel } from "@/features/shared/FieldLabel";
import { commonFieldHelp } from "@/lib/field-help/common";

type CountryOption = { id: string; name: string; slug: string };
type LocationRow = {
  id: string;
  name: string;
  slug: string;
  city: string;
  state: string | null;
  status: string;
  overview: string | null;
  country: { name: string; slug: string } | null;
  _count?: { consultants: number };
};
type LocationSeo = {
  seoTitle: string;
  metaDescription: string;
  canonicalUrl: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  robotsIndex: boolean;
  robotsFollow: boolean;
};

const inputClass =
  "mt-1 w-full rounded-xl border border-[#D9E0EA] bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#1657CF] focus:ring-2 focus:ring-[#DCE8FF]";
const buttonClass = "rounded-xl bg-[#1657CF] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authFetch(`/api/v1/admin/consultant-locations${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = (await response.json()) as { data?: T; error?: { message?: string } | null };
  if (!response.ok || body.error) throw new Error(body.error?.message ?? "Request failed");
  return body.data as T;
}
async function apiCountries(): Promise<CountryOption[]> {
  const response = await authFetch("/api/v1/admin/countries?limit=100");
  const body = (await response.json()) as { data?: CountryOption[]; error?: { message?: string } | null };
  if (!response.ok || body.error) throw new Error(body.error?.message ?? "Unable to load countries");
  return body.data ?? [];
}

function LocationSeoEditor({ locationId, onSaved, onClose }: { locationId: string; onSaved: () => void; onClose: () => void }) {
  const [seoTitle, setSeoTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [canonicalUrl, setCanonicalUrl] = useState("");
  const [ogTitle, setOgTitle] = useState("");
  const [ogDescription, setOgDescription] = useState("");
  const [robotsIndex, setRobotsIndex] = useState(true);
  const [robotsFollow, setRobotsFollow] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    api<{ seo: LocationSeo | null }>(`/${locationId}`)
      .then((location) => {
        if (cancelled || !location.seo) return;
        setSeoTitle(location.seo.seoTitle);
        setMetaDescription(location.seo.metaDescription);
        setCanonicalUrl(location.seo.canonicalUrl ?? "");
        setOgTitle(location.seo.ogTitle ?? "");
        setOgDescription(location.seo.ogDescription ?? "");
        setRobotsIndex(location.seo.robotsIndex);
        setRobotsFollow(location.seo.robotsFollow);
      })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [locationId]);

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      await api(`/${locationId}/seo`, {
        method: "PUT",
        body: JSON.stringify({
          seoTitle,
          metaDescription,
          canonicalUrl: canonicalUrl || null,
          ogTitle: ogTitle || null,
          ogDescription: ogDescription || null,
          robotsIndex,
          robotsFollow,
        }),
      });
      onSaved();
      onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save SEO");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-sm text-[#667085]">Loading SEO…</p>;

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-semibold"><FieldLabel label="SEO title" help={commonFieldHelp.seoTitle} />
          <input value={seoTitle} onChange={(event) => setSeoTitle(event.target.value)} className={inputClass} />
        </label>
        <label className="block text-xs font-semibold"><FieldLabel label="Meta description" help={commonFieldHelp.metaDescription} />
          <input value={metaDescription} onChange={(event) => setMetaDescription(event.target.value)} className={inputClass} />
        </label>
        <label className="block text-xs font-semibold"><FieldLabel label="Canonical URL (optional)" help={commonFieldHelp.canonicalUrl} />
          <input value={canonicalUrl} onChange={(event) => setCanonicalUrl(event.target.value)} className={inputClass} />
        </label>
        <label className="block text-xs font-semibold"><FieldLabel label="OG title (optional)" help={commonFieldHelp.ogTitle} />
          <input value={ogTitle} onChange={(event) => setOgTitle(event.target.value)} className={inputClass} />
        </label>
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold"><FieldLabel label="OG description (optional)" help={commonFieldHelp.ogDescription} />
            <input value={ogDescription} onChange={(event) => setOgDescription(event.target.value)} className={inputClass} />
          </label>
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold">
          <input type="checkbox" checked={robotsIndex} onChange={(event) => setRobotsIndex(event.target.checked)} />
          <FieldLabel label="Allow search indexing" help={commonFieldHelp.robotsIndex} />
        </label>
        <label className="flex items-center gap-2 text-xs font-semibold">
          <input type="checkbox" checked={robotsFollow} onChange={(event) => setRobotsFollow(event.target.checked)} />
          <FieldLabel label="Allow link following" help={commonFieldHelp.robotsFollow} />
        </label>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button type="button" disabled={busy || !seoTitle || !metaDescription} onClick={() => void save()} className="rounded-lg bg-[#1657CF] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">
          Save SEO
        </button>
        <button type="button" onClick={onClose} className="rounded-lg border border-[#E8ECF3] px-3 py-2 text-xs font-semibold">Close</button>
        {message ? <p className="text-xs text-red-700" role="alert">{message}</p> : null}
      </div>
    </div>
  );
}

export function ConsultantLocationsManager() {
  const [rows, setRows] = useState<LocationRow[]>([]);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [seoEditingId, setSeoEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [countryId, setCountryId] = useState("");
  const [overview, setOverview] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await api<LocationRow[]>(""));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load consultant locations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // The state updates happen only after the asynchronous requests resolve.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    void apiCountries().then(setCountries).catch(() => undefined);
  }, [load]);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      await api("", {
        method: "POST",
        body: JSON.stringify({ name, city, state: state || undefined, countryId: countryId || undefined, overview: overview || undefined }),
      });
      setName(""); setCity(""); setState(""); setCountryId(""); setOverview(""); setCreating(false);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create location");
    }
  }

  async function toggleStatus(row: LocationRow) {
    try {
      await api(`/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }),
      });
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update status");
    }
  }

  async function archive(row: LocationRow) {
    if (!window.confirm(`Archive "${row.name}"? This cannot be undone if no consultant is linked to it.`)) return;
    try {
      await api(`/${row.id}`, { method: "DELETE" });
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to archive location");
    }
  }

  return (
    <section className="mx-auto max-w-[1180px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#828B9B]">Consultants</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Consultant locations</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
            Physical offices/branches consultants can be linked to. Each has its own public page and SEO controls.
          </p>
        </div>
        <button type="button" onClick={() => setCreating((v) => !v)} className={buttonClass}>
          {creating ? "Close" : "Add location"}
        </button>
      </div>

      {message ? <p className="mt-4 text-sm text-red-700" role="alert">{message}</p> : null}

      {creating ? (
        <form onSubmit={(event) => void create(event)} className="mt-6 grid gap-4 rounded-2xl border border-[#E8ECF3] bg-white p-6 sm:grid-cols-2">
          <label className="text-sm font-semibold"><FieldLabel label="Name" required help={commonFieldHelp.name} />
            <input required className={inputClass} value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="text-sm font-semibold"><FieldLabel label="City" required helpKey="consultant-locations.city" />
            <input required className={inputClass} value={city} onChange={(event) => setCity(event.target.value)} />
          </label>
          <label className="text-sm font-semibold"><FieldLabel label="State / province (optional)" help={commonFieldHelp.state} />
            <input className={inputClass} value={state} onChange={(event) => setState(event.target.value)} />
          </label>
          <label className="text-sm font-semibold"><FieldLabel label="Country" help={commonFieldHelp.country} />
            <select className={inputClass} value={countryId} onChange={(event) => setCountryId(event.target.value)}>
              <option value="">Not set</option>
              {countries.map((country) => <option key={country.id} value={country.id}>{country.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold sm:col-span-2"><FieldLabel label="Overview (optional)" help={commonFieldHelp.overview} />
            <textarea className={`${inputClass} min-h-24`} value={overview} onChange={(event) => setOverview(event.target.value)} />
          </label>
          <div className="sm:col-span-2">
            <button className={buttonClass}>Create</button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <p className="mt-8 text-sm text-[#667085]">Loading…</p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-[#E8ECF3] bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-[#FAFBFD] text-xs font-bold uppercase tracking-wide text-[#828B9B]">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">City / country</th>
                <th className="px-4 py-3">Consultants</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8ECF3]">
              {rows.map((row) => (
                <Fragment key={row.id}>
                  <tr>
                    <td className="px-4 py-3 font-semibold">{row.name}</td>
                    <td className="px-4 py-3">{row.city}{row.state ? `, ${row.state}` : ""}{row.country ? ` — ${row.country.name}` : ""}</td>
                    <td className="px-4 py-3">{row._count?.consultants ?? 0}</td>
                    <td className="px-4 py-3">{row.status}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => void toggleStatus(row)} className="rounded-lg border border-[#D9E0EA] px-3 py-1.5 text-xs font-semibold">
                          {row.status === "ACTIVE" ? "Deactivate" : "Activate"}
                        </button>
                        <button type="button" onClick={() => setSeoEditingId(seoEditingId === row.id ? null : row.id)} className="rounded-lg border border-[#D9E0EA] px-3 py-1.5 text-xs font-semibold">
                          SEO
                        </button>
                        <button type="button" onClick={() => void archive(row)} className="rounded-lg border border-[#F2C5C5] px-3 py-1.5 text-xs font-semibold text-[#B42318]">
                          Archive
                        </button>
                      </div>
                    </td>
                  </tr>
                  {seoEditingId === row.id ? (
                    <tr>
                      <td colSpan={5} className="bg-[#FAFBFD] px-4 py-4">
                        <LocationSeoEditor locationId={row.id} onSaved={load} onClose={() => setSeoEditingId(null)} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-[#667085]">
                    No consultant locations yet. Use “Add location” to create the first one.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
