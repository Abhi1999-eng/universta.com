"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  getCountryProfiles,
  putCountryProfile,
} from "./catalog-client";
import type { CountryProfileBundle } from "./catalog.types";
import { RichTextEditor } from "@/features/shared/RichTextEditor";
import { variablesForContext } from "@/features/shared/variable-autocomplete";
import type { EditorEntityContext } from "@/features/shared/useEntityAutocomplete";

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
/* BUDGET_BANDS lived here for the Budget band selector, which has left the cost
 * card. The column, the API field and the public Budget filter are all
 * unchanged -- only the editor control is gone. */
/** Mirrors PATHWAY_STRENGTHS in the API's profile.constants.ts. */
const PATHWAY_STRENGTHS = ["NOT_PUBLISHED", "LIMITED", "MODERATE", "STRONG"];
const LANGUAGE_REQUIREMENTS = [
  "REQUIRED",
  "OPTIONAL",
  "NOT_REQUIRED",
  "VARIES",
];
const SOURCE_MODES = ["DERIVED", "MANUAL", "IMPORTED", "OFFICIAL"];

type FieldSpec = {
  key: string;
  label: string;
  kind?:
    | "text"
    | "number"
    | "date"
    | "checkbox"
    | "textarea"
    | "select"
    | "richtext"
    | "derived";
  options?: string[];
  /** For `derived`: the value this field takes from elsewhere on the record. */
  derived?: string;
  hint?: string;
  wide?: boolean;
  min?: number;
  max?: number;
  step?: number;
};

/** Every select on these cards offers a "Not set" option whose value is the
 * empty string, which the API validates against a fixed list that has no
 * member for "" -- so unsetting one was a 400 naming no field.
 *
 * What "not set" means is per column, and the schema is the authority. A
 * nullable column clears to null. A NOT NULL column has a default that already
 * means "nothing is being asserted here" -- `VARIES` for a test requirement,
 * `NOT_PUBLISHED` for the visa band -- so it goes back to that. Sending null to
 * one of those is a 500, not a clear. Text and number fields are untouched:
 * they clear correctly on their own.
 */
const CHOICE_RESET: Record<string, string | null> = {
  // Nullable columns.
  budgetBand: null,
  immigrationPathwayStrength: null,
  // NOT NULL columns, reset to the default that means "nothing asserted".
  ieltsRequirement: 'VARIES',
  pteRequirement: 'VARIES',
  toeflRequirement: 'VARIES',
  duolingoRequirement: 'VARIES',
  visaSuccessBand: 'NOT_PUBLISHED',
  tuitionPeriod: 'PER_YEAR',
  livingCostPeriod: 'PER_MONTH',
};

function clearedChoices(draft: Draft): Draft {
  const next: Draft = { ...draft };
  for (const [field, reset] of Object.entries(CHOICE_RESET))
    if (next[field] === '') next[field] = reset;
  return next;
}

/** What the parent form calls on every save, so a card the author filled in is
 * written by the button that says it saves the country -- whether or not that
 * save is the one creating the row. */
export type CountryProfilesHandle = {
  persistDrafts: (countryId: string) => Promise<void>;
};

/**
 * Cost, visa, English and statistics.
 *
 * These are child records of a Country and each one saves on its own, so the
 * whole editor used to be replaced by "Save this Country first" until the row
 * existed -- which meant an author creating a country could not even see what
 * they would eventually be asked for. The cards render from the start now and
 * hold their values locally; the parent flushes them through `persistDrafts`
 * as soon as it has an id, and nothing fake is written in the meantime.
 */
export const CountryProfilesEditor = forwardRef<
  CountryProfilesHandle,
  {
    countryId?: string;
    currencyCode?: string;
    onDirty?: () => void;
    /* Handed straight to the rich-text fields on these cards, so a profile note
     * gets the same inline `%` autocomplete as the fields on the country form
     * above it -- one editor, one behaviour, everywhere. */
    entityContext?: EditorEntityContext;
  }
>(function CountryProfilesEditor(
  { countryId, currencyCode, onDirty, entityContext },
  ref,
) {
  const [bundle, setBundle] = useState<CountryProfileBundle | null>(null);
  const [cost, setCost] = useState<Draft>({});
  const [work, setWork] = useState<Draft>({});
  const [language, setLanguage] = useState<Draft>({});
  const [statistics, setStatistics] = useState<Draft>({ sourceMode: "DERIVED" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState("");
  /**
   * Which cards the author has changed since they were last read from the
   * server.
   *
   * This is what the country's own Save writes. Filling a card and pressing
   * the button at the end of the form used to write the country row and drop
   * the card, because the flush below only ran on the save that created the
   * country -- so the values were gone on reopen with nothing having reported
   * a failure. Tracking the edits rather than the contents is what lets that
   * save write a card the author touched without rewriting three they did not.
   *
   * It is a ref because the save path reads it inside a callback the parent
   * holds, where a stale render's copy would flush the wrong set.
   */
  const touched = useRef<Set<Section>>(new Set());

  /**
   * Re-seeds every draft from the server payload, except a card the author has
   * changed and not yet saved.
   *
   * This used to take the payload as authoritative for all four cards and
   * empty `touched` with it, on the reasoning that a card which came from the
   * server has no unsaved edit in it. That is true of the read which follows a
   * write, and false of the read which races one.
   *
   * The read fires whenever `countryId` changes, and the first save of a new
   * country changes it: the parent sets the freshly created record before it
   * calls `persistDrafts`, so the read that id change starts can land in
   * between. It did, and it emptied `touched`, and `persistDrafts` then found
   * nothing pending and wrote nothing at all -- silently, behind a "Draft
   * saved." The same read overtakes an author who starts typing on reopen
   * before it returns, wiping what they had typed.
   *
   * So an edited card keeps its values and its edited flag here and takes only
   * the version token the server holds, which is what its next write has to
   * carry. Every other card is seeded exactly as before. The callers that
   * follow a write clear `touched` themselves, for the sections they actually
   * wrote and no others.
   */
  const hydrate = useCallback((data: CountryProfileBundle) => {
    setBundle(data);
    const apply = (
      section: Section,
      set: React.Dispatch<React.SetStateAction<Draft>>,
      incoming: Record<string, unknown> | null,
      blank: Draft,
    ) =>
      set((current) =>
        touched.current.has(section)
          ? { ...current, updatedAt: incoming?.updatedAt }
          : ((incoming ?? blank) as Draft),
      );
    apply("cost", setCost, data.cost, {});
    apply("work", setWork, data.work, {});
    apply("language", setLanguage, data.language, {});
    apply("statistics", setStatistics, data.statistics, {
      sourceMode: "DERIVED",
    });
  }, []);

  /** One place that records an edit, so every control on every card reports it
   * the same way and the parent form's unsaved-changes guard covers profiles
   * as well as the fields it owns directly. */
  const edit = useCallback(
    (section: Section, apply: () => void) => {
      touched.current.add(section);
      onDirty?.();
      apply();
    },
    [onDirty],
  );

  /** The setter each card hands to its fields: identical to the raw one except
   * that it marks the card as edited first. Built once so a card is not handed
   * a new function identity on every render. */
  const editing = useMemo(() => {
    const raw: Record<Section, React.Dispatch<React.SetStateAction<Draft>>> = {
      cost: setCost,
      work: setWork,
      language: setLanguage,
      statistics: setStatistics,
    };
    const wrapped = {} as Record<
      Section,
      React.Dispatch<React.SetStateAction<Draft>>
    >;
    for (const section of Object.keys(raw) as Section[])
      wrapped[section] = (value) => edit(section, () => raw[section](value));
    return (section: Section) => wrapped[section];
  }, [edit]);

  useEffect(() => {
    /* A country's profiles only exist once the country does. */
    void (countryId ? getCountryProfiles(countryId) : Promise.resolve(null))
      .then((profiles) => {
        if (profiles) hydrate(profiles.data);
      })
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to load country profiles",
        ),
      );
  }, [countryId, hydrate]);

  /** What a card would send. Shared by the per-card Save button and by the
   * flush the parent runs after it first creates the Country, so a draft typed
   * before there was an id is written exactly as one typed after it. */
  const payloadFor = useCallback(
    (section: Section): Record<string, unknown> => {
      const drafts: Record<Section, Draft> = { cost, work, language, statistics };
      return {
        ...clearedChoices(drafts[section]),
        expectedUpdatedAt: drafts[section].updatedAt as string | undefined,
      };
    },
    [cost, language, statistics, work],
  );

  /* What the country's own Save writes, on every save rather than only the one
   * that created the row.
   *
   * Cards the author did not touch are skipped, so an untouched Cost card is
   * neither written as an empty row on a new country nor rewritten on an
   * existing one. Cards they did touch still carry the version token they were
   * read with, so a card another session has changed in the meantime is
   * refused as stale rather than overwritten -- which is the protection the
   * create-only guard used to provide, kept without the data loss it caused.
   *
   * The re-read at the end is what leaves every card holding the token the API
   * just wrote, so the next save is not rejected as stale.
   */
  useImperativeHandle(
    ref,
    () => ({
      persistDrafts: async (newCountryId: string) => {
        const pending = (["cost", "work", "language", "statistics"] as const).filter(
          (section) => touched.current.has(section),
        );
        if (!pending.length) return;
        /* Each card is written on its own terms.
         *
         * This was one `await` inside a plain loop, so the first card the API
         * refused threw out of the whole flush and the cards behind it were
         * never even attempted. That is what happened on the country this was
         * reported against: the cost write came back 400 and work, English and
         * statistics -- all of them valid -- were never sent, so three cards
         * the author had filled in were lost to one they had not. Whatever the
         * server objects to, it objects to one card's contents, and the other
         * three are nothing to do with it. */
        const written: Section[] = [];
        const refused: string[] = [];
        for (const section of pending) {
          try {
            await putCountryProfile(newCountryId, section, payloadFor(section));
            written.push(section);
          } catch (cause: unknown) {
            refused.push(
              `${LABELS[section]}: ${
                cause instanceof Error ? cause.message : "could not be saved"
              }`,
            );
          }
        }
        const latest = (await getCountryProfiles(newCountryId)).data;
        /* Only what this flush actually wrote stops counting as edited. A card
         * the author changed while the writes were in flight keeps its edit and
         * goes out with the next save instead of being dropped by this one --
         * and so does a card the server refused, so correcting it and saving
         * again sends it rather than silently dropping it. */
        for (const section of written) touched.current.delete(section);
        hydrate(latest);
        /* Reported as a failure of the country save, because it is one: the
         * button said it would save these cards. Naming the card and the
         * server's own reason is the difference between an author fixing one
         * field and an author retyping four sections into a form that keeps
         * emptying itself. */
        if (refused.length)
          throw new Error(
            `Saved the country, but ${refused.length === 1 ? "one profile card was" : `${refused.length} profile cards were`} not saved — ${refused.join(" ")}`,
          );
      },
    }),
    [hydrate, payloadFor],
  );

  async function save(section: Section) {
    if (!countryId) return;
    setMessage("");
    setError("");
    setSaving(section);
    try {
      if (section === "language") {
        /* A score only means something when the test is actually asked for.
         * The API refuses that pair, and its answer used to arrive as a bare
         * "Catalog request failed" naming neither the test nor the reason --
         * so name both here, before anything is sent. */
        const tests: Array<[string, string, string, number]> = [
          ["ieltsRequirement", "ieltsMinScore", "IELTS", 9],
          ["pteRequirement", "pteMinScore", "PTE", 90],
          ["toeflRequirement", "toeflMinScore", "TOEFL", 120],
          ["duolingoRequirement", "duolingoMinScore", "Duolingo", 160],
        ];
        for (const [requirementKey, scoreKey, label, max] of tests) {
          const value = text(language[scoreKey]).trim();
          if (!value) continue;
          const parsed = Number(value);
          if (!Number.isFinite(parsed) || parsed < 0 || parsed > max) {
            setError(`${label} score must be between 0 and ${max}.`);
            return;
          }
          /* Mirror the API rule exactly: it refuses a score only when the
           * requirement explicitly says the test is not asked for. An unset
           * requirement is left to the API, so this guard never blocks a save
           * the server would have accepted. */
          const requirement = text(language[requirementKey]).trim();
          if (requirement === "NOT_REQUIRED" || requirement === "VARIES") {
            setError(
              `Set the ${label} requirement to Required or Optional before entering a ${label} score.`,
            );
            return;
          }
        }
      }
      await putCountryProfile(countryId, section, payloadFor(section));
      // Re-read rather than trusting local state: this is what keeps a second
      // edit working, and it surfaces any server-side normalisation.
      const refreshed = await getCountryProfiles(countryId);
      touched.current.delete(section);
      hydrate(refreshed.data);
      setMessage(`${LABELS[section]} saved.`);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Unable to save");
      /* A rejected save can still leave this card holding a version token the
       * server has moved past, and every later save then fails as stale until
       * the page is reloaded -- including the corrected one. Refresh just the
       * tokens, never the values, so the operator keeps the edit they are in
       * the middle of fixing. Genuine concurrency is unaffected: the token
       * still comes from the server, so another session's write is still
       * refused. */
      await getCountryProfiles(countryId)
        .then((latest) => {
          const version = (row: Draft, next: unknown) =>
            next && typeof next === "object"
              ? { ...row, updatedAt: (next as Draft).updatedAt }
              : row;
          setBundle(latest.data);
          setCost((row) => version(row, latest.data.cost));
          setWork((row) => version(row, latest.data.work));
          setLanguage((row) => version(row, latest.data.language));
          setStatistics((row) => version(row, latest.data.statistics));
        })
        .catch(() => undefined);
    } finally {
      setSaving("");
    }
  }

  /* Only an existing country has profiles to wait for. A new one has nothing
   * to load, so it renders its cards straight away. */
  if (countryId && !bundle)
    return (
      <section className="mt-8 rounded-2xl border border-[#E8ECF3] bg-white p-6 text-sm text-[#667085]">
        {error || "Loading country profiles…"}
      </section>
    );

  const derivedCount = bundle?.derivedUniversitiesCount ?? null;
  /* Choosing anything other than "count them automatically" is the author
   * taking ownership of the number, and that is now the whole test. It used to
   * also require a source reference and a verification date, which this card
   * no longer asks for -- leaving that condition in place would have meant a
   * number the author typed and saved was silently ignored on the public page
   * with no control left anywhere to satisfy it. */
  const usingManualCount = text(statistics.sourceMode) !== "DERIVED";

  return (
    <section className="mt-8 min-w-0 space-y-6" aria-labelledby="country-profiles-heading">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#828B9B]">
          Country profiles
        </p>
        <h2 id="country-profiles-heading" className="mt-2 text-2xl font-semibold">
          Cost, visa, English and statistics
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
        unsaved={!countryId}
      >
        <Fields
          draft={cost}
          set={editing("cost")}
          entityContext={entityContext}
          /* Currency code and symbol are the Country's, not the cost card's --
           * they were duplicated here and could disagree with the identity
           * section. Tuition period and budget band are gone from the editor
           * too; both columns and their API fields remain, so the public Budget
           * filter and any importer that writes them keep working. */
          fields={[
            { key: "tuitionMin", label: "Tuition minimum", kind: "number" },
            { key: "tuitionMax", label: "Tuition maximum", kind: "number" },
            { key: "livingCostMin", label: "Living cost minimum", kind: "number" },
            { key: "livingCostMax", label: "Living cost maximum", kind: "number" },
            { key: "livingCostPeriod", label: "Living cost period", kind: "select", options: COST_PERIODS },
            { key: "applicationFeeMin", label: "Application fee minimum", kind: "number" },
            { key: "applicationFeeMax", label: "Application fee maximum", kind: "number" },
            { key: "tuitionNotes", label: "Tuition notes", kind: "richtext", wide: true },
            { key: "livingCostNotes", label: "Living cost notes", kind: "richtext", wide: true },
            { key: "disclaimer", label: "Cost disclaimer", kind: "richtext", wide: true },
          ]}
        />
      </ProfileCard>

      <ProfileCard
        title="Work and visa"
        description="Visa route, cost and processing time, plus what students may work during and after the course."
        onSave={() => void save("work")}
        busy={saving === "work"}
        unsaved={!countryId}
      >
        <Fields
          draft={work}
          set={editing("work")}
          entityContext={entityContext}
          fields={[
            { key: "visaType", label: "Visa type" },
            { key: "visaProcessingTime", label: "Visa processing time" },
            { key: "visaFee", label: "Visa fee", kind: "number" },
            /* Not typed here. A visa fee is quoted in the Country's own
             * currency, and a second copy on this card could only disagree
             * with it -- the API derives the stored value from the Country as
             * well, so this shows what will be saved rather than asking for
             * it again. */
            {
              key: "visaFeeCurrencyCode",
              label: "Visa fee currency",
              kind: "derived",
              derived: currencyCode || "",
              hint: currencyCode
                ? "Inherited from the country currency"
                : "Set the country currency in Identity & listing",
            },
            { key: "partTimeAllowed", label: "Part-time work allowed during study", kind: "checkbox" },
            { key: "partTimeHoursPerWeek", label: "Work hours per week", kind: "number" },
            { key: "partTimeHoursDuringBreaks", label: "Work hours during breaks", kind: "number" },
            { key: "partTimeSummary", label: "Part-time work summary", kind: "richtext", wide: true },
            { key: "postStudyWorkAvailable", label: "Post-study work available", kind: "checkbox" },
            { key: "postStudyWorkMinMonths", label: "Post-study work minimum months", kind: "number" },
            { key: "postStudyWorkMaxMonths", label: "Post-study work maximum months", kind: "number" },
            { key: "postStudyWorkSummary", label: "Post-study work summary", kind: "richtext", wide: true },
            { key: "immigrationPathwayStrength", label: "Immigration pathway strength", kind: "select", options: PATHWAY_STRENGTHS },
            { key: "immigrationPathwaySummary", label: "Immigration pathway summary", kind: "richtext", wide: true },
            { key: "visaInformation", label: "Visa process", kind: "richtext", wide: true },
            { key: "proofOfFundsSummary", label: "Proof of funds summary", kind: "richtext", wide: true },
            { key: "disclaimer", label: "Work disclaimer", kind: "richtext", wide: true },
          ]}
        />
      </ProfileCard>

      <ProfileCard
        title="English requirements"
        description="Country-level guidance. Individual programmes may still ask for more."
        onSave={() => void save("language")}
        busy={saving === "language"}
        unsaved={!countryId}
      >
        <Fields
          draft={language}
          set={editing("language")}
          entityContext={entityContext}
          fields={[
            { key: "ieltsRequirement", label: "IELTS requirement", kind: "select", options: LANGUAGE_REQUIREMENTS },
            { key: "ieltsMinScore", label: "IELTS minimum score", kind: "number", min: 0, max: 9, step: 0.5 },
            { key: "ieltsNotes", label: "IELTS notes", kind: "richtext", wide: true },
            { key: "pteRequirement", label: "PTE requirement", kind: "select", options: LANGUAGE_REQUIREMENTS },
            { key: "pteMinScore", label: "PTE minimum score", kind: "number" },
            { key: "pteNotes", label: "PTE notes", kind: "richtext", wide: true },
            { key: "toeflRequirement", label: "TOEFL requirement", kind: "select", options: LANGUAGE_REQUIREMENTS },
            { key: "toeflMinScore", label: "TOEFL minimum score", kind: "number" },
            { key: "toeflNotes", label: "TOEFL notes", kind: "richtext", wide: true },
            { key: "duolingoRequirement", label: "Duolingo requirement", kind: "select", options: LANGUAGE_REQUIREMENTS },
            { key: "duolingoMinScore", label: "Duolingo minimum score", kind: "number" },
            { key: "duolingoNotes", label: "Duolingo notes", kind: "richtext", wide: true },
            { key: "languageWaiverAvailable", label: "Language waiver available", kind: "checkbox" },
            { key: "waiverNotes", label: "Waiver notes", kind: "richtext", wide: true },
            { key: "generalNotes", label: "General notes", kind: "richtext", wide: true },
            { key: "disclaimer", label: "Language disclaimer", kind: "richtext", wide: true },
          ]}
        />
      </ProfileCard>

      <ProfileCard
        title="Statistics"
        description="Counts shown on the public country page."
        onSave={() => void save("statistics")}
        busy={saving === "statistics"}
        unsaved={!countryId}
      >
        <label className="text-sm font-semibold">
          Where the university count comes from
          <select
            className={inputClass}
            value={text(statistics.sourceMode) || "DERIVED"}
            onChange={(event) =>
              editing("statistics")((current) => ({
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
          set={editing("statistics")}
          entityContext={entityContext}
          fields={[
            { key: "universitiesCount", label: "Universities count", kind: "number" },
            { key: "internationalStudentsCount", label: "International students", kind: "number" },
          ]}
        />
        <p className="sm:col-span-2 rounded-xl bg-[#F8FAFC] p-3 text-sm leading-6 text-[#475467]">
          {usingManualCount ? (
            <>
              The universities count above is shown on the country page instead
              of the live count{derivedCount === null ? "" : ` of ${derivedCount}`}.
            </>
          ) : (
            <>
              The country page counts published universities itself
              {derivedCount === null ? "" : ` — currently ${derivedCount}`}, so a
              universities count typed above is stored but not shown.
            </>
          )}{" "}
          International students is nobody&apos;s to count: it appears in the
          country page&apos;s numbers band exactly as typed, whichever setting is
          chosen above.
        </p>
      </ProfileCard>

    </section>
  );
});

/* `populated` used to decide which cards the first save flushed, by inspecting
 * their contents. It has been replaced by the edit tracking above: what makes a
 * card worth writing is that the author changed it, which is also true of a
 * card on an existing country whose stored contents already look populated. */

const LABELS: Record<Section, string> = {
  cost: "Cost and budget",
  work: "Work and visa",
  language: "English requirements",
  statistics: "Statistics",
};

function ProfileCard({
  title,
  description,
  children,
  onSave,
  busy,
  full,
  /* A card on a country that has not been created yet is fully editable; it
   * is only the per-card Save that has nowhere to write. The button says so
   * rather than disappearing, so the author can see the card is real and that
   * the first country save is what carries it. */
  unsaved,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  onSave: () => void;
  busy: boolean;
  full?: boolean;
  unsaved?: boolean;
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-[#E8ECF3] bg-white p-4 sm:p-6">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-[#667085]">
        {description}
      </p>
      <div className={`mt-5 grid gap-4 ${full ? "" : "sm:grid-cols-2"}`}>
        {children}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={busy || unsaved}
          className="rounded-xl bg-[#1657CF] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Saving…" : `Save ${title.toLowerCase()}`}
        </button>
        {unsaved ? (
          <p className="text-xs text-[#667085]">
            Saved with the country the first time you use Save draft or
            Publish.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function Fields({
  draft,
  set,
  fields,
  entityContext,
}: {
  draft: Draft;
  set: React.Dispatch<React.SetStateAction<Draft>>;
  fields: FieldSpec[];
  entityContext?: EditorEntityContext;
}) {
  return (
    <>
      {fields.map((field) => {
        const patch = (value: unknown) =>
          set((current) => ({ ...current, [field.key]: value }));
        const span = field.wide ? "sm:col-span-2" : "";
        if (field.kind === "richtext")
          return (
            <div key={field.key} className={span}>
              <RichTextEditor
                label={field.label}
                value={text(draft[field.key])}
                onChange={patch}
                allowedVariables={variablesForContext("country")}
                entityContext={entityContext}
                enableImages={false}
                minHeight="min-h-28"
              />
              {field.hint ? (
                <p className="mt-1 text-xs text-[#667085]">{field.hint}</p>
              ) : null}
            </div>
          );
        if (field.kind === "derived")
          return (
            <label
              key={field.key}
              className={`block text-sm font-semibold ${span}`}
            >
              {field.label}
              <input
                className={`${inputClass} bg-[#F8FAFC] text-[#475467]`}
                value={field.derived || "—"}
                readOnly
                aria-readonly="true"
              />
              {field.hint ? (
                <p className="mt-1 text-xs text-[#667085]">{field.hint}</p>
              ) : null}
            </label>
          );
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
                min={field.min}
                max={field.max}
                step={field.step}
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
