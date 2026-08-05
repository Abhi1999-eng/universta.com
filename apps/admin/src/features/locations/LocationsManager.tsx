"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { authFetch } from "@/features/auth/auth-client";
import { FieldLabel } from "@/features/shared/FieldLabel";
import { commonFieldHelp } from "@/lib/field-help/common";

type CountryOption = { id: string; name: string; slug: string };
type StateRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  displayOrder: number;
  country: { name: string; slug: string };
};
type CityRow = {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  isFeatured: boolean;
  status: string;
  country: { name: string; slug: string };
  state: { id: string; name: string; slug: string } | null;
};

const STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"];

type CitySeo = {
  seoTitle: string;
  metaDescription: string;
  canonicalUrl: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  robotsIndex: boolean;
  robotsFollow: boolean;
};

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

function CitySeoEditor({
  cityId,
  onSaved,
  onClose,
}: {
  cityId: string;
  onSaved: () => void;
  onClose: () => void;
}) {
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
    api<{ seo: CitySeo | null }>(`/cities/${cityId}`)
      .then((city) => {
        if (cancelled || !city.seo) return;
        setSeoTitle(city.seo.seoTitle);
        setMetaDescription(city.seo.metaDescription);
        setCanonicalUrl(city.seo.canonicalUrl ?? "");
        setOgTitle(city.seo.ogTitle ?? "");
        setOgDescription(city.seo.ogDescription ?? "");
        setRobotsIndex(city.seo.robotsIndex);
        setRobotsFollow(city.seo.robotsFollow);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cityId]);

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      await api(`/cities/${cityId}/seo`, {
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
        <label className="block text-xs font-semibold">
          <FieldLabel label="SEO title" help={commonFieldHelp.seoTitle} />
          <input value={seoTitle} onChange={(event) => setSeoTitle(event.target.value)} className={inputClass} />
        </label>
        <label className="block text-xs font-semibold">
          <FieldLabel label="Meta description" help={commonFieldHelp.metaDescription} />
          <input
            value={metaDescription}
            onChange={(event) => setMetaDescription(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block text-xs font-semibold">
          <FieldLabel label="Canonical URL (optional)" help={commonFieldHelp.canonicalUrl} />
          <input
            value={canonicalUrl}
            onChange={(event) => setCanonicalUrl(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block text-xs font-semibold">
          <FieldLabel label="OG title (optional)" help={commonFieldHelp.ogTitle} />
          <input value={ogTitle} onChange={(event) => setOgTitle(event.target.value)} className={inputClass} />
        </label>
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold">
            <FieldLabel label="OG description (optional)" help={commonFieldHelp.ogDescription} />
            <input
              value={ogDescription}
              onChange={(event) => setOgDescription(event.target.value)}
              className={inputClass}
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold">
          <input
            type="checkbox"
            checked={robotsIndex}
            onChange={(event) => setRobotsIndex(event.target.checked)}
          />
          <FieldLabel label="Allow search indexing" help={commonFieldHelp.robotsIndex} />
        </label>
        <label className="flex items-center gap-2 text-xs font-semibold">
          <input
            type="checkbox"
            checked={robotsFollow}
            onChange={(event) => setRobotsFollow(event.target.checked)}
          />
          <FieldLabel label="Allow link following" help={commonFieldHelp.robotsFollow} />
        </label>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          disabled={busy || !seoTitle || !metaDescription}
          onClick={() => void save()}
          className="rounded-lg bg-[#1657CF] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
        >
          Save SEO
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

export function LocationsManager() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const tab: "states" | "cities" = searchParams.get("tab") === "states" ? "states" : "cities";
  function setTab(next: "states" | "cities") {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    router.push(`${pathname}?${params.toString()}`);
  }
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [states, setStates] = useState<StateRow[]>([]);
  const [cities, setCities] = useState<CityRow[]>([]);
  const [message, setMessage] = useState("");

  const [countryFilter, setCountryFilter] = useState("");

  const [newStateCountryId, setNewStateCountryId] = useState("");
  const [newStateName, setNewStateName] = useState("");
  const [creatingState, setCreatingState] = useState(false);

  const [newCityCountryId, setNewCityCountryId] = useState("");
  const [newCityStateId, setNewCityStateId] = useState("");
  const [newCityName, setNewCityName] = useState("");
  const [newCityShortDescription, setNewCityShortDescription] = useState("");
  const [creatingCity, setCreatingCity] = useState(false);
  const [seoEditingCityId, setSeoEditingCityId] = useState<string | null>(null);

  const loadStates = useCallback(async () => {
    try {
      setStates(await api<StateRow[]>("/states"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load states");
    }
  }, []);
  const loadCities = useCallback(async () => {
    try {
      setCities(await api<CityRow[]>("/cities"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load cities");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadStates();
    void loadCities();
    void api<CountryOption[]>("/countries?limit=100")
      .then(setCountries)
      .catch(() => undefined);
  }, [loadStates, loadCities]);

  const statesForNewCity = states.filter((state) => state.country.slug === countryOf(newCityCountryId, countries)?.slug);

  function countryOf(id: string, list: CountryOption[]) {
    return list.find((country) => country.id === id);
  }

  async function createState(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newStateCountryId || !newStateName.trim()) {
      setMessage("Choose a country and enter a state name.");
      return;
    }
    setCreatingState(true);
    setMessage("");
    try {
      await api("/states", {
        method: "POST",
        body: JSON.stringify({ countryId: newStateCountryId, name: newStateName.trim() }),
      });
      setNewStateName("");
      await loadStates();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create state");
    } finally {
      setCreatingState(false);
    }
  }

  async function updateStateStatus(state: StateRow, status: string) {
    try {
      await api(`/states/${state.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      await loadStates();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update state");
    }
  }

  async function archiveState(state: StateRow) {
    try {
      await api(`/states/${state.id}`, { method: "DELETE" });
      setMessage("State archived.");
      await loadStates();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to archive — cities still reference this state",
      );
    }
  }

  async function createCity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newCityCountryId || !newCityName.trim()) {
      setMessage("Choose a country and enter a city name.");
      return;
    }
    setCreatingCity(true);
    setMessage("");
    try {
      await api("/cities", {
        method: "POST",
        body: JSON.stringify({
          countryId: newCityCountryId,
          stateId: newCityStateId || undefined,
          name: newCityName.trim(),
          shortDescription: newCityShortDescription.trim() || undefined,
        }),
      });
      setNewCityName("");
      setNewCityShortDescription("");
      await loadCities();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create city");
    } finally {
      setCreatingCity(false);
    }
  }

  async function updateCityStatus(city: CityRow, status: string) {
    try {
      await api(`/cities/${city.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      await loadCities();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update city");
    }
  }

  async function toggleFeatured(city: CityRow) {
    try {
      await api(`/cities/${city.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isFeatured: !city.isFeatured }),
      });
      await loadCities();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update city");
    }
  }

  async function archiveCity(city: CityRow) {
    try {
      await api(`/cities/${city.id}`, { method: "DELETE" });
      setMessage("City archived.");
      await loadCities();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to archive city");
    }
  }

  const visibleCities = countryFilter
    ? cities.filter((city) => city.country.slug === countryFilter)
    : cities;

  return (
    <section className="mx-auto max-w-[1240px]">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#828B9B]">Location hierarchy</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">States &amp; cities</h2>
        <p className="mt-2 text-sm text-[#667085]">
          Manage the destination hierarchy that backs each country&apos;s canonical{" "}
          <code>/study-in-{"{country}"}</code> page and its nested city pages.
        </p>
      </div>

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={() => setTab("cities")}
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${tab === "cities" ? "bg-[#1657CF] text-white" : "border border-[#D9E0EA] text-[#48505F]"}`}
        >
          Cities
        </button>
        <button
          type="button"
          onClick={() => setTab("states")}
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${tab === "states" ? "bg-[#1657CF] text-white" : "border border-[#D9E0EA] text-[#48505F]"}`}
        >
          States / provinces
        </button>
      </div>

      {message ? (
        <p className="mt-4 text-sm text-[#48505F]" role="status">
          {message}
        </p>
      ) : null}

      {tab === "states" ? (
        <>
          <form
            onSubmit={(event) => void createState(event)}
            className="mt-6 grid gap-4 rounded-2xl border border-[#E8ECF3] bg-white p-5 sm:grid-cols-3"
          >
            <div>
              <FieldLabel label="Country" htmlFor="state-country" required help={commonFieldHelp.country} />
              <select
                id="state-country"
                className={inputClass}
                value={newStateCountryId}
                onChange={(event) => setNewStateCountryId(event.target.value)}
              >
                <option value="">Select a country…</option>
                {countries.map((country) => (
                  <option key={country.id} value={country.id}>
                    {country.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel label="State / province name" htmlFor="state-name" required help={commonFieldHelp.name} />
              <input
                id="state-name"
                className={inputClass}
                value={newStateName}
                onChange={(event) => setNewStateName(event.target.value)}
                placeholder="Ontario"
              />
            </div>
            <div className="flex items-end">
              <button type="submit" disabled={creatingState} className={buttonClass}>
                {creatingState ? "Creating…" : "Add state"}
              </button>
            </div>
          </form>

          <div className="mt-6 overflow-x-auto rounded-2xl border border-[#E8ECF3] bg-white">
            <table className="w-full text-sm">
              <thead className="bg-[#F7F9FC] text-left text-xs font-semibold uppercase tracking-[0.08em] text-[#828B9B]">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Country</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {states.map((state) => (
                  <tr key={state.id} className="border-t border-[#E8ECF3]">
                    <td className="px-4 py-3 font-medium">
                      {state.name} <span className="text-[#9AA3B2]">({state.slug})</span>
                    </td>
                    <td className="px-4 py-3">{state.country.name}</td>
                    <td className="px-4 py-3">
                      <select
                        className="rounded-lg border border-[#D9E0EA] px-2 py-1.5 text-xs"
                        value={state.status}
                        onChange={(event) => void updateStateStatus(state, event.target.value)}
                      >
                        {STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void archiveState(state)}
                        className="text-xs font-semibold text-red-700"
                      >
                        Archive
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {states.length === 0 ? (
              <p className="p-5 text-sm text-[#667085]">No states yet.</p>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <form
            onSubmit={(event) => void createCity(event)}
            className="mt-6 grid gap-4 rounded-2xl border border-[#E8ECF3] bg-white p-5 sm:grid-cols-2"
          >
            <div>
              <FieldLabel label="Country" htmlFor="city-country" required help={commonFieldHelp.country} />
              <select
                id="city-country"
                className={inputClass}
                value={newCityCountryId}
                onChange={(event) => {
                  setNewCityCountryId(event.target.value);
                  setNewCityStateId("");
                }}
              >
                <option value="">Select a country…</option>
                {countries.map((country) => (
                  <option key={country.id} value={country.id}>
                    {country.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel label="State / province (optional)" htmlFor="city-state" help={commonFieldHelp.state} />
              <select
                id="city-state"
                className={inputClass}
                value={newCityStateId}
                onChange={(event) => setNewCityStateId(event.target.value)}
                disabled={!statesForNewCity.length}
              >
                <option value="">None</option>
                {statesForNewCity.map((state) => (
                  <option key={state.id} value={state.id}>
                    {state.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel label="City name" htmlFor="city-name" required help={commonFieldHelp.name} />
              <input
                id="city-name"
                className={inputClass}
                value={newCityName}
                onChange={(event) => setNewCityName(event.target.value)}
                placeholder="Toronto"
              />
            </div>
            <div>
              <FieldLabel label="Short description (optional)" htmlFor="city-description" help={commonFieldHelp.shortDescription} />
              <input
                id="city-description"
                className={inputClass}
                value={newCityShortDescription}
                onChange={(event) => setNewCityShortDescription(event.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <button type="submit" disabled={creatingCity} className={buttonClass}>
                {creatingCity ? "Creating…" : "Add city"}
              </button>
            </div>
          </form>

          <div className="mt-6 flex items-center gap-3">
            <label className="text-sm font-semibold" htmlFor="city-country-filter">
              Filter by country
            </label>
            <select
              id="city-country-filter"
              className="rounded-xl border border-[#D9E0EA] bg-white px-3 py-2 text-sm"
              value={countryFilter}
              onChange={(event) => setCountryFilter(event.target.value)}
            >
              <option value="">All countries</option>
              {[...new Set(cities.map((city) => city.country.slug))].map((slug) => (
                <option key={slug} value={slug}>
                  {cities.find((city) => city.country.slug === slug)?.country.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 overflow-x-auto rounded-2xl border border-[#E8ECF3] bg-white">
            <table className="w-full text-sm">
              <thead className="bg-[#F7F9FC] text-left text-xs font-semibold uppercase tracking-[0.08em] text-[#828B9B]">
                <tr>
                  <th className="px-4 py-3">City</th>
                  <th className="px-4 py-3">Country</th>
                  <th className="px-4 py-3">State</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Featured</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {visibleCities.map((city) => (
                  <Fragment key={city.id}>
                  <tr className="border-t border-[#E8ECF3]">
                    <td className="px-4 py-3 font-medium">
                      {city.name} <span className="text-[#9AA3B2]">({city.slug})</span>
                    </td>
                    <td className="px-4 py-3">{city.country.name}</td>
                    <td className="px-4 py-3">{city.state?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <select
                        className="rounded-lg border border-[#D9E0EA] px-2 py-1.5 text-xs"
                        value={city.status}
                        onChange={(event) => void updateCityStatus(city, event.target.value)}
                      >
                        {STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => void toggleFeatured(city)}
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${city.isFeatured ? "bg-[#E9F8F0] text-[#18794E]" : "bg-[#F7F9FC] text-[#828B9B]"}`}
                      >
                        {city.isFeatured ? "Featured" : "Not featured"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setSeoEditingCityId(seoEditingCityId === city.id ? null : city.id)
                        }
                        className="mr-3 text-xs font-semibold text-[#1657CF]"
                      >
                        SEO
                      </button>
                      <button
                        type="button"
                        onClick={() => void archiveCity(city)}
                        className="text-xs font-semibold text-red-700"
                      >
                        Archive
                      </button>
                    </td>
                  </tr>
                  {seoEditingCityId === city.id ? (
                    <tr className="border-t border-[#E8ECF3] bg-[#F7F9FC]">
                      <td colSpan={6} className="p-4">
                        <CitySeoEditor
                          cityId={city.id}
                          onSaved={() => setMessage("City SEO saved.")}
                          onClose={() => setSeoEditingCityId(null)}
                        />
                      </td>
                    </tr>
                  ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
            {visibleCities.length === 0 ? (
              <p className="p-5 text-sm text-[#667085]">No cities yet.</p>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}
