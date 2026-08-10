import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import type { PrismaService } from '../prisma/prisma.service';
import { BulkOperationsService } from './bulk.service';

const service = new BulkOperationsService({} as PrismaService);

/** Mirrors the valid SpreadsheetML namespace form produced by the populated
 * Subjects workbook that ExcelJS 4.x cannot read directly. */
async function withPrefixedSpreadsheetMl(buffer: Buffer): Promise<Buffer> {
  const archive = await JSZip.loadAsync(buffer);
  for (const entry of Object.values(archive.files)) {
    if (
      entry.dir ||
      !(
        entry.name === 'xl/workbook.xml' ||
        entry.name === 'xl/sharedStrings.xml' ||
        entry.name === 'xl/styles.xml' ||
        entry.name.startsWith('xl/worksheets/')
      )
    )
      continue;
    const xml = await entry.async('string');
    archive.file(
      entry.name,
      xml
        .replace(/<(\/?)([A-Za-z][\w.-]*)(?=[\s/>])/g, '<$1x:$2')
        .replace(/xmlns="([^"]+)"/, 'xmlns:x="$1"'),
    );
  }
  return Buffer.from(await archive.generateAsync({ type: 'nodebuffer' }));
}

describe('BulkOperationsService XLSX dry-run compatibility', () => {
  it('parses the server-generated Subjects template during dry-run', async () => {
    const template = await service.template('subjects', 'xlsx');

    await expect(
      service.dryRun('subjects', template.buffer, 'subjects-template.xlsx'),
    ).resolves.toEqual({ totalRows: 1, errors: [] });
  });

  it('parses a populated standard XLSX with prefixed SpreadsheetML elements', async () => {
    const template = await service.template('subjects', 'xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(template.buffer as unknown as ExcelJS.Buffer);
    workbook
      .getWorksheet('Data')!
      .addRow([
        'Demo Mathematics',
        'Fictional populated subject row.',
        'false',
        'PUBLISHED',
        '2',
      ]);
    const populated = Buffer.from(await workbook.xlsx.writeBuffer());
    const externalStyle = await withPrefixedSpreadsheetMl(populated);

    await expect(
      service.dryRun('subjects', externalStyle, 'subjects-filled.xlsx'),
    ).resolves.toEqual({ totalRows: 2, errors: [] });
  });

  it('returns a controlled 400 for an invalid XLSX, never a parser 500', async () => {
    await expect(
      service.dryRun('subjects', Buffer.from('not an xlsx'), 'subjects.xlsx'),
    ).rejects.toMatchObject<Partial<BadRequestException>>({
      response: {
        code: 'INVALID_SPREADSHEET',
        message:
          'The XLSX file could not be read. Please use a valid Excel workbook.',
      },
    });
  });

  it('keeps equivalent Subjects CSV dry-run behaviour unchanged', async () => {
    await expect(
      service.dryRun(
        'subjects',
        Buffer.from(
          'Name *,Short Description,Is Featured,Status,Display Order\nDemo Mathematics,Fictional populated subject row.,false,PUBLISHED,2\n',
        ),
        'subjects.csv',
      ),
    ).resolves.toEqual({ totalRows: 1, errors: [] });
  });
});
