import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { BadRequestException } from '@nestjs/common';

function invalidSpreadsheet(): BadRequestException {
  return new BadRequestException({
    code: 'INVALID_SPREADSHEET',
    message:
      'The XLSX file could not be read. Please use a valid Excel workbook.',
    details: null,
  });
}

/** Some standard XLSX writers namespace their SpreadsheetML element names
 * (`x:workbook`, `x:worksheet`, and so on). ExcelJS 4.x does not recognise
 * those names even though they are valid OOXML. Normalize only element names
 * inside the archive, then let the existing ExcelJS loader do all real XLSX
 * parsing and validation. */
async function normalizePrefixedSpreadsheetMl(buffer: Buffer): Promise<Buffer> {
  const archive = await JSZip.loadAsync(buffer);
  let changed = false;
  for (const entry of Object.values(archive.files)) {
    if (entry.dir || !/^xl\/.+\.xml$/i.test(entry.name)) continue;
    const xml = await entry.async('string');
    if (!xml.includes('<x:')) continue;
    archive.file(
      entry.name,
      xml.replaceAll('<x:', '<').replaceAll('</x:', '</'),
    );
    changed = true;
  }
  if (!changed) throw invalidSpreadsheet();
  return Buffer.from(await archive.generateAsync({ type: 'nodebuffer' }));
}

async function loadWorkbook(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    return workbook;
  } catch {
    try {
      const normalized = await normalizePrefixedSpreadsheetMl(buffer);
      await workbook.xlsx.load(normalized as unknown as ExcelJS.Buffer);
      return workbook;
    } catch {
      throw invalidSpreadsheet();
    }
  }
}

/** Parses the first worksheet of an XLSX buffer into the same shape
 * `rowsWithHeader` expects from CSV: header row + string-keyed data rows. */
export async function parseXlsx(buffer: Buffer): Promise<string[][]> {
  const workbook = await loadWorkbook(buffer);
  const sheet = workbook.getWorksheet('Data') ?? workbook.worksheets[0];
  if (!sheet) return [];
  const rows: string[][] = [];
  sheet.eachRow((row) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      const value = cell.value;
      if (value === null || value === undefined) cells.push('');
      else if (value instanceof Date) cells.push(value.toISOString());
      else if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      )
        cells.push(String(value));
      else if (
        typeof value === 'object' &&
        'text' in value &&
        typeof value.text === 'string'
      )
        cells.push(value.text);
      else if (
        typeof value === 'object' &&
        'result' in value &&
        (typeof value.result === 'string' || typeof value.result === 'number')
      )
        cells.push(String(value.result));
      else cells.push('');
    });
    rows.push(cells);
  });
  return rows;
}

export async function toXlsx(
  columns: string[],
  rows: Record<string, unknown>[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Export');
  sheet.columns = columns.map((column) => ({
    header: column,
    key: column,
    width: 24,
  }));
  for (const row of rows) sheet.addRow(row);
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1657CF' },
  };
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/** A downloadable starter template: header row only, plus one commented
 * example row so an editor understands the expected shape without any
 * fabricated values being mistaken for real data. */
export async function toXlsxTemplate(
  columns: string[],
  exampleRow?: Record<string, unknown>,
  options?: {
    resourceLabel?: string;
    descriptions?: string[];
    validations?: { column: string; allowedValues: readonly string[] }[];
  },
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const readme = workbook.addWorksheet('README');
  readme.columns = [{ width: 28 }, { width: 96 }];
  readme.addRows([
    ['Bulk import template', options?.resourceLabel ?? 'Catalog records'],
    ['Required fields', '* = Required. Do not rename headings.'],
    [
      'Create / update',
      'Create mode rejects matching records. Create + update matches the generated slug and never clears optional fields left blank.',
    ],
    [
      'Relationships',
      'Use the visible name from Admin (for example, Country or Subject), never IDs.',
    ],
    ['Dates', 'Use ISO dates: YYYY-MM-DD or ISO date-time.'],
    ['Booleans', 'Use true or false.'],
    ['Status', 'Select a value from the dropdown.'],
    ['Slugs', 'Slugs are generated automatically from Name or Title.'],
    [
      'Common error',
      'A relation name must match an existing Admin record exactly.',
    ],
  ]);
  readme.getColumn(1).font = { bold: true };
  const sheet = workbook.addWorksheet('Data');
  sheet.columns = columns.map((column) => ({
    header: column,
    key: column,
    width: Math.max(18, Math.min(44, column.length + 10)),
    style: { alignment: { wrapText: true, vertical: 'top' } },
  }));
  if (exampleRow) sheet.addRow(exampleRow);
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1657CF' },
  };
  for (const validation of options?.validations ?? []) {
    const column = columns.indexOf(validation.column) + 1;
    if (!column) continue;
    for (let row = 2; row <= 2001; row += 1) {
      sheet.getCell(row, column).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${validation.allowedValues.join(',')}"`],
        showErrorMessage: true,
        errorStyle: 'stop',
        errorTitle: 'Invalid value',
        error: 'Please select a valid status from the dropdown.',
      };
    }
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
