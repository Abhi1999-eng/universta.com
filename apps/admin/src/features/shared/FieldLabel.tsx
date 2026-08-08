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

/** Shared label for every editable admin field: label text, an optional
 * required marker, and — when help content is available — a compact "(!)"
 * info icon that opens a purpose/format/example popover. Pass either an
 * inline `help` object (for a one-off field) or a `helpKey` that looks the
 * content up in the shared registry (for fields that reuse a common
 * definition). If neither resolves to content, the icon is simply omitted
 * rather than showing an empty popover.
 *
 * Always pass `htmlFor` matching the field's own `id`, and render this as a
 * *sibling* of the input — never nest it inside an outer `<label>` that also
 * wraps the input. A real browser's accessible-name computation for an
 * implicitly-wrapping `<label>` (`<label>text<input/></label>`) breaks once
 * that label contains another interactive element — like this component's
 * own help-icon `<button>` — leaving the input with no accessible name at
 * all. Explicit `htmlFor`/`id` association sidesteps that entirely and is
 * required, not optional, for every caller.
 *
 * The required marker defaults to a sibling of `<label>`, `aria-hidden`
 * (decorative-only), so it never affects the *computed accessible name* —
 * this is safe precisely because only the help icon `<button>`, never the
 * marker, ever needed to move outside the label to avoid the wrapping bug
 * above. Some pre-existing forms instead rely on a literal, non-hidden " *"
 * that was already part of their accessible name before this component
 * existed: for those, `requiredMarkerVisible` renders the marker *inside*
 * `<label>` instead, so `for`-based association exposes it as part of the
 * label's own text — matching that exact pre-existing behavior. (This stays
 * safe because the input itself is still never nested inside the label —
 * only the marker text is.) Either way, the help icon's own accessible name
 * always uses the clean `label` text, never the marker. */
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
  const lookupKey = helpKey ?? inferredHelpKeys[label];
  const resolved = help ?? (lookupKey ? getFieldHelp(lookupKey) : undefined);
  return (
    <span className="inline-flex items-center">
      <label htmlFor={htmlFor}>
        {label}
        {required && requiredMarkerVisible ? ' *' : null}
      </label>
      {required && !requiredMarkerVisible ? (
        <span aria-hidden="true" className="text-[#B42318]"> *</span>
      ) : null}
      {resolved ? <FieldHelpIcon fieldLabel={label} help={resolved} /> : null}
    </span>
  );
}
