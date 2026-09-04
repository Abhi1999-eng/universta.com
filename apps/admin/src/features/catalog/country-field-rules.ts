import { canonicalInputError } from "@/features/shared/UnifiedSeoFields";

/**
 * Field rules for the Country editor, mirrored from the API contract in
 * `apps/api/src/countries/dto/country.dto.ts`. The Admin used to hold a
 * handful of these and let the rest travel to the server, which answered with
 * a banner naming no field -- so the operator was told a save failed without
 * being told where. These exist to say the same thing the API would, at the
 * moment the field is left, and are deliberately not stricter than it: a value
 * that passes here must pass there.
 */
export type FieldRule = (value: string) => string | null;

const required = (label: string): FieldRule => (value) =>
  value.trim() ? null : `${label} is required.`;

const maxLength =
  (limit: number, label: string): FieldRule =>
  (value) =>
    value.length <= limit
      ? null
      : `${label} must be ${limit} characters or fewer.`;

/** First failing rule wins, so the operator sees one thing to fix at a time. */
const all =
  (...rules: FieldRule[]): FieldRule =>
  (value) => {
    for (const rule of rules) {
      const error = rule(value);
      if (error) return error;
    }
    return null;
  };

/** Optional fields are only checked once they hold something. */
const whenPresent =
  (rule: FieldRule): FieldRule =>
  (value) =>
    value.trim() ? rule(value) : null;

const integerBetween =
  (min: number, max: number, label: string): FieldRule =>
  (value) => {
    const raw = value.trim();
    if (!raw) return null;
    if (!/^\d+$/.test(raw))
      return `${label} must be a whole number from ${min} to ${max}.`;
    const parsed = Number(raw);
    return parsed >= min && parsed <= max
      ? null
      : `${label} must be a whole number from ${min} to ${max}.`;
  };

/** Keyed by the `Core` field name so a server error can be routed by field. */
export const countryFieldRules: Record<string, FieldRule> = {
  name: all(required("Country name"), maxLength(150, "Country name")),
  slug: all(
    required("Slug"),
    maxLength(255, "Slug"),
    (value) =>
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.trim())
        ? null
        : "Slug must be lowercase letters, numbers and single hyphens, like study-in-malta.",
  ),
  pageHeading: all(required("Page heading"), maxLength(255, "Page heading")),
  shortDescription: all(
    required("Short description"),
    maxLength(1000, "Short description"),
  ),
  continentId: required("Continent"),
  externalUid: whenPresent(maxLength(191, "UID")),
  iso2Code: whenPresent((value) =>
    /^[A-Za-z]{2}$/.test(value.trim())
      ? null
      : "ISO2 must be exactly 2 letters, like MT.",
  ),
  iso3Code: whenPresent((value) =>
    /^[A-Za-z]{3}$/.test(value.trim())
      ? null
      : "ISO3 must be exactly 3 letters, like MLT.",
  ),
  currencyCode: whenPresent((value) =>
    /^[A-Za-z]{3}$/.test(value.trim())
      ? null
      : "Currency code must be exactly 3 letters, like EUR.",
  ),
  currencySymbol: whenPresent(maxLength(10, "Currency symbol")),
  capitalCity: whenPresent(maxLength(150, "Capital")),
  officialLanguage: whenPresent(maxLength(150, "Official language")),
  currencyName: whenPresent(maxLength(100, "Currency name")),
  tagline: whenPresent(maxLength(255, "Tagline")),
  displayOrder: integerBetween(0, 999999, "Display order"),
};

/** SEO lives in its own draft; the canonical rule is already shared with the
 * API's own constraint, so reuse it rather than restating it. */
export const seoFieldRules: Record<string, FieldRule> = {
  seoTitle: whenPresent(maxLength(255, "SEO title")),
  metaDescription: whenPresent(maxLength(500, "Meta description")),
  canonicalUrl: (value) => canonicalInputError(value),
  focusKeyword: whenPresent(maxLength(255, "Focus keyword")),
  ogTitle: whenPresent(maxLength(255, "Open Graph title")),
  ogDescription: whenPresent(maxLength(500, "Open Graph description")),
  twitterTitle: whenPresent(maxLength(255, "Twitter title")),
  twitterDescription: whenPresent(maxLength(500, "Twitter description")),
};

/** The API answers a failed publish with `details: [{ field, code, message }]`
 * and a failed write with a field-shaped code. Both used to be flattened into
 * one banner; this puts each message back on the field it belongs to. */
export function fieldErrorsFromServer(cause: unknown): Record<string, string> {
  const typed = cause as {
    details?: unknown;
    code?: unknown;
    message?: unknown;
  };
  const mapped: Record<string, string> = {};
  if (Array.isArray(typed?.details))
    for (const entry of typed.details) {
      const row = entry as { field?: unknown; message?: unknown };
      if (typeof row?.field === 'string' && typeof row?.message === 'string')
        mapped[row.field] = row.message;
    }
  if (Object.keys(mapped).length) return mapped;

  /* Conflict codes name their field in the code rather than in `details`. */
  const byCode: Record<string, [string, string]> = {
    COUNTRY_SLUG_CONFLICT: ['slug', 'That slug is already used by another country.'],
    COUNTRY_NAME_CONFLICT: ['name', 'That country name already exists.'],
    COUNTRY_CODE_CONFLICT: [
      'iso2Code',
      'That ISO code is already used by another country.',
    ],
    COUNTRY_CONTINENT_INVALID: [
      'continentId',
      'The selected continent is not available.',
    ],
  };
  const named = typeof typed?.code === 'string' ? byCode[typed.code] : undefined;
  if (named) mapped[named[0]] = named[1];
  return mapped;
}
