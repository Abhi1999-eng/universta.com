"use client";

import { useMemo, useState } from "react";
import { slugFromText } from "@/lib/slug";

/**
 * The budget calculator, built by filling a form rather than by typing JSON.
 *
 * What the country page needs is a small document: a monthly base, and a list
 * of questions whose answers move that base. It used to be asked for as raw
 * JSON in a textarea, which is a developer's shape for a developer's reader --
 * the person who fills this form writes course copy, not object literals, and
 * a stray comma cost them the whole calculator.
 *
 * The document is still what the parent stores and what the API validates, so
 * this changes how it is authored and nothing about what is saved. The ids
 * inside it are derived from the labels and never shown: nobody needs to
 * invent a stable key for "Where will you live?".
 *
 * A document this form cannot represent -- one written by hand or by an
 * importer, carrying a field the form does not offer -- is never rewritten
 * into something smaller. The raw editor is shown for that record instead, so
 * the worst case is that an author edits it the old way rather than silently
 * losing half of it.
 */

type OptionDraft = {
  /** Kept when it came from a stored document, so ids do not churn on save. */
  value?: string;
  label: string;
  mult: string;
  tuitionMin: string;
  tuitionMax: string;
  note: string;
};

type FactorDraft = {
  id?: string;
  label: string;
  options: OptionDraft[];
};

type Draft = {
  livingMin: string;
  livingMax: string;
  insurance: string;
  semesterFee: string;
  factors: FactorDraft[];
};

const blankOption = (): OptionDraft => ({
  label: "",
  mult: "",
  tuitionMin: "",
  tuitionMax: "",
  note: "",
});

const blankFactor = (): FactorDraft => ({ label: "", options: [blankOption()] });

const emptyDraft = (): Draft => ({
  livingMin: "",
  livingMax: "",
  insurance: "",
  semesterFee: "",
  factors: [blankFactor()],
});

const num = (value: unknown): string =>
  typeof value === "number" && Number.isFinite(value) ? String(value) : "";

/**
 * Reads a stored document into the form, or returns null when it carries
 * anything this form would drop. Null is what sends the record to the raw
 * editor rather than to a lossy round trip.
 */
function toDraft(json: string): Draft | null {
  const text = json.trim();
  if (!text) return emptyDraft();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const root = parsed as Record<string, unknown>;
  const known = new Set(["base", "factors"]);
  if (Object.keys(root).some((key) => !known.has(key))) return null;

  const base = root.base;
  if (!base || typeof base !== "object" || Array.isArray(base)) return null;
  const baseRecord = base as Record<string, unknown>;
  const baseKeys = new Set(["livingMin", "livingMax", "insurance", "semesterFee"]);
  if (Object.keys(baseRecord).some((key) => !baseKeys.has(key))) return null;

  if (!Array.isArray(root.factors)) return null;
  const factors: FactorDraft[] = [];
  for (const entry of root.factors) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
    const factor = entry as Record<string, unknown>;
    const factorKeys = new Set(["id", "label", "options"]);
    if (Object.keys(factor).some((key) => !factorKeys.has(key))) return null;
    if (typeof factor.label !== "string" || !Array.isArray(factor.options)) return null;

    const options: OptionDraft[] = [];
    for (const rawOption of factor.options) {
      if (!rawOption || typeof rawOption !== "object" || Array.isArray(rawOption))
        return null;
      const option = rawOption as Record<string, unknown>;
      const optionKeys = new Set([
        "value",
        "label",
        "mult",
        "tuitionMin",
        "tuitionMax",
        "note",
      ]);
      if (Object.keys(option).some((key) => !optionKeys.has(key))) return null;
      if (typeof option.label !== "string") return null;
      options.push({
        value: typeof option.value === "string" ? option.value : undefined,
        label: option.label,
        mult: num(option.mult),
        tuitionMin: num(option.tuitionMin),
        tuitionMax: num(option.tuitionMax),
        note: typeof option.note === "string" ? option.note : "",
      });
    }
    factors.push({
      id: typeof factor.id === "string" ? factor.id : undefined,
      label: factor.label,
      options: options.length ? options : [blankOption()],
    });
  }

  return {
    livingMin: num(baseRecord.livingMin),
    livingMax: num(baseRecord.livingMax),
    insurance: num(baseRecord.insurance),
    semesterFee: num(baseRecord.semesterFee),
    factors: factors.length ? factors : [blankFactor()],
  };
}

/** True when nothing has been filled in, which means "no calculator". */
function isEmpty(draft: Draft): boolean {
  if (draft.livingMin || draft.livingMax || draft.insurance || draft.semesterFee)
    return false;
  return draft.factors.every(
    (factor) =>
      !factor.label.trim() &&
      factor.options.every(
        (option) =>
          !option.label.trim() &&
          !option.mult &&
          !option.tuitionMin &&
          !option.tuitionMax &&
          !option.note.trim(),
      ),
  );
}

/** Unique within its list, so two answers named the same still both save. */
function uniqueKey(label: string, taken: Set<string>, fallback: string): string {
  const base = slugFromText(label) || fallback;
  let key = base;
  let n = 2;
  while (taken.has(key)) key = `${base}-${n++}`;
  taken.add(key);
  return key;
}

function toJson(draft: Draft): string {
  if (isEmpty(draft)) return "";
  const number = (value: string) => {
    const parsed = Number(value);
    return value.trim() && Number.isFinite(parsed) ? parsed : 0;
  };
  const optional = (value: string) => {
    const parsed = Number(value);
    return value.trim() && Number.isFinite(parsed) ? parsed : undefined;
  };

  const factorKeys = new Set<string>();
  const factors = draft.factors
    .filter((factor) => factor.label.trim() || factor.options.some((o) => o.label.trim()))
    .map((factor, index) => {
      const optionKeys = new Set<string>();
      return {
        id: factor.id ?? uniqueKey(factor.label, factorKeys, `question-${index + 1}`),
        label: factor.label.trim(),
        options: factor.options
          .filter((option) => option.label.trim())
          .map((option, optionIndex) => {
            const mult = optional(option.mult);
            const tuitionMin = optional(option.tuitionMin);
            const tuitionMax = optional(option.tuitionMax);
            const note = option.note.trim();
            return {
              value:
                option.value ??
                uniqueKey(option.label, optionKeys, `answer-${optionIndex + 1}`),
              label: option.label.trim(),
              ...(mult !== undefined ? { mult } : {}),
              ...(tuitionMin !== undefined ? { tuitionMin } : {}),
              ...(tuitionMax !== undefined ? { tuitionMax } : {}),
              ...(note ? { note } : {}),
            };
          }),
      };
    });

  return JSON.stringify(
    {
      base: {
        livingMin: number(draft.livingMin),
        livingMax: number(draft.livingMax),
        insurance: number(draft.insurance),
        semesterFee: number(draft.semesterFee),
      },
      factors,
    },
    null,
    2,
  );
}

/** What is still wrong, in the words of the person filling the form. */
function problems(draft: Draft): string[] {
  if (isEmpty(draft)) return [];
  const found: string[] = [];
  const low = Number(draft.livingMin);
  const high = Number(draft.livingMax);
  if (!draft.livingMin || !draft.livingMax || !draft.insurance || !draft.semesterFee)
    found.push("Fill all four monthly cost boxes, or clear the whole calculator.");
  else if (Number.isFinite(low) && Number.isFinite(high) && high < low)
    found.push("The highest living cost cannot be lower than the lowest.");

  const filled = draft.factors.filter(
    (factor) => factor.label.trim() || factor.options.some((o) => o.label.trim()),
  );
  if (!filled.length) found.push("Add at least one question for students to answer.");

  filled.forEach((factor, index) => {
    const name = factor.label.trim() || `Question ${index + 1}`;
    if (!factor.label.trim()) found.push(`Question ${index + 1} needs a question.`);
    if (!factor.options.some((option) => option.label.trim()))
      found.push(`"${name}" needs at least one answer.`);
    factor.options.forEach((option) => {
      if (!option.label.trim()) return;
      const mult = Number(option.mult);
      if (option.mult && (!Number.isFinite(mult) || mult < 0.1 || mult > 5))
        found.push(
          `"${option.label.trim()}": the living cost change must be between 0.1 and 5.`,
        );
      const min = Number(option.tuitionMin);
      const max = Number(option.tuitionMax);
      if (
        option.tuitionMin &&
        option.tuitionMax &&
        Number.isFinite(min) &&
        Number.isFinite(max) &&
        max < min
      )
        found.push(`"${option.label.trim()}": tuition highest is below tuition lowest.`);
    });
  });
  return found;
}

const inputClass =
  "mt-1 w-full rounded-lg border border-[#D9E0EA] bg-white px-3 py-2 text-sm font-normal outline-none focus:border-[#1657CF]";

function Money({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-xs font-semibold text-[#344054]">
      {label}
      <input
        className={inputClass}
        type="number"
        min={0}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint ? (
        <span className="mt-1 block text-[11px] font-normal text-[#667085]">{hint}</span>
      ) : null}
    </label>
  );
}

export function CalculatorBuilder({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const parsed = useMemo(() => toDraft(value), [value]);
  const [draft, setDraft] = useState<Draft>(() => parsed ?? emptyDraft());
  /* While the form is being filled the draft leads, because half-typed input
     is not a document: "1." and an emptied box both serialise to something
     other than what was typed. The parent's JSON is re-read only when the
     parent genuinely changes it -- a record loading, or a reset -- and never
     when what arrives is this form's own last output coming back. */
  /* `prev` is the JSON the parent last handed down; `mine` is the JSON this
     form last handed up. Both are adjusted while rendering rather than in an
     effect, which would paint the stale draft first and then cascade a second
     render over it.
     
     Two questions have to be answered separately. Did the parent change the
     document at all -- if not there is nothing to read. And is what arrived
     merely this form's own output coming back -- if so, re-reading it would
     overwrite half-typed input, because an emptied box and "1." both
     serialise to something other than what was typed. */
  const [sync, setSync] = useState({ prev: value, mine: value });
  if (value !== sync.prev) {
    const ours = value === sync.mine;
    setSync({ prev: value, mine: sync.mine });
    if (!ours) {
      const next = toDraft(value);
      if (next) setDraft(next);
    }
  }

  const update = (next: Draft) => {
    setDraft(next);
    const json = toJson(next);
    setSync((current) => ({ prev: current.prev, mine: json }));
    onChange(json);
  };

  const setFactor = (index: number, patch: Partial<FactorDraft>) =>
    update({
      ...draft,
      factors: draft.factors.map((factor, i) =>
        i === index ? { ...factor, ...patch } : factor,
      ),
    });

  const setOption = (factorIndex: number, optionIndex: number, patch: Partial<OptionDraft>) =>
    update({
      ...draft,
      factors: draft.factors.map((factor, i) =>
        i === factorIndex
          ? {
              ...factor,
              options: factor.options.map((option, j) =>
                j === optionIndex ? { ...option, ...patch } : option,
              ),
            }
          : factor,
      ),
    });

  const issues = problems(draft);

  /* A document written outside this form keeps the editor it was written in,
     rather than being flattened into whatever the form can express. */
  if (!parsed && value.trim())
    return (
      <div className="rounded-xl border border-[#F2C5C5] bg-[#FFF7F7] p-4">
        <p className="text-sm font-semibold text-[#B42318]">
          This calculator was set up outside the form
        </p>
        <p className="mt-1 text-xs text-[#667085]">
          It holds something the simple form cannot show, so it is left exactly as it is.
          Clear the box below to start again with the form, or ask a developer to look at
          it.
        </p>
        <textarea
          className="mt-3 h-40 w-full rounded-xl border border-[#D9E0EA] bg-white px-4 py-3 font-mono text-xs outline-none focus:border-[#1657CF]"
          value={value}
          spellCheck={false}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    );

  return (
    <div className="rounded-xl border border-[#D9E0EA] bg-[#FCFCFD] p-4">
      <p className="text-sm font-semibold text-[#344054]">Budget calculator</p>
      <p className="mt-1 text-xs text-[#667085]">
        Lets a student on the country page work out their own yearly budget. Leave every
        box empty for no calculator.
      </p>

      <p className="mt-4 text-xs font-bold uppercase tracking-[0.08em] text-[#667085]">
        Monthly costs to start from
      </p>
      <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Money
          label="Living cost, lowest"
          hint="Per month"
          value={draft.livingMin}
          onChange={(livingMin) => update({ ...draft, livingMin })}
        />
        <Money
          label="Living cost, highest"
          hint="Per month"
          value={draft.livingMax}
          onChange={(livingMax) => update({ ...draft, livingMax })}
        />
        <Money
          label="Health insurance"
          hint="Per month"
          value={draft.insurance}
          onChange={(insurance) => update({ ...draft, insurance })}
        />
        <Money
          label="Semester fee"
          hint="Charged twice a year"
          value={draft.semesterFee}
          onChange={(semesterFee) => update({ ...draft, semesterFee })}
        />
      </div>

      <p className="mt-6 text-xs font-bold uppercase tracking-[0.08em] text-[#667085]">
        Questions the student answers
      </p>
      <p className="mt-1 text-xs text-[#667085]">
        Each answer can raise or lower the living cost, and can add tuition.
      </p>

      <div className="mt-3 space-y-3">
        {draft.factors.map((factor, factorIndex) => (
          <div
            key={factorIndex}
            className="rounded-xl border border-[#E4E7EC] bg-white p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <label className="block flex-1 text-xs font-semibold text-[#344054]">
                Question {factorIndex + 1}
                <input
                  className={inputClass}
                  value={factor.label}
                  placeholder="Where will you live?"
                  onChange={(event) =>
                    setFactor(factorIndex, { label: event.target.value })
                  }
                />
              </label>
              {draft.factors.length > 1 ? (
                <button
                  type="button"
                  className="mt-5 text-xs font-semibold text-[#B42318]"
                  onClick={() =>
                    update({
                      ...draft,
                      factors: draft.factors.filter((_, i) => i !== factorIndex),
                    })
                  }
                >
                  Remove question
                </button>
              ) : null}
            </div>

            <div className="mt-3 space-y-3">
              {factor.options.map((option, optionIndex) => (
                <div
                  key={optionIndex}
                  className="rounded-lg border border-[#EAECF0] bg-[#FCFCFD] p-3"
                >
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="block text-xs font-semibold text-[#344054]">
                      Answer {optionIndex + 1}
                      <input
                        className={inputClass}
                        value={option.label}
                        placeholder="In the capital"
                        onChange={(event) =>
                          setOption(factorIndex, optionIndex, {
                            label: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="block text-xs font-semibold text-[#344054]">
                      Living cost changes by
                      <input
                        className={inputClass}
                        type="number"
                        step="0.05"
                        min={0.1}
                        max={5}
                        value={option.mult}
                        placeholder="1"
                        onChange={(event) =>
                          setOption(factorIndex, optionIndex, {
                            mult: event.target.value,
                          })
                        }
                      />
                      <span className="mt-1 block text-[11px] font-normal text-[#667085]">
                        1 = no change, 1.35 = a third dearer, 0.8 = a fifth cheaper
                      </span>
                    </label>
                    <Money
                      label="Tuition it adds, lowest"
                      hint="Per year. Leave empty for none"
                      value={option.tuitionMin}
                      onChange={(tuitionMin) =>
                        setOption(factorIndex, optionIndex, { tuitionMin })
                      }
                    />
                    <Money
                      label="Tuition it adds, highest"
                      hint="Per year. Leave empty for none"
                      value={option.tuitionMax}
                      onChange={(tuitionMax) =>
                        setOption(factorIndex, optionIndex, { tuitionMax })
                      }
                    />
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <label className="block flex-1 text-xs font-semibold text-[#344054]">
                      Note for the student (optional)
                      <input
                        className={inputClass}
                        value={option.note}
                        placeholder="Shown to the student under this answer"
                        onChange={(event) =>
                          setOption(factorIndex, optionIndex, {
                            note: event.target.value,
                          })
                        }
                      />
                    </label>
                    {factor.options.length > 1 ? (
                      <button
                        type="button"
                        className="pb-2 text-xs font-semibold text-[#B42318]"
                        onClick={() =>
                          setFactor(factorIndex, {
                            options: factor.options.filter((_, j) => j !== optionIndex),
                          })
                        }
                      >
                        Remove answer
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="mt-3 rounded-lg border border-[#D9E0EA] px-3 py-1.5 text-xs font-semibold text-[#344054]"
              onClick={() =>
                setFactor(factorIndex, { options: [...factor.options, blankOption()] })
              }
            >
              + Add answer
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="mt-3 rounded-lg border border-[#D9E0EA] px-3 py-1.5 text-xs font-semibold text-[#344054]"
        onClick={() => update({ ...draft, factors: [...draft.factors, blankFactor()] })}
      >
        + Add question
      </button>

      {issues.length ? (
        <ul
          role="alert"
          className="mt-4 list-disc space-y-1 rounded-lg border border-[#F2C5C5] bg-[#FFF7F7] py-3 pl-8 pr-4 text-xs text-[#B42318]"
        >
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
