import ExcelJS from 'exceljs';
import type { PrismaService } from '../prisma/prisma.service';
import { BULK_RESOURCES, bulkFields } from './bulk-resources';
import { BulkOperationsService } from './bulk.service';

function statusColumn(sheet: ExcelJS.Worksheet) {
  for (let column = 1; column <= sheet.columnCount; column += 1) {
    if (sheet.getCell(1, column).value === 'Status') return column;
  }
  throw new Error('Status column was not found');
}

describe('BulkOperationsService status value constraints', () => {
  const service = new BulkOperationsService({} as PrismaService);

  it('defines allowed values for every bulk Status field', () => {
    for (const definition of Object.values(BULK_RESOURCES)) {
      const status = bulkFields(definition).find(
        (field) => field.key === 'status',
      );
      expect(status?.allowedValues).toEqual(expect.any(Array));
      expect(status?.allowedValues).not.toHaveLength(0);
    }
  });

  it.each([
    ['courses', ['DRAFT', 'PUBLISHED'], 'DRAFT'],
    ['universities', ['DRAFT', 'PUBLISHED'], 'DRAFT'],
    ['campuses', ['ACTIVE', 'INACTIVE'], 'ACTIVE'],
  ])(
    'adds the real Status dropdown to the %s XLSX template',
    async (resource, allowedValues, exampleValue) => {
      const template = await service.template(resource, 'xlsx');
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(template.buffer as unknown as ExcelJS.Buffer);
      const data = workbook.getWorksheet('Data')!;
      const status = statusColumn(data);

      expect(data.getCell(2, status).value).toBe(exampleValue);
      expect(data.getCell(2, status).dataValidation).toMatchObject({
        type: 'list',
        formulae: [`"${allowedValues.join(',')}"`],
        showErrorMessage: true,
        error: 'Please select a valid status from the dropdown.',
      });
      expect(data.getCell(2001, status).dataValidation).toMatchObject({
        type: 'list',
        formulae: [`"${allowedValues.join(',')}"`],
      });
      expect(workbook.getWorksheet('README')!.getCell('B7').value).toBe(
        'Select a value from the dropdown.',
      );
    },
  );

  it('rejects an invalid CSV Status with a row-level allowed-values error', async () => {
    const result = await service.dryRun(
      'subjects',
      Buffer.from(
        'Name,Short Description,Featured,Status,Display Order\nDemo Subject,Fictional content,false,PUBLISHD,0\n',
      ),
      'subjects.csv',
    );

    expect(result.errors).toEqual([
      {
        line: 2,
        errors: [
          'Status "PUBLISHD" is invalid. Allowed values: DRAFT, PUBLISHED.',
        ],
      },
    ]);
  });

  it('accepts the valid example Status from a generated XLSX template', async () => {
    const template = await service.template('subjects', 'xlsx');
    const result = await service.dryRun(
      'subjects',
      template.buffer,
      'subjects.xlsx',
    );

    expect(result.errors).toEqual([]);
  });
});
