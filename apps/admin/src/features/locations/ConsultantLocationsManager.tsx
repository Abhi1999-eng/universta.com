"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { authFetch } from "@/features/auth/auth-client";
import { FieldLabel } from "@/features/shared/FieldLabel";
import { commonFieldHelp } from "@/lib/field-help/common";

type CountryOption = { id: string; name: string; slug: string };
type LocationRow = {
  id: string;
  countryId: string | null;
  name: string;
  slug: string;
  city: string;
  state: string | null;
  address: string | null;
  overview: string | null;
  status: string;
  displayOrder: number;
  country: { id: string; name: string; slug: string } | null;
  _count?: { consultants: number };
};
type LocationSeo = {
  seoTitle: string;
  metaDescription: string;
  canonicalUrl: string | null;
  robotsIndex: boolean;
  robotsFollow: boolean;
};
type LocationForm = {
  name: string;
  slug: string;
  countryId: string;
  state: string;
  city: string;
  address: string;
  overview: string;
  status: "ACTIVE" | "INACTIVE";
  displayOrder: string;
};

const emptyForm: LocationForm = {
  name: "",
  slug: "",
  countryId: "",
  state: "",
  city: "",
  address: "",
  overview: "",
  status: "ACTIVE",
  displayOrder: "0",
};
const inputClass =
  "mt-1 w-full rounded-xl border border-[#D9E0EA] bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#1657CF] focus:ring-2 focus:ring-[#DCE8FF]";
const buttonClass =
  "rounded-xl bg-[#1657CF] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authFetch(`/api/v1/admin/consultant-locations${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = (await response.json()) as {
    data?: T;
    error?: { message?: string } | null;
  };
  if (!response.ok || body.error) {
    throw new Error(body.error?.message ?? "Request failed");
  }
  return body.data as T;
}

async function apiCountries(): Promise<CountryOption[]> {
  const response = await authFetch("/api/v1/admin/countries?limit=100");
  const body = (await response.json()) as {
    data?: CountryOption[];
    error?: { message?: string } | null;
  };
  if (!response.ok || body.error) {
    throw new Error(body.error?.message ?? "Unable to load countries");
  }
  return body.data ?? [];
}

function LocationSeoEditor({
  locationId,
  onSaved,
  onClose,
}: {
  locationId: string;
  onSaved: () => void;
  onClose: () => void;
}) {
  const suffix = locationId.slice(0, 8);
  const [seoTitle, setSeoTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [canonicalUrl, setCanonicalUrl] = useState("");
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
        setRobotsIndex(location.seo.robotsIndex);
        setRobotsFollow(location.seo.robotsFollow);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
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
        <div className="text-xs font-semibold">
          <FieldLabel
            label="SEO title"
            htmlFor={`cl-seo-title-${suffix}`}
            help={commonFieldHelp.seoTitle}
          />
          <input
            id={`cl-seo-title-${suffix}`}
            value={seoTitle}
            onChange={(event) => setSeoTitle(event.target.value)}
            className={inputClass}
          />
        </div>
        <div className="text-xs font-semibold">
          <FieldLabel
            label="Meta description"
            htmlFor={`cl-seo-meta-${suffix}`}
            help={commonFieldHelp.metaDescription}
          />
          <input
            id={`cl-seo-meta-${suffix}`}
            value={metaDescription}
            onChange={(event) => setMetaDescription(event.target.value)}
            className={inputClass}
          />
        </div>
        <div className="text-xs font-semibold sm:col-span-2">
          <FieldLabel
            label="Canonical (optional)"
            htmlFor={`cl-seo-canonical-${suffix}`}
            help={commonFieldHelp.canonicalUrl}
          />
          <input
            id={`cl-seo-canonical-${suffix}`}
            value={canonicalUrl}
            onChange={(event) => setCanonicalUrl(event.target.value)}
            className={inputClass}
          />
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold">
          <input
            type="checkbox"
            checked={robotsIndex}
            onChange={(event) => setRobotsIndex(event.target.checked)}
          />
          Robots Index
        </label>
        <label className="flex items-center gap-2 text-xs font-semibold">
          <input
            type="checkbox"
            checked={robotsFollow}
            onChange={(event) => setRobotsFollow(event.target.checked)}
          />
          Robots Follow
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy || !seoTitle || !metaDescription}
          onClick={() => void save()}
          className="rounded-lg bg-[#1657CF] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save SEO"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-[#E8ECF3] px-3 py-2 text-xs font-semibold"
        >
          Close
        </button>
        {message ? (
          <p className="text-xs text-red-700" role="alert">
            {message}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function ConsultantLocationsManager() {
  const [rows, setRows] = useState<LocationRow[]>([]);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<LocationRow | null>(null);
  const [seoEditingId, setSeoEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<LocationForm>(emptyForm);

  const load = useCallback(async (q = "") => {
    setLoading(true);
    try {
      const search = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
      setRows(await api<LocationRow[]>(search));
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to load consultant locations",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // State updates occur after the asynchronous requests resolve.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    void apiCountries().then(setCountries).catch(() => undefined);
  }, [load]);

  function closeEditor() {
    setEditorOpen(false);
    setEditing(null);
    setForm(emptyForm);
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setEditorOpen(true);
    setMessage("");
  }

  function openEdit(row: LocationRow) {
    setEditing(row);
    setForm({
      name: row.name,
      slug: row.slug,
      countryId: row.countryId ?? row.country?.id ?? "",
      state: row.state ?? "",
      city: row.city,
      address: row.address ?? "",
      overview: row.overview ?? "",
      status: row.status === "ACTIVE" ? "ACTIVE" : "INACTIVE",
      displayOrder: String(row.displayOrder ?? 0),
    });
    setEditorOpen(true);
    setMessage("");
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        countryId: form.countryId,
        state: form.state.trim() || null,
        city: form.city.trim(),
        address: form.address.trim() || null,
        overview: form.overview.trim() || null,
        status: form.status,
        displayOrder: Number(form.displayOrder),
      };
      if (editing) {
        await api(`/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setMessage(`Updated ${payload.name}.`);
      } else {
        await api("", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setMessage(`Created ${payload.name}. Reopen the Consultant editor to link it.`);
      }
      closeEditor();
      await load(query);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save location");
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus(row: LocationRow) {
    try {
      await api(`/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
        }),
      });
      await load(query);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update status");
    }
  }

  async function archive(row: LocationRow) {
    if (
      !window.confirm(
        `Archive "${row.name}"? This is blocked while a consultant is linked to it.`,
      )
    ) {
      return;
    }
    try {
      await api(`/${row.id}`, { method: "DELETE" });
      await load(query);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to archive location");
    }
  }

  return (
    <section className="mx-auto max-w-[1180px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#828B9B]">
            Consultants
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
            Consultant locations
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
            Create the physical office first, then reopen the Consultant editor and
            select it under Locations. Consultant phone and email stay on the
            Consultant record so contact data is not duplicated across offices.
          </p>
        </div>
        <button
          type="button"
          onClick={editorOpen ? closeEditor : openCreate}
          className={buttonClass}
        >
          {editorOpen ? "Close" : "Add location"}
        </button>
      </div>

      {message ? (
        <p className="mt-4 text-sm text-[#344054]" role="status">
          {message}
        </p>
      ) : null}

      {editorOpen ? (
        <form
          onSubmit={(event) => void save(event)}
          className="mt-6 grid gap-4 rounded-2xl border border-[#E8ECF3] bg-white p-6 sm:grid-cols-2"
        >
          <div className="sm:col-span-2">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#828B9B]">
              {editing ? `Editing: ${editing.name}` : "New consultant location"}
            </p>
          </div>

          <div className="text-sm font-semibold">
            <FieldLabel label="Name" htmlFor="cl-name" required help={commonFieldHelp.name} />
            <input
              id="cl-name"
              required
              className={inputClass}
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
            />
          </div>
          <div className="text-sm font-semibold">
            <FieldLabel label="Slug" htmlFor="cl-slug" required help={commonFieldHelp.slug} />
            <input
              id="cl-slug"
              required
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              placeholder="london-office"
              className={inputClass}
              value={form.slug}
              onChange={(event) =>
                setForm((current) => ({ ...current, slug: event.target.value }))
              }
            />
          </div>
          <div className="text-sm font-semibold">
            <FieldLabel label="Country" htmlFor="cl-country" required help={commonFieldHelp.country} />
            <select
              id="cl-country"
              required
              className={inputClass}
              value={form.countryId}
              onChange={(event) =>
                setForm((current) => ({ ...current, countryId: event.target.value }))
              }
            >
              <option value="">Select country</option>
              {countries.map((country) => (
                <option key={country.id} value={country.id}>
                  {country.name}
                </option>
              ))}
            </select>
          </div>
          <div className="text-sm font-semibold">
            <FieldLabel
              label="State / province (optional)"
              htmlFor="cl-state"
              help={commonFieldHelp.state}
            />
            <input
              id="cl-state"
              className={inputClass}
              value={form.state}
              onChange={(event) =>
                setForm((current) => ({ ...current, state: event.target.value }))
              }
            />
          </div>
          <div className="text-sm font-semibold">
            <FieldLabel label="City" htmlFor="cl-city" required helpKey="consultant-locations.city" />
            <input
              id="cl-city"
              required
              className={inputClass}
              value={form.city}
              onChange={(event) =>
                setForm((current) => ({ ...current, city: event.target.value }))
              }
            />
          </div>
          <div className="text-sm font-semibold">
            <FieldLabel
              label="Display order"
              htmlFor="cl-display-order"
              required
              help={commonFieldHelp.displayOrder}
            />
            <input
              id="cl-display-order"
              type="number"
              min="0"
              max="999999"
              required
              className={inputClass}
              value={form.displayOrder}
              onChange={(event) =>
                setForm((current) => ({ ...current, displayOrder: event.target.value }))
              }
            />
          </div>
          <div className="text-sm font-semibold sm:col-span-2">
            <FieldLabel label="Address" htmlFor="cl-address" required />
            <textarea
              id="cl-address"
              required
              className={`${inputClass} min-h-20`}
              value={form.address}
              onChange={(event) =>
                setForm((current) => ({ ...current, address: event.target.value }))
              }
            />
          </div>
          <div className="text-sm font-semibold sm:col-span-2">
            <FieldLabel
              label="Overview (optional)"
              htmlFor="cl-overview"
              help={commonFieldHelp.overview}
            />
            <textarea
              id="cl-overview"
              className={`${inputClass} min-h-24`}
              value={form.overview}
              onChange={(event) =>
                setForm((current) => ({ ...current, overview: event.target.value }))
              }
            />
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={form.status === "ACTIVE"}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  status: event.target.checked ? "ACTIVE" : "INACTIVE",
                }))
              }
            />
            Active
          </label>
          <div className="flex flex-wrap justify-end gap-3 sm:col-span-2">
            <button
              type="button"
              onClick={closeEditor}
              className="rounded-xl border border-[#D9E0EA] px-4 py-2.5 text-sm font-semibold"
            >
              Cancel
            </button>
            <button disabled={busy} className={buttonClass}>
              {busy ? "Saving…" : editing ? "Save changes" : "Create location"}
            </button>
          </div>
        </form>
      ) : null}

      <form
        className="mt-6 flex flex-wrap gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void load(query);
        }}
      >
        <input
          aria-label="Search consultant locations"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, slug, city or address"
          className={`${inputClass} mt-0 max-w-md`}
        />
        <button type="submit" className="rounded-xl border border-[#D9E0EA] px-4 py-2 text-sm font-semibold">
          Search
        </button>
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              void load("");
            }}
            className="rounded-xl border border-[#D9E0EA] px-4 py-2 text-sm font-semibold"
          >
            Clear
          </button>
        ) : null}
      </form>

      {loading ? (
        <p className="mt-8 text-sm text-[#667085]">Loading…</p>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-2xl border border-[#E8ECF3] bg-white">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-[#FAFBFD] text-xs font-bold uppercase tracking-wide text-[#828B9B]">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Consultants</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8ECF3]">
              {rows.map((row) => (
                <Fragment key={row.id}>
                  <tr>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{row.name}</p>
                      <p className="mt-1 text-xs text-[#828B9B]">/{row.slug}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p>
                        {row.city}
                        {row.state ? `, ${row.state}` : ""}
                        {row.country ? ` — ${row.country.name}` : ""}
                      </p>
                      {row.address ? (
                        <p className="mt-1 max-w-sm text-xs text-[#667085]">{row.address}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{row.displayOrder}</td>
                    <td className="px-4 py-3">{row._count?.consultants ?? 0}</td>
                    <td className="px-4 py-3">{row.status}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => openEdit(row)} className="rounded-lg border border-[#D9E0EA] px-3 py-1.5 text-xs font-semibold">
                          Edit
                        </button>
                        <button type="button" onClick={() => void toggleStatus(row)} className="rounded-lg border border-[#D9E0EA] px-3 py-1.5 text-xs font-semibold">
                          {row.status === "ACTIVE" ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setSeoEditingId(seoEditingId === row.id ? null : row.id)}
                          className="rounded-lg border border-[#D9E0EA] px-3 py-1.5 text-xs font-semibold"
                        >
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
                      <td colSpan={6} className="bg-[#FAFBFD] px-4 py-4">
                        <LocationSeoEditor
                          locationId={row.id}
                          onSaved={() => setMessage(`Saved SEO for ${row.name}.`)}
                          onClose={() => setSeoEditingId(null)}
                        />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-[#667085]">
                    No consultant locations found. Create the office first, then link it from the Consultant editor.
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
