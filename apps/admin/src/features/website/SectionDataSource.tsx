"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/features/auth/auth-client";

export type DataSourceValue = {
  limit?: number;
  dataMode?: "automatic" | "manual";
  filters?: { q?: string; country?: string };
  sort?: string;
  picks?: string[];
};

/** Which catalogue each section reads, and which of the API's filters that
 * catalogue genuinely supports. Only supported controls are offered: a filter
 * the API ignores would look like it worked and quietly change nothing. */
const SOURCES: Record<
  string,
  { label: string; resource: string; supportsCountry: boolean }
> = {
  COUNTRY_DIRECTORY: {
    label: "destinations",
    resource: "countries",
    supportsCountry: false,
  },
  UNIVERSITY_DIRECTORY: {
    label: "universities",
    resource: "universities",
    supportsCountry: true,
  },
  COURSE_DIRECTORY: {
    label: "courses",
    resource: "courses",
    supportsCountry: false,
  },
  SCHOLARSHIP_DIRECTORY: {
    label: "scholarships",
    resource: "scholarships",
    supportsCountry: true,
  },
  CONSULTANT_DIRECTORY: {
    label: "consultants",
    resource: "consultants",
    supportsCountry: true,
  },
  TESTIMONIALS: {
    label: "testimonials",
    resource: "testimonials",
    supportsCountry: false,
  },
  SUCCESS_STORIES: {
    label: "success stories",
    resource: "success-stories",
    supportsCountry: false,
  },
};

export function isDataSourceSection(sectionType: string): boolean {
  return Boolean(SOURCES[sectionType]);
}

type Option = { slug: string; name: string };

const controlClass =
  "mt-1 w-full rounded-xl border border-[#D9E0EA] bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#1657CF] focus:ring-2 focus:ring-[#DCE8FF]";

/** "Where does this content come from?" for the catalogue-backed sections.
 *
 * Automatic keeps the section current on its own: it asks the catalogue for
 * matching records every time the page renders. Manual pins an exact set, in
 * an exact order, for a curated row. */
export function SectionDataSource({
  sectionType,
  value,
  onChange,
}: {
  sectionType: string;
  value: DataSourceValue;
  onChange: (patch: DataSourceValue) => void;
}) {
  const source = SOURCES[sectionType];
  const mode = value.dataMode ?? "automatic";
  const [options, setOptions] = useState<Option[]>([]);
  const [countries, setCountries] = useState<Option[]>([]);
  const [search, setSearch] = useState("");

  // Records to pick from, loaded only when the admin is actually choosing.
  useEffect(() => {
    if (!source || mode !== "manual") return;
    let cancelled = false;
    void (async () => {
      try {
        const params = new URLSearchParams({ limit: "50" });
        if (search.trim()) params.set("q", search.trim());
        const response = await authFetch(
          `/api/v1/admin/phase1/${source.resource}?${params}`,
          { cache: "no-store" },
        );
        const body = await response.json();
        if (cancelled) return;
        const rows = (body?.data ?? []) as Record<string, unknown>[];
        setOptions(
          rows
            .map((row) => ({
              slug: String(row.slug ?? ""),
              name: String(row.name ?? row.title ?? row.slug ?? ""),
            }))
            .filter((row) => row.slug),
        );
      } catch {
        if (!cancelled) setOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [source, mode, search]);

  // Country choices for the one filter the API supports on these resources.
  useEffect(() => {
    if (!source?.supportsCountry || mode !== "automatic") return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await authFetch(
          "/api/v1/admin/phase1/countries?limit=100",
          { cache: "no-store" },
        );
        const body = await response.json();
        if (cancelled) return;
        setCountries(
          ((body?.data ?? []) as Record<string, unknown>[])
            .map((row) => ({
              slug: String(row.slug ?? ""),
              name: String(row.name ?? ""),
            }))
            .filter((row) => row.slug),
        );
      } catch {
        if (!cancelled) setCountries([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [source, mode]);

  if (!source) return null;
  const picks = value.picks ?? [];

  function togglePick(slug: string) {
    onChange({
      picks: picks.includes(slug)
        ? picks.filter((entry) => entry !== slug)
        : [...picks, slug],
    });
  }

  return (
    <fieldset
      className="mt-4 rounded-xl border border-[#E8ECF3] p-4"
      data-testid="section-data-source"
    >
      <legend className="px-1 text-sm font-semibold">Content source</legend>
      <p className="text-xs text-[#828B9B]">
        This section shows {source.label} from your catalogue. Only published
        records ever appear.
      </p>

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Content source">
        {(["automatic", "manual"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={mode === option}
            onClick={() => onChange({ dataMode: option })}
            data-testid={`data-mode-${option}`}
            className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
              mode === option
                ? "border-[#1657CF] bg-[#F2F7FF] text-[#1657CF]"
                : "border-[#D9E0EA]"
            }`}
          >
            {option === "automatic" ? "Automatic" : "Choose them myself"}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-[#828B9B]">
        {mode === "automatic"
          ? "Stays up to date on its own as records are added or published."
          : "Shows exactly the records you tick, in the order you tick them."}
      </p>

      <label className="mt-4 block text-sm font-semibold">
        Number to show
        <input
          type="number"
          min={1}
          max={12}
          value={value.limit ?? 6}
          onChange={(event) =>
            onChange({ limit: Number(event.target.value) || 6 })
          }
          className={controlClass}
        />
      </label>

      {mode === "automatic" ? (
        <>
          <label className="mt-3 block text-sm font-semibold">
            Only show ones matching (optional)
            <input
              type="search"
              value={value.filters?.q ?? ""}
              onChange={(event) =>
                onChange({
                  filters: { ...value.filters, q: event.target.value },
                })
              }
              placeholder="e.g. engineering"
              className={controlClass}
            />
          </label>
          {source.supportsCountry ? (
            <label className="mt-3 block text-sm font-semibold">
              Country (optional)
              <select
                value={value.filters?.country ?? ""}
                onChange={(event) =>
                  onChange({
                    filters: { ...value.filters, country: event.target.value },
                  })
                }
                className={controlClass}
              >
                <option value="">Any country</option>
                {countries.map((country) => (
                  <option key={country.slug} value={country.slug}>
                    {country.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </>
      ) : (
        <div className="mt-3">
          <label className="block text-sm font-semibold">
            Search {source.label}
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Find ${source.label} to add`}
              className={controlClass}
            />
          </label>
          <p className="mt-2 text-xs text-[#828B9B]">
            {picks.length
              ? `${picks.length} chosen`
              : "Nothing chosen yet — this section will be empty until you pick some."}
          </p>
          <ul className="mt-2 max-h-56 space-y-1 overflow-auto">
            {options.map((option) => (
              <li key={option.slug}>
                <label className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-[#F7F9FC]">
                  <input
                    type="checkbox"
                    checked={picks.includes(option.slug)}
                    onChange={() => togglePick(option.slug)}
                  />
                  <span>{option.name}</span>
                </label>
              </li>
            ))}
          </ul>
          {options.length === 0 ? (
            <p className="mt-2 text-xs text-[#828B9B]">
              No {source.label} found.
            </p>
          ) : null}
        </div>
      )}
    </fieldset>
  );
}
