'use client';

import { FieldHelpIcon } from './FieldHelpIcon';
import { getFieldHelp } from '@/lib/field-help/registry';
import type { FieldHelpContent } from '@/lib/field-help/types';

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
 * required, not optional, for every caller. */
export function FieldLabel({
  label,
  htmlFor,
  required = false,
  help,
  helpKey,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  help?: FieldHelpContent;
  helpKey?: string;
}) {
  const resolved = help ?? (helpKey ? getFieldHelp(helpKey) : undefined);
  return (
    <span className="inline-flex items-center">
      <label htmlFor={htmlFor}>
        {label}
        {required ? <span aria-hidden="true" className="text-[#B42318]"> *</span> : null}
      </label>
      {resolved ? <FieldHelpIcon fieldLabel={label} help={resolved} /> : null}
    </span>
  );
}
