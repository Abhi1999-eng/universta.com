"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getCountryProfiles,
  listIntakeOptions,
  putCountryProfile,
} from "./catalog-client";
import type { CountryProfileBundle, IntakeOption } from "./catalog.types";

/**
 * Country-owned profile editing.
 *
 * Each card saves independently against its own optimistic-concurrency token:
 * the API rejects a write whose `expectedUpdatedAt` does not match the stored
 * row exactly. That makes re-seeding the drafts from the server response after
 * every save mandatory rather than cosmetic -- without it the first save
 * succeeds and every later save fails as a stale version.
 */

type Draft = Record<string, unknown>;
type Section = "cost" | "work" | "language" | "statistics";

const text = (value: unknown) =>
  value === null || value === undefined ? "" : String(value);
/** `<input type="date">` needs a bare calendar day; the API returns a full ISO
 * timestamp and accepts either back. */
const day = (value: unknown) => text(value).slice(0, 10);
const bool = (value: unknown) => value === true || value === "true";

const inputClass =
  "mt-1 w-full rounded-lg border border-[#D9E0EA] px-3 py-2 text-sm outline-none focus:border-[#1657CF]";

const COST_PERIODS = ["PER_YEAR", "PER_MONTH", "PER_TERM", "ONE_TIME"];
const LANGUAGE_REQUIREMENTS = [
  "REQUIRED",
  "OPTIONAL",
  "NOT_REQUIRED",
  "VARIES",
];
const INTAKE_AVAILABILITY = [
  "AVAILABLE",
  "LIMITED",
  "NOT_AVAILABLE",
  "NOT_PUBLISHED",
];
const SOURCE_MODES = ["DERIVED", "MANUAL", "IMPORTED", "OFFICIAL"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type FieldSpec = {
  key: string;
  label: string;
  kind?: "text" | "number" | "date" | "checkbox" | "textarea" | "select";
  options?: string[];
  hint?: string;
  wide?: boolean;
};

type IntakeDraft = {
  intakeId: string;
  isMajor: boolean;
  availabilityStatus: string;
  applicationOpeningMonth: string;
  applicationDeadlineMonth: string;
  applicationOpeningNote: string;
  applicationDeadlineNote: string;
  notes: string;
};

function emptyIntake(intakeId: string): IntakeDraft {
  return {
    intakeId,
    isMajor: false,
    availabilityStatus: "AVAILABLE",
    applicationOpeningMonth: "",
    applicationDeadlineMonth: "",
    applicationOpeningNote: "",
    applicationDeadlineNote: "",
    notes: "",
  };
}

function intakeFromRecord(row: Record<string, unknown>): IntakeDraft {
  return {
    intakeId: String(row.intakeId ?? row.id ?? ""),
    isMajor: bool(row.isMajor),
    availabilityStatus: text(row.availabilityStatus) || "AVAILABLE",
    applicationOpeningMonth: text(row.applicationOpeningMonth),
    applicationDeadlineMonth: text(row.applicationDeadlineMonth),
    applicationOpeningNote: text(row.applicationOpeningNote),
    applicationDeadlineNote: text(row.applicationDeadlineNote),
    notes: text(row.notes),
  };
}

export function CountryProfilesEditor({ countryId }: { countryId: string }) {
  const [bundle, setBundle] = useState<CountryProfileBundle | null>(null);
  const [intakeOptions, setIntakeOptions] = useState<IntakeOption[]>([]);
  const [cost, setCost] = useState<Draft>({});
  const [work, setWork] = useState<Draft>({});
  const [language, setLanguage] = useState<Draft>({});
  const [statistics, setStatistics] = useState<Draft>({ sourceMode: "DERIVED" });
  const [intakes, setIntakes] = useState<IntakeDraft[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState("");

  /** Every draft is re-seeded from the server payload, so the concurrency
   * token a card holds is always the one the API just wrote. */
  const seed = useCallback((data: CountryProfileBundle) => {
    setBundle(data);
    setCost((data.cost ?? {}) as Draft);
    setWork((data.work ?? {}) as Draft);
    setLanguage((data.language ?? {}) as Draft);
    setStatistics((data.statistics ?? { sourceMode: "DERIVED" }) as Draft);
    setIntakes((data.intakes ?? []).map(intakeFromRecord));
  }, []);

  useEffect(() => {
    void Promise.all([getCountryProfiles(countryId), listIntakeOptions()])
      .then(([profiles, options]) => {
        seed(profiles.data);
        setIntakeOptions(options.data);
      })
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to load country profiles",
        ),
      );
  }, [countryId, seed]);

  async function save(section: Section | "intakes") {
    setMessage("");
    setError("");
    setSaving(section);
    try {
      const drafts: Record<Section, Draft> = {
        cost,
        work,
        language,
        statistics,
      };
      const payload =
        section === "intakes"
          ? {
              // The intakes version token is the newest CountryIntake row, not
              // the country itself, and must be omitted entirely while none
              // exist -- sending one against no rows is treated as stale.
              expectedUpdatedAt: intakeVersion(bundle),
              intakes: intakes.map((row, displayOrder) => ({
                intakeId: row.intakeId,
                isMajor: row.isMajor,
                availabilityStatus: row.availabilityStatus,
                applicationOpeningMonth: row.applicationOpeningMonth || undefined,
                applicationDeadlineMonth:
                  row.applicationDeadlineMonth || undefined,
                applicationOpeningNote: row.applicationOpeningNote || undefined,
                applicationDeadlineNote:
                  row.applicationDeadlineNote || undefined,
                notes: row.notes || undefined,
                displayOrder,
              })),
            }
          : {
              ...drafts[section],
              expectedUpdatedAt: drafts[section].updatedAt as string | undefined,
            };
      await putCountryProfile(
        countryId,
        section,
        payload as Record<string, unknown>,
      );
      // Re-read rather than trusting local state: this is what keeps a second
      // edit working, and it surfaces any server-side normalisation.
      const refreshed = await getCountryProfiles(countryId);
      seed(refreshed.data);
      setMessage(`${LABELS[section]} saved.`);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Unable to save");
    } finally {
      setSaving("");
    }
  }

  if (!bundle)
    return (
      <section className="mt-8 rounded-2xl border border-[#E8ECF3] bg-white p-6 text-sm text-[#667085]">
        {error || "Loading country profiles…"}
      </section>
    );

  const derivedCount = bundle.derivedUniversitiesCount ?? null;
  const usingManualCount =
    text(statistics.sourceMode) !== "DERIVED" &&
    Boolean(statistics.sourceReference) &&
    Boolean(statistics.verifiedAt);

  return (
    <section className="mt-8 space-y-6" aria-labelledby="country-profiles-heading">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#828B9B]">
          Country profiles
        </p>
        <h2 id="country-profiles-heading" className="mt-2 text-2xl font-semibold">
          Cost, visa, English, statistics and intakes
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#667085]">
          Each section saves on its own. Leave a value empty to let the
          catalogue answer for it.
        </p>
      </div>

      {message ? (
        <p role="status" className="rounded-xl bg-[#E9F8F0] p-3 text-sm text-[#18794E]">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-xl bg-[#FFF7F7] p-3 text-sm text-[#B42318]">
          {error}
        </p>
      ) : null}

      <ProfileCard
        title="Cost and budget"
        description="Published tuition and living ranges for this country. When left empty the country page falls back to the average of published course offerings."
        onSave={() => void save("cost")}
        busy={saving === "cost"}
      >
        <Fields
          draft={cost}
          set={setCost}
          fields={[
            { key: "currencyCode", label: "Currency code", hint: "Three letters, e.g. EUR" },
            { key: "currencySymbol", label: "Currency symbol" },
            { key: "tuitionMin", label: "Tuition minimum", kind: "number" },
            { key: "tuitionMax", label: "Tuition maximum", kind: "number" },
            { key: "tuitionPeriod", label: "Tuition period", kind: "select", options: COST_PERIODS },
            { key: "livingCostMin", label: "Living cost minimum", kind: "number" },
            { key: "livingCostMax", label: "Living cost maximum", kind: "number" },
            { key: "livingCostPeriod", label: "Living cost period", kind: "select", options: COST_PERIODS },
            { key: "applicationFeeMin", label: "Application fee minimum", kind: "number" },
            { key: "applicationFeeMax", label: "Application fee maximum", kind: "number" },
            { key: "tuitionNotes", label: "Tuition notes", kind: "textarea", wide: true },
            { key: "livingCostNotes", label: "Living cost notes", kind: "textarea", wide: true },
            { key: "sourceReference", label: "Source reference", wide: true },
            { key: "verifiedAt", label: "Verified on", kind: "date" },
          ]}
        />
      </ProfileCard>

      <ProfileCard
        title="Work and visa"
        description="Visa route, cost and processing time, plus what students may work during and after the course."
        onSave={() => void save("work")}
        busy={saving === "work"}
      >
        <Fields
          draft={work}
          set={setWork}
          fields={[
            { key: "visaType", label: "Visa type" },
            { key: "visaProcessingTime", label: "Visa processing time" },
            { key: "visaFee", label: "Visa fee", kind: "number" },
            { key: "visaFeeCurrencyCode", label: "Visa fee currency", hint: "Three letters" },
            { key: "partTimeAllowed", label: "Part-time work allowed during study", kind: "checkbox" },
            { key: "partTimeHoursPerWeek", label: "Work hours per week", kind: "number" },
            { key: "partTimeHoursDuringBreaks", label: "Work hours during breaks", kind: "number" },
            { key: "partTimeSummary", label: "Part-time work summary", kind: "textarea", wide: true },
            { key: "postStudyWorkAvailable", label: "Post-study work available", kind: "checkbox" },
            { key: "postStudyWorkMinMonths", label: "Post-study work minimum months", kind: "number" },
            { key: "postStudyWorkMaxMonths", label: "Post-study work maximum months", kind: "number" },
            { key: "postStudyWorkSummary", label: "Post-study work summary", kind: "textarea", wide: true },
            { key: "visaInformation", label: "Visa process", kind: "textarea", wide: true },
            { key: "sourceReference", label: "Source reference", wide: true },
            { key: "verifiedAt", label: "Verified on", kind: "date" },
          ]}
        />
      </ProfileCard>

      <ProfileCard
        title="English requirements"
        description="Country-level guidance. Individual programmes may still ask for more."
        onSave={() => void save("language")}
        busy={saving === "language"}
      >
        <Fields
          draft={language}
          set={setLanguage}
          fields={[
            { key: "ieltsRequirement", label: "IELTS requirement", kind: "select", options: LANGUAGE_REQUIREMENTS },
            { key: "ieltsMinScore", label: "IELTS minimum score", kind: "number" },
            { key: "ieltsNotes", label: "IELTS notes", kind: "textarea", wide: true },
            { key: "pteRequirement", label: "PTE requirement", kind: "select", options: LANGUAGE_REQUIREMENTS },
            { key: "pteMinScore", label: "PTE minimum score", kind: "number" },
            { key: "toeflRequirement", label: "TOEFL requirement", kind: "select", options: LANGUAGE_REQUIREMENTS },
            { key: "toeflMinScore", label: "TOEFL minimum score", kind: "number" },
            { key: "duolingoRequirement", label: "Duolingo requirement", kind: "select", options: LANGUAGE_REQUIREMENTS },
            { key: "duolingoMinScore", label: "Duolingo minimum score", kind: "number" },
            { key: "languageWaiverAvailable", label: "Language waiver available", kind: "checkbox" },
            { key: "waiverNotes", label: "Waiver notes", kind: "textarea", wide: true },
            { key: "generalNotes", label: "General notes", kind: "textarea", wide: true },
            { key: "sourceReference", label: "Source reference", wide: true },
            { key: "verifiedAt", label: "Verified on", kind: "date" },
          ]}
        />
      </ProfileCard>

      <ProfileCard
        title="Statistics"
        description="Counts shown on the public country page."
        onSave={() => void save("statistics")}
        busy={saving === "statistics"}
      >
        <label className="text-sm font-semibold">
          Where the university count comes from
          <select
            className={inputClass}
            value={text(statistics.sourceMode) || "DERIVED"}
            onChange={(event) =>
              setStatistics((current) => ({
                ...current,
                sourceMode: event.target.value,
              }))
            }
          >
            {SOURCE_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {mode === "DERIVED"
                  ? "Count published universities automatically"
                  : mode === "MANUAL"
                    ? "Use the number I enter"
                    : mode === "IMPORTED"
                      ? "Use an imported number"
                      : "Use an official published number"}
              </option>
            ))}
          </select>
        </label>
        <Fields
          draft={statistics}
          set={setStatistics}
          fields={[
            { key: "universitiesCount", label: "Universities count", kind: "number" },
            { key: "internationalStudentsCount", label: "International students", kind: "number" },
            { key: "sourceReference", label: "Source reference", wide: true },
            { key: "verifiedAt", label: "Verified on", kind: "date" },
          ]}
        />
        <p className="sm:col-span-2 rounded-xl bg-[#F8FAFC] p-3 text-sm leading-6 text-[#475467]">
          {text(statistics.sourceMode) === "DERIVED" || !statistics.sourceMode ? (
            <>
              The country page counts published universities itself
              {derivedCount === null ? "" : ` — currently ${derivedCount}`}. Any
              number typed above is stored but not shown.
            </>
          ) : usingManualCount ? (
            <>
              The number above is shown on the country page instead of the live
              count{derivedCount === null ? "" : ` of ${derivedCount}`}.
            </>
          ) : (
            <>
              Add a source reference and a verification date, or the country
              page keeps counting published universities itself
              {derivedCount === null ? "" : ` (${derivedCount})`}.
            </>
          )}
        </p>
      </ProfileCard>

      <ProfileCard
        title="Intakes"
        description="When students can start, and when applications open and close."
        onSave={() => void save("intakes")}
        busy={saving === "intakes"}
        full
      >
        <div className="sm:col-span-2 space-y-4">
          {intakeOptions.length === 0 ? (
            <p className="text-sm text-[#667085]">No intake records exist yet.</p>
          ) : null}
          {intakeOptions.map((option) => {
            const index = intakes.findIndex((row) => row.intakeId === option.id);
            const selected = index >= 0;
            const row = selected ? intakes[index] : null;
            return (
              <div
                key={option.id}
                className="rounded-xl border border-[#E8ECF3] p-4"
              >
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() =>
                      setIntakes((current) =>
                        selected
                          ? current.filter((item) => item.intakeId !== option.id)
                          : [...current, emptyIntake(option.id)],
                      )
                    }
                  />
                  {option.name}
                </label>
                {row ? (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <label className="flex items-center gap-2 text-sm font-semibold">
                      <input
                        type="checkbox"
                        checked={row.isMajor}
                        onChange={(event) =>
                          updateIntake(setIntakes, option.id, {
                            isMajor: event.target.checked,
                          })
                        }
                      />
                      Major intake
                    </label>
                    <label className="text-sm font-semibold">
                      Availability
                      <select
                        className={inputClass}
                        value={row.availabilityStatus}
                        onChange={(event) =>
                          updateIntake(setIntakes, option.id, {
                            availabilityStatus: event.target.value,
                          })
                        }
                      >
                        {INTAKE_AVAILABILITY.map((value) => (
                          <option key={value} value={value}>
                            {value.replace(/_/g, " ").toLowerCase()}
                          </option>
                        ))}
                      </select>
                    </label>
                    <MonthField
                      label="Applications open"
                      value={row.applicationOpeningMonth}
                      onChange={(value) =>
                        updateIntake(setIntakes, option.id, {
                          applicationOpeningMonth: value,
                        })
                      }
                    />
                    <MonthField
                      label="Applications close"
                      value={row.applicationDeadlineMonth}
                      onChange={(value) =>
                        updateIntake(setIntakes, option.id, {
                          applicationDeadlineMonth: value,
                        })
                      }
                    />
                    <label className="text-sm font-semibold sm:col-span-2">
                      Notes
                      <textarea
                        className={inputClass}
                        rows={2}
                        value={row.notes}
                        onChange={(event) =>
                          updateIntake(setIntakes, option.id, {
                            notes: event.target.value,
                          })
                        }
                      />
                    </label>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </ProfileCard>
    </section>
  );
}

/** Newest `updatedAt` across the country's saved intakes, or undefined when
 * the country has none yet. */
function intakeVersion(bundle: CountryProfileBundle | null): string | undefined {
  const stamps = (bundle?.intakes ?? [])
    .map((row) => text(row.updatedAt))
    .filter(Boolean)
    .sort();
  return stamps.length ? stamps[stamps.length - 1] : undefined;
}

const LABELS: Record<Section | "intakes", string> = {
  cost: "Cost and budget",
  work: "Work and visa",
  language: "English requirements",
  statistics: "Statistics",
  intakes: "Intakes",
};

function updateIntake(
  set: React.Dispatch<React.SetStateAction<IntakeDraft[]>>,
  intakeId: string,
  patch: Partial<IntakeDraft>,
) {
  set((current) =>
    current.map((row) =>
      row.intakeId === intakeId ? { ...row, ...patch } : row,
    ),
  );
}

function MonthField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm font-semibold">
      {label}
      <select
        className={inputClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Not published</option>
        {MONTHS.map((name, index) => (
          <option key={name} value={String(index + 1)}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}

function ProfileCard({
  title,
  description,
  children,
  onSave,
  busy,
  full,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  onSave: () => void;
  busy: boolean;
  full?: boolean;
}) {
  return (
    <section className="rounded-2xl border border-[#E8ECF3] bg-white p-6">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-[#667085]">
        {description}
      </p>
      <div className={`mt-5 grid gap-4 ${full ? "" : "sm:grid-cols-2"}`}>
        {children}
      </div>
      <button
        type="button"
        onClick={onSave}
        disabled={busy}
        className="mt-5 rounded-xl bg-[#1657CF] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Saving…" : `Save ${title.toLowerCase()}`}
      </button>
    </section>
  );
}

function Fields({
  draft,
  set,
  fields,
}: {
  draft: Draft;
  set: React.Dispatch<React.SetStateAction<Draft>>;
  fields: FieldSpec[];
}) {
  return (
    <>
      {fields.map((field) => {
        const patch = (value: unknown) =>
          set((current) => ({ ...current, [field.key]: value }));
        const span = field.wide ? "sm:col-span-2" : "";
        if (field.kind === "checkbox")
          return (
            <label
              key={field.key}
              className={`flex items-center gap-2 text-sm font-semibold ${span}`}
            >
              <input
                type="checkbox"
                checked={bool(draft[field.key])}
                onChange={(event) => patch(event.target.checked)}
              />
              {field.label}
            </label>
          );
        return (
          <label key={field.key} className={`text-sm font-semibold ${span}`}>
            {field.label}
            {field.kind === "select" ? (
              <select
                className={inputClass}
                value={text(draft[field.key])}
                onChange={(event) => patch(event.target.value)}
              >
                <option value="">Not set</option>
                {(field.options ?? []).map((option) => (
                  <option key={option} value={option}>
                    {option.replace(/_/g, " ").toLowerCase()}
                  </option>
                ))}
              </select>
            ) : field.kind === "textarea" ? (
              <textarea
                className={inputClass}
                rows={3}
                value={text(draft[field.key])}
                onChange={(event) => patch(event.target.value)}
              />
            ) : (
              <input
                className={inputClass}
                type={
                  field.kind === "date"
                    ? "date"
                    : field.kind === "number"
                      ? "number"
                      : "text"
                }
                value={
                  field.kind === "date"
                    ? day(draft[field.key])
                    : text(draft[field.key])
                }
                onChange={(event) => patch(event.target.value)}
              />
            )}
            {field.hint ? (
              <span className="mt-1 block text-xs font-normal text-[#828B9B]">
                {field.hint}
              </span>
            ) : null}
          </label>
        );
      })}
    </>
  );
}
