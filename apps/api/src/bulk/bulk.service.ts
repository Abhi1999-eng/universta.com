import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { writeAudit } from '../catalog/catalog.audit';
import { PrismaService } from '../prisma/prisma.service';
import {
  bulkResource,
  type BulkResourceDefinition,
  type BulkRow,
} from './bulk-resources';
import { parseCsv, rowsWithHeader, toCsv } from './csv.util';
import { parseXlsx, toXlsx, toXlsxTemplate } from './xlsx.util';

const MAX_ROWS = 2000;

export interface RowError {
  line: number;
  errors: string[];
}
export interface ImportSummary {
  totalRows: number;
  created: number;
  updated: number;
  failed: number;
  errors: RowError[];
}

function delegate(prisma: PrismaService, definition: BulkResourceDefinition) {
  // Every resource's Prisma model is selected from a fixed, validated
  // registry key, never from unvalidated user input directly.

  return (prisma as any)[definition.model];
}

function isFile(filename: string, ext: string) {
  return filename.toLowerCase().endsWith(ext);
}

@Injectable()
export class BulkOperationsService {
  constructor(private readonly prisma: PrismaService) {}

  private async parseUploaded(
    buffer: Buffer,
    filename: string,
  ): Promise<BulkRow[]> {
    let cells: string[][];
    if (isFile(filename, '.csv')) {
      cells = parseCsv(buffer.toString('utf8'));
    } else if (isFile(filename, '.xlsx')) {
      cells = await parseXlsx(buffer);
    } else {
      throw new BadRequestException({
        code: 'UNSUPPORTED_FILE_TYPE',
        message: 'Only .csv and .xlsx files are supported',
        details: null,
      });
    }
    const rows = rowsWithHeader(cells);
    if (rows.length > MAX_ROWS)
      throw new BadRequestException({
        code: 'TOO_MANY_ROWS',
        message: `A single import is limited to ${MAX_ROWS} rows`,
        details: null,
      });
    return rows.map((row) => ({ __line: String(row.line), ...row.values }));
  }

  async template(resourceKey: string, format: 'csv' | 'xlsx') {
    const definition = bulkResource(resourceKey);
    if (format === 'csv') {
      return {
        buffer: Buffer.from(
          toCsv(definition.columns, [definition.exampleRow]),
          'utf8',
        ),
        extension: 'csv',
      };
    }
    return {
      buffer: await toXlsxTemplate(definition.columns, definition.exampleRow),
      extension: 'xlsx',
    };
  }

  async export(resourceKey: string, format: 'csv' | 'xlsx') {
    const definition = bulkResource(resourceKey);
    const includeMap: Record<string, Record<string, unknown>> = {
      countries: { continent: { select: { slug: true } } },
      states: { country: { select: { slug: true } } },
      cities: {
        country: { select: { slug: true } },
        state: { select: { slug: true } },
      },
      courses: {
        subject: { select: { slug: true } },
        courseLevel: { select: { code: true } },
      },
    };
    const rows = await delegate(this.prisma, definition).findMany({
      where: { deletedAt: null },
      include: includeMap[resourceKey],
      orderBy: { createdAt: 'asc' },
    });
    const exportRows = rows.map((row: Record<string, unknown>) =>
      definition.toExportRow(row),
    );
    if (format === 'csv') {
      return {
        buffer: Buffer.from(toCsv(definition.columns, exportRows), 'utf8'),
        extension: 'csv',
      };
    }
    return {
      buffer: await toXlsx(definition.columns, exportRows),
      extension: 'xlsx',
    };
  }

  /** Each resource's own `parseRow` is the single source of truth for
   * required-field validation (it already knows which fields need a
   * relation lookup vs. a plain presence check), so this just runs it per
   * row and collects the line number alongside the result. */
  private async validateRows(
    definition: BulkResourceDefinition,
    rows: BulkRow[],
  ) {
    const results: {
      line: number;
      row: BulkRow;
      parsed: Awaited<ReturnType<BulkResourceDefinition['parseRow']>>;
    }[] = [];
    for (const row of rows) {
      const line = Number(row.__line) || 0;
      const parsed = await definition.parseRow(row, this.prisma);
      results.push({ line, row, parsed });
    }
    return results;
  }

  async dryRun(
    resourceKey: string,
    buffer: Buffer,
    filename: string,
  ): Promise<{ totalRows: number; errors: RowError[] }> {
    const definition = bulkResource(resourceKey);
    const rows = await this.parseUploaded(buffer, filename);
    const validated = await this.validateRows(definition, rows);
    const errors = validated
      .filter((result) => result.parsed.errors)
      .map((result) => ({ line: result.line, errors: result.parsed.errors! }));
    return { totalRows: rows.length, errors };
  }

  async import(
    resourceKey: string,
    buffer: Buffer,
    filename: string,
    mode: 'create' | 'upsert',
    request: AuthenticatedRequest,
    actorUserId: string,
  ): Promise<ImportSummary> {
    const definition = bulkResource(resourceKey);
    const rows = await this.parseUploaded(buffer, filename);
    const validated = await this.validateRows(definition, rows);
    const summary: ImportSummary = {
      totalRows: rows.length,
      created: 0,
      updated: 0,
      failed: 0,
      errors: [],
    };
    const table = delegate(this.prisma, definition);
    for (const { line, parsed } of validated) {
      if (parsed.errors) {
        summary.failed += 1;
        summary.errors.push({ line, errors: parsed.errors });
        continue;
      }
      try {
        const slug = parsed.data.slug as string;
        const existing = await table.findFirst({
          where: { slug, deletedAt: null },
        });
        if (existing) {
          if (mode !== 'upsert') {
            summary.failed += 1;
            summary.errors.push({
              line,
              errors: [
                `a record with slug "${slug}" already exists (use upsert mode to update it)`,
              ],
            });
            continue;
          }
          await table.update({ where: { id: existing.id }, data: parsed.data });
          summary.updated += 1;
        } else {
          await table.create({ data: parsed.data });
          summary.created += 1;
        }
      } catch (error) {
        summary.failed += 1;
        summary.errors.push({
          line,
          errors: [error instanceof Error ? error.message : 'Unexpected error'],
        });
      }
    }
    await writeAudit(
      this.prisma,
      request,
      actorUserId,
      'bulk',
      resourceKey,
      resourceKey,
      'IMPORT',
      null,
      {
        totalRows: summary.totalRows,
        created: summary.created,
        updated: summary.updated,
        failed: summary.failed,
      },
      `Bulk ${mode} import: ${summary.created} created, ${summary.updated} updated, ${summary.failed} failed`,
    );
    return summary;
  }

  async bulkUpdate(
    resourceKey: string,
    ids: string[],
    fields: Record<string, unknown>,
    request: AuthenticatedRequest,
    actorUserId: string,
  ) {
    const definition = bulkResource(resourceKey);
    const disallowed = Object.keys(fields).filter(
      (key) => !definition.updatableColumns.includes(key),
    );
    if (disallowed.length)
      throw new BadRequestException({
        code: 'FIELD_NOT_UPDATABLE',
        message: `These fields cannot be bulk-updated: ${disallowed.join(', ')}`,
        details: null,
      });
    if (ids.length === 0 || ids.length > MAX_ROWS)
      throw new BadRequestException({
        code: 'INVALID_SELECTION',
        message: `Select between 1 and ${MAX_ROWS} records`,
        details: null,
      });
    const table = delegate(this.prisma, definition);
    const result = await table.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data: fields,
    });
    await writeAudit(
      this.prisma,
      request,
      actorUserId,
      'bulk',
      resourceKey,
      resourceKey,
      'BULK_UPDATE',
      null,
      { ids: JSON.stringify(ids), fields: JSON.stringify(fields) },
      `Bulk update of ${result.count} ${resourceKey} record(s)`,
    );
    return { updated: result.count };
  }

  async bulkArchive(
    resourceKey: string,
    ids: string[],
    request: AuthenticatedRequest,
    actorUserId: string,
  ) {
    const definition = bulkResource(resourceKey);
    if (ids.length === 0 || ids.length > MAX_ROWS)
      throw new BadRequestException({
        code: 'INVALID_SELECTION',
        message: `Select between 1 and ${MAX_ROWS} records`,
        details: null,
      });
    const table = delegate(this.prisma, definition);
    const blocked: { id: string; reason: string }[] = [];
    const archivable: string[] = [];
    for (const id of ids) {
      const reason = definition.dependencyCheck
        ? await definition.dependencyCheck(id, this.prisma)
        : null;
      if (reason) blocked.push({ id, reason });
      else archivable.push(id);
    }
    if (archivable.length === 0)
      throw new NotFoundException({
        code: 'NO_RECORDS_ARCHIVABLE',
        message: 'None of the selected records could be archived',
        details: null,
      });
    const result = await table.updateMany({
      where: { id: { in: archivable }, deletedAt: null },
      data: { deletedAt: new Date(), status: 'ARCHIVED' },
    });
    await writeAudit(
      this.prisma,
      request,
      actorUserId,
      'bulk',
      resourceKey,
      resourceKey,
      'BULK_ARCHIVE',
      null,
      { archivedIds: JSON.stringify(archivable), blockedCount: blocked.length },
      `Bulk archive of ${result.count} ${resourceKey} record(s)`,
    );
    return { archived: result.count, blocked };
  }
}
