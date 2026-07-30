/** Minimal, dependency-free RFC 4180-ish CSV reader/writer. Kept intentionally
 * small: quoted fields (with escaped "" for a literal quote), comma
 * delimiter, CRLF or LF line endings. No dependency is pulled in for this —
 * XLSX needs a real library (exceljs) since it's a binary zip format, but CSV
 * is simple enough to own directly and avoid the extra supply-chain surface. */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const source = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (inQuotes) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ',') {
      row.push(field);
      field = '';
      continue;
    }
    if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }
    field += char;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => !(cells.length === 1 && cells[0] === ''));
}

function stringifyCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
    return String(value);
  return '';
}

function csvCell(value: unknown): string {
  const text = stringifyCell(value);
  // Cells starting with a formula-injection-prone character are prefixed
  // with a tab so spreadsheet apps render them as plain text rather than
  // executing them as a formula when the file is later opened.
  const safe = /^[=+\-@\t\r]/.test(text) ? `\t${text}` : text;
  if (/[",\n]/.test(safe)) return `"${safe.replaceAll('"', '""')}"`;
  return safe;
}

export function toCsv(
  columns: string[],
  rows: Record<string, unknown>[],
): string {
  const lines = [columns.map(csvCell).join(',')];
  for (const row of rows) {
    lines.push(columns.map((column) => csvCell(row[column])).join(','));
  }
  return lines.join('\r\n');
}

/** Rows keyed by header, in file order, with a 1-based line number for
 * error reporting (header itself is line 1, first data row is line 2). */
export function rowsWithHeader(
  cells: string[][],
): { line: number; values: Record<string, string> }[] {
  if (cells.length === 0) return [];
  const [header, ...body] = cells;
  return body.map((row, index) => ({
    line: index + 2,
    values: Object.fromEntries(
      header.map((column, columnIndex) => [
        column.trim(),
        (row[columnIndex] ?? '').trim(),
      ]),
    ),
  }));
}
