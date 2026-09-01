"use client";

import { useEffect, useState } from "react";
import {
  getCountryProfiles,
  listIntakeOptions,
  putCountryProfile,
} from "./catalog-client";
import type { CountryProfileBundle, IntakeOption } from "./catalog.types";

type Draft = Record<string, string | boolean | string[]>;
const text = (value: unknown) =>
  value === null || value === undefined ? "" : String(value);
const input =
  "mt-1 w-full rounded-lg border border-[#D9E0EA] px-3 py-2 text-sm outline-none focus:border-[#1657CF]";

export function CountryProfilesEditor({ countryId }: { countryId: string }) {
  const [bundle, setBundle] = useState<CountryProfileBundle | null>(null);
  const [intakes, setIntakes] = useState<IntakeOption[]>([]);
  const [cost, setCost] = useState<Draft>({});
  const [work, setWork] = useState<Draft>({});
  const [language, setLanguage] = useState<Draft>({});
  const [statistics, setStatistics] = useState<Draft>({
    sourceMode: "DERIVED",
  });
  const [selectedIntakes, setSelectedIntakes] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void Promise.all([getCountryProfiles(countryId), listIntakeOptions()])
      .then(([profiles, options]) => {
        setBundle(profiles.data);
        setIntakes(options.data);
        setCost((profiles.data.cost ?? {}) as Draft);
        setWork((profiles.data.work ?? {}) as Draft);
        setLanguage((profiles.data.language ?? {}) as Draft);
        setStatistics(
          (profiles.data.statistics ?? { sourceMode: "DERIVED" }) as Draft,
        );
        setSelectedIntakes(
          (profiles.data.intakes ?? []).map((row) =>
            String(row.intakeId ?? row.id),
          ),
        );
      })
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to load Country profiles",
        ),
      );
  }, [countryId]);

  async function save(
    profile: "cost" | "work" | "language" | "statistics" | "intakes",
  ) {
    setMessage("");
    setError("");
    try {
      const current =
        profile === "cost"
          ? cost
          : profile === "work"
            ? work
            : profile === "language"
              ? language
              : statistics;
      const data =
        profile === "intakes"
          ? {
              expectedUpdatedAt: bundle?.country.updatedAt,
              intakes: selectedIntakes.map((intakeId, displayOrder) => ({
                intakeId,
                isMajor: true,
                displayOrder,
              })),
            }
          : {
              ...current,
              expectedUpdatedAt: current.updatedAt as string | undefined,
            };
      await putCountryProfile(
        countryId,
        profile,
        data as Record<string, unknown>,
      );
      const refreshed = await getCountryProfiles(countryId);
      setBundle(refreshed.data);
      setMessage(
        `${profile === "intakes" ? "Intakes" : profile[0].toUpperCase() + profile.slice(1)} saved.`,
      );
    } catch (cause: unknown) {
      setError(
        cause instanceof Error ? cause.message : "Unable to save profile",
      );
    }
  }
  if (!bundle)
    return (
      <section className="mt-8 rounded-2xl border border-[#E8ECF3] bg-white p-6">
        {error || "Loading Country profiles…"}
      </section>
    );
  return (
    <section
      className="mt-8 space-y-6"
      aria-labelledby="country-profiles-heading"
    >
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#828B9B]">
          Country profiles
        </p>
        <h2
          id="country-profiles-heading"
          className="mt-2 text-2xl font-semibold"
        >
          Costs, visa, language, statistics and intakes
        </h2>
        <p className="mt-2 text-sm text-[#667085]">
          Manual values are country-owned; verified data is public while derived
          catalogue data stays the fallback.
        </p>
      </div>
      {message ? (
        <p
          role="status"
          className="rounded-xl bg-[#E9F8F0] p-3 text-sm text-[#18794E]"
        >
          {message}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="rounded-xl bg-[#FFF7F7] p-3 text-sm text-[#B42318]"
        >
          {error}
        </p>
      ) : null}
      <ProfileCard title="Cost">
        <Fields
          draft={cost}
          set={setCost}
          fields={[
            "currencyCode:Tuition currency",
            "tuitionMin:Tuition minimum",
            "tuitionMax:Tuition maximum",
            "livingCostMin:Living minimum",
            "livingCostMax:Living maximum",
            "applicationFeeMin:Application fee",
            "applicationFeeMax:Application fee maximum",
            "sourceReference:Source reference",
            "verifiedAt:Verified at",
          ]}
        />
        <Save onClick={() => void save("cost")} />
      </ProfileCard>
      <ProfileCard title="Visa and work">
        <Fields
          draft={work}
          set={setWork}
          fields={[
            "visaType:Visa type",
            "visaFee:Visa fee",
            "visaFeeCurrencyCode:Visa fee currency",
            "visaProcessingTime:Visa processing",
            "postStudyWorkMinMonths:Post-study work minimum months",
            "postStudyWorkMaxMonths:Post-study work maximum months",
            "partTimeHoursPerWeek:Work hours per week",
            "visaInformation:Visa process",
          ]}
        />
        <Save onClick={() => void save("work")} />
      </ProfileCard>
      <ProfileCard title="Language">
        <Fields
          draft={language}
          set={setLanguage}
          fields={[
            "ieltsMinScore:IELTS minimum",
            "pteMinScore:PTE minimum",
            "toeflMinScore:TOEFL minimum",
            "duolingoMinScore:Duolingo minimum",
            "sourceReference:Source reference",
            "verifiedAt:Verified at",
          ]}
        />
        <Save onClick={() => void save("language")} />
      </ProfileCard>
      <ProfileCard title="Statistics">
        <label className="text-sm font-semibold">
          Source mode
          <select
            className={input}
            value={text(statistics.sourceMode || "DERIVED")}
            onChange={(event) =>
              setStatistics((current) => ({
                ...current,
                sourceMode: event.target.value,
              }))
            }
          >
            <option>DERIVED</option>
            <option>MANUAL</option>
            <option>IMPORTED</option>
            <option>OFFICIAL</option>
          </select>
        </label>
        <Fields
          draft={statistics}
          set={setStatistics}
          fields={[
            "universitiesCount:Universities count",
            "internationalStudentsCount:International students",
            "sourceReference:Source reference",
            "verifiedAt:Verified at",
          ]}
        />
        <Save onClick={() => void save("statistics")} />
      </ProfileCard>
      <ProfileCard title="Intakes">
        <div className="grid gap-2 sm:grid-cols-2">
          {intakes.map((row) => (
            <label key={row.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectedIntakes.includes(row.id)}
                onChange={() =>
                  setSelectedIntakes((current) =>
                    current.includes(row.id)
                      ? current.filter((id) => id !== row.id)
                      : [...current, row.id],
                  )
                }
              />
              {row.name}
            </label>
          ))}
        </div>
        <Save onClick={() => void save("intakes")} />
      </ProfileCard>
    </section>
  );
}
function ProfileCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#E8ECF3] bg-white p-6">
      <h3 className="text-lg font-semibold">{title}</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
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
  fields: string[];
}) {
  return (
    <>
      {fields.map((field) => {
        const [key, label] = field.split(":");
        return (
          <label key={key} className="text-sm font-semibold">
            {label}
            <input
              className={input}
              value={text(draft[key])}
              onChange={(event) =>
                set((current) => ({ ...current, [key]: event.target.value }))
              }
            />
          </label>
        );
      })}
    </>
  );
}
function Save({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="self-end rounded-xl bg-[#1657CF] px-4 py-2 text-sm font-semibold text-white"
    >
      Save section
    </button>
  );
}
