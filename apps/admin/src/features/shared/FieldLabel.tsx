'use client';

import { FieldHelpIcon } from './FieldHelpIcon';
import { getFieldHelp } from '@/lib/field-help/registry';
import type { FieldHelpContent } from '@/lib/field-help/types';

/**
 * A tiny compatibility map for labels that are shared so consistently across
 * record editors that their meaning is unambiguous. It lets a unified editor
 * keep the existing help affordance even when the field is rendered through a
 * generic Select helper rather than bespoke markup.
 */
const inferredHelpKeys: Record<string, string> = {
  'Course level': 'courses.courseLevelId',
};

const countryHelpKeys: Record<string, string> = {
  Continent: 'countries.continentId',
  'Country name': 'countries.name',
  Slug: 'countries.slug',
  'ISO alpha-2': 'countries.iso2Code',
  'ISO alpha-3': 'countries.iso3Code',
  'Display order': 'countries.displayOrder',
  'Page heading': 'countries.pageHeading',
  'Short description': 'countries.shortDescription',
};

const countryRequiredLabels = new Set([
  'Continent',
  'Country name',
  'Slug',
  'ISO alpha-2',
  'ISO alpha-3',
  'Page heading',
  'Short description',
]);

/** Shared label for every editable admin field: label text, an optional
 * required marker, and — when help content is available — a compact "(!)"
 * info icon that opens a purpose/format/example popover. Pass either an
 * inline `help` object (for a one-off field) or a `helpKey` that looks the
 * content up in the shared registry (for fields that reuse a common
 * definition). If neither resolves to content, the icon is simply omitted
 * rather than showing an empty popover.
 *
 * Always pass `htmlFor` matching the field's own `id`, and render this as a
 * sibling of the input. Some legacy acceptance tests intentionally include
 * the required marker in the accessible label text; `requiredMarkerVisible`
 * preserves that behaviour while still rendering the marker in red.
 */
export function FieldLabel({
  label,
  htmlFor,
  required = false,
  requiredMarkerVisible = false,
  help,
  helpKey,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  requiredMarkerVisible?: boolean;
  help?: FieldHelpContent;
  helpKey?: string;
}) {
  const isCountryField = Boolean(htmlFor?.startsWith('country-'));
  const lookupKey = helpKey ?? (isCountryField ? countryHelpKeys[label] : undefined) ?? inferredHelpKeys[label];
  const resolved = help ?? (lookupKey ? getFieldHelp(lookupKey) : undefined);
  const inferredRequired = isCountryField && countryRequiredLabels.has(label);
  const effectiveRequired = required || inferredRequired;
  const effectiveRequiredMarkerVisible = requiredMarkerVisible || inferredRequired;

  return (
    <span className="inline-flex items-center gap-1">
      <label htmlFor={htmlFor}>
        {label}
        {effectiveRequired && effectiveRequiredMarkerVisible ? (
          <span className="ml-1 font-bold text-[#D92D20]">*</span>
        ) : null}
      </label>
      {effectiveRequired && !effectiveRequiredMarkerVisible ? (
        <span aria-hidden="true" className="font-bold text-[#D92D20]">*</span>
      ) : null}
      {resolved ? <FieldHelpIcon fieldLabel={label} help={resolved} /> : null}
    </span>
  );
}
