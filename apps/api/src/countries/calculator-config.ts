/**
 * The budget calculator's configuration, validated on the way in and on the way
 * out.
 *
 * It is stored as one JSON document because it is always read and written
 * whole, is never queried across countries, and has no relationships of its
 * own. That is a reason to keep it simple, not a reason to skip checking it:
 * nothing reaches the public page without passing through here, so a
 * malformed or hand-edited document yields no calculator rather than a broken
 * one or a wrong number.
 *
 * The Cost Profile stays canonical for what a country actually costs. This only
 * describes how the choices a student makes vary that figure.
 */

export type CalculatorOption = {
  value: string;
  label: string;
  /** Multiplies living costs. Absent means no effect. */
  mult?: number;
  /** Adds a tuition band. Absent means this option carries no tuition. */
  tuitionMin?: number;
  tuitionMax?: number;
  note?: string;
};

export type CalculatorFactor = {
  id: string;
  label: string;
  options: CalculatorOption[];
};

export type CalculatorConfig = {
  base: {
    /** Monthly living cost floor and ceiling before any factor applies. */
    livingMin: number;
    livingMax: number;
    /** Monthly health cover. */
    insurance: number;
    /** A per-semester administrative fee, charged twice a year. */
    semesterFee: number;
  };
  factors: CalculatorFactor[];
};

const MAX_FACTORS = 8;
const MAX_OPTIONS = 12;
const MAX_MONEY = 1_000_000;

function finiteNumber(
  value: unknown,
  { min = 0, max = MAX_MONEY } = {},
): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value < min || value > max) return null;
  return value;
}

function shortString(value: unknown, limit = 80): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > limit) return null;
  /* No markup reaches the page from here: these are rendered as text, and a
   * label is a label. */
  if (/[<>]/.test(trimmed)) return null;
  return trimmed;
}

/**
 * Returns the configuration only if the whole document is sound. A partial
 * document is rejected rather than repaired, because a calculator missing a
 * factor would quietly produce a different number from the one an editor set
 * up.
 */
export function parseCalculatorConfig(value: unknown): CalculatorConfig | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;

  const rawBase = input.base;
  if (!rawBase || typeof rawBase !== 'object' || Array.isArray(rawBase))
    return null;
  const base = rawBase as Record<string, unknown>;
  const livingMin = finiteNumber(base.livingMin);
  const livingMax = finiteNumber(base.livingMax);
  const insurance = finiteNumber(base.insurance);
  const semesterFee = finiteNumber(base.semesterFee);
  if (
    livingMin === null ||
    livingMax === null ||
    insurance === null ||
    semesterFee === null
  )
    return null;
  if (livingMax < livingMin) return null;

  if (!Array.isArray(input.factors) || input.factors.length === 0) return null;
  if (input.factors.length > MAX_FACTORS) return null;

  const factors: CalculatorFactor[] = [];
  const seenFactors = new Set<string>();
  for (const entry of input.factors) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry))
      return null;
    const factor = entry as Record<string, unknown>;
    const id = shortString(factor.id, 40);
    const label = shortString(factor.label);
    if (!id || !label || seenFactors.has(id)) return null;
    seenFactors.add(id);

    if (!Array.isArray(factor.options) || factor.options.length === 0)
      return null;
    if (factor.options.length > MAX_OPTIONS) return null;

    const options: CalculatorOption[] = [];
    const seenOptions = new Set<string>();
    for (const rawOption of factor.options) {
      if (
        !rawOption ||
        typeof rawOption !== 'object' ||
        Array.isArray(rawOption)
      )
        return null;
      const option = rawOption as Record<string, unknown>;
      const optionValue = shortString(option.value, 40);
      const optionLabel = shortString(option.label);
      if (!optionValue || !optionLabel || seenOptions.has(optionValue))
        return null;
      seenOptions.add(optionValue);

      const parsed: CalculatorOption = {
        value: optionValue,
        label: optionLabel,
      };
      if (option.mult !== undefined) {
        /* A multiplier outside this range is a typo, not a lifestyle. */
        const mult = finiteNumber(option.mult, { min: 0.1, max: 5 });
        if (mult === null) return null;
        parsed.mult = mult;
      }
      if (option.tuitionMin !== undefined) {
        const min = finiteNumber(option.tuitionMin);
        if (min === null) return null;
        parsed.tuitionMin = min;
      }
      if (option.tuitionMax !== undefined) {
        const max = finiteNumber(option.tuitionMax);
        if (max === null) return null;
        parsed.tuitionMax = max;
      }
      if (
        parsed.tuitionMin !== undefined &&
        parsed.tuitionMax !== undefined &&
        parsed.tuitionMax < parsed.tuitionMin
      )
        return null;
      const note =
        option.note === undefined ? null : shortString(option.note, 120);
      if (option.note !== undefined && note === null) return null;
      if (note) parsed.note = note;
      options.push(parsed);
    }
    factors.push({ id, label, options });
  }

  return { base: { livingMin, livingMax, insurance, semesterFee }, factors };
}
