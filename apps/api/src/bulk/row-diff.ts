import type { BulkField } from './bulk-resources';
import { CLEAR_TOKEN } from './country-bulk';

/**
 * Which columns of an uploaded row actually say something different from the
 * record already stored.
 *
 * Re-uploading a sheet is the normal way to work here: an operator edits three
 * countries in a file of two hundred and sends the whole thing back. Without
 * this, all two hundred are rewritten -- every `updatedAt` moves, every audit
 * entry says the catalogue changed, and the three real edits are invisible in
 * the noise. With it, an import reports what it actually did.
 *
 * The comparison runs against `toExportRow`, the same projection the export
 * download produces, because that is the one representation guaranteed to
 * round-trip: whatever an import writes, an export reads back in the shape the
 * sheet uses.
 *
 * Only columns the uploaded sheet carries are compared. A sheet that omits a
 * column is saying nothing about it, not asking for it to be cleared, so its
 * stored value is never counted as a difference.
 */

/**
 * A cell as text, without the `[object Object]` a bare String() can produce.
 * Sheet cells arrive as strings and export values as strings, numbers or
 * Prisma decimals; anything else is serialised rather than rendered wrongly.
 */
function asText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  )
    return String(value);
  if (value instanceof Date) return value.toISOString();
  const own = (value as { toString?: unknown }).toString;
  if (typeof own === 'function' && own !== Object.prototype.toString)
    return (value as { toString: () => string }).toString();
  return JSON.stringify(value) ?? '';
}

/** Equal values can still be written differently on either side. */
function comparable(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = asText(value).trim();
  if (text === '') return '';

  /* 6, 6.0 and 6.00 are one number; Prisma decimals arrive as the last. */
  if (/^-?\d+(?:\.\d+)?$/.test(text)) return String(Number(text));

  const lower = text.toLowerCase();
  if (lower === 'true' || lower === 'false') return lower;

  /* JSON cells -- faqs today -- differ by key order and by whether an empty
     field was written as null or left out. Neither is a change. */
  if (/^[[{]/.test(text)) {
    try {
      return stableJson(JSON.parse(text));
    } catch {
      /* Not JSON after all; fall through and compare it as text. */
    }
  }

  return text.replace(/\s+/g, ' ');
}

/** Key order is not meaning, and an absent field equals an empty one. */
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

const slug = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/**
 * Relation cells name records rather than carrying values. The sheet may use a
 * display name where the export writes a slug, and the order of a pipe-
 * separated list is not meaningful, so both sides collapse to a sorted set of
 * slugs before they are compared.
 */
function relationSet(value: unknown): string {
  if (value === null || value === undefined) return '';
  return asText(value)
    .split('|')
    .map((part) => slug(part.trim()))
    .filter(Boolean)
    .sort()
    .join('|');
}

export function changedColumns(
  fields: BulkField[],
  row: Record<string, unknown>,
  exported: Record<string, unknown>,
): string[] {
  const changed: string[] = [];
  for (const field of fields) {
    const key = field.label;
    /* Absent from the sheet: the upload is silent about it, not clearing it. */
    if (!(key in row)) continue;
    const incoming = row[key];
    if (incoming === undefined) continue;
    const raw = asText(incoming).trim();
    /* An empty cell is the same silence. Every parser in this module reads it
       as "leave it alone", and only CLEAR_TOKEN asks for a value to go, so a
       blank column next to a stored value is not a difference. Reading it as
       one would mark almost every row changed and the skip would never fire. */
    if (raw === '') continue;

    const stored = exported[key];
    if (raw === CLEAR_TOKEN) {
      if (comparable(stored) !== '') changed.push(key);
      continue;
    }

    const same =
      field.type === 'relation'
        ? relationSet(incoming) === relationSet(stored)
        : comparable(incoming) === comparable(stored);
    if (!same) changed.push(key);
  }
  return changed;
}
