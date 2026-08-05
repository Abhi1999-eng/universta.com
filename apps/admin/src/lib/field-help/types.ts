/** One field's help content, shown in the popover opened by its info icon.
 * Keep this client-facing: no implementation jargon (Prisma, DTOs, column
 * types) — write for the person filling in the form. */
export type FieldHelpContent = {
  /** One sentence: what this field is for. */
  purpose: string;
  /** What the user should type/choose/select. */
  input: string;
  /** Plain-language data type, e.g. "Text", "URL", "Number", "Date". */
  dataType: string;
  /** Whether the field is required, and when. */
  required: string;
  /** Accepted format/pattern, if relevant (e.g. "https:// URL", "a-z, 0-9 and hyphens only"). */
  format?: string;
  /** A concrete example value. */
  example?: string;
  /** What must exist first, if anything (e.g. "Requires a Country to be selected first"). */
  dependency?: string;
  /** What changes on the public site when this is saved/published. Use the
   * exact wording "This value is stored, but no public visual effect is
   * currently verified." for fields with no confirmed frontend effect —
   * never invent one. */
  frontendEffect: string;
  /** An important warning, if relevant (destructive change, publish-only requirement, etc.). */
  caution?: string;
};
