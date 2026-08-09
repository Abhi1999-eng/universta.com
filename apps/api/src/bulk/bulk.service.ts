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
  bulkFields,
  type BulkResourceDefinition,
  type BulkRow,
} from './bulk-resources';
import { parseCsv, rowsWithHeader, toCsv } from './csv.util';
import { parseXlsx, toXlsx, toXlsxTemplate } from './xlsx.util';

const MAX_ROWS = 2000;

/** ISS-035. Every bulk-update value arrives as a raw string from the admin's
 * single generic text input, regardless of the target column's real type.
 * String columns pass through Prisma untouched, and Decimal/DateTime columns
 * accept a string representation directly -- but the two Int/Boolean columns
 * across the whole registry (`displayOrder`, `isFeatured`) do not, and
 * `updateMany` threw an unhandled 500 rather than applying the value. */
const BOOLEAN_UPDATE_FIELDS = new Set(['isFeatured']);
const INTEGER_UPDATE_FIELDS = new Set(['displayOrder']);

function coerceUpdateFields(
  fields: Record<string, unknown>,
): Record<string, unknown> {
  const coerced: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (BOOLEAN_UPDATE_FIELDS.has(key) && typeof value === 'string') {
      coerced[key] = value.trim().toLowerCase() === 'true';
    } else if (INTEGER_UPDATE_FIELDS.has(key) && typeof value === 'string') {
      const parsed = Number(value);
      if (!Number.isFinite(parsed))
        throw new BadRequestException({
          code: 'INVALID_FIELD_VALUE',
          message: `"${key}" must be a number`,
          details: null,
        });
      coerced[key] = parsed;
    } else {
      coerced[key] = value;
    }
  }
  return coerced;
}

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
    definition: BulkResourceDefinition,
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
    const fields = bulkFields(definition);
    const headers = new Map(
      fields.map((field) => [field.label.toLowerCase(), field.key]),
    );
    const normalized = rows.map((row) => {
      const values: BulkRow = { __line: String(row.line) };
      for (const [header, value] of Object.entries(row.values)) {
        const normalizedHeader = header
          .trim()
          .replace(/\s*\*$/, '')
          .toLowerCase();
        values[headers.get(normalizedHeader) ?? header] = value;
      }
      return values;
    });
    await this.resolveHumanRelations(definition.key, normalized);
    return normalized;
  }

  /** Resolve each distinct human-readable relation once per uploaded file.
   * Legacy CSVs using slugs/codes continue to work as a fallback. */
  private async resolveHumanRelations(resource: string, rows: BulkRow[]) {
    const values = (key: string) => [
      ...new Set(rows.map((row) => row[key]?.trim()).filter(Boolean)),
    ];
    const match = (
      rowsToMap: { name?: string; slug?: string; code?: string; id: string }[],
      inputs: string[],
    ) => {
      const lookup = new Map<
        string,
        { id: string; slug?: string; code?: string }
      >();
      for (const row of rowsToMap)
        for (const value of [row.name, row.slug, row.code])
          if (value) lookup.set(value.trim().toLowerCase(), row);
      return inputs.map(
        (input) =>
          [input.toLowerCase(), lookup.get(input.toLowerCase())] as const,
      );
    };
    if (resource === 'courses') {
      const [subjects, levels] = await Promise.all([
        this.prisma.subject.findMany({
          where: { deletedAt: null },
          select: { id: true, name: true, slug: true },
        }),
        this.prisma.courseLevel.findMany({
          select: { id: true, name: true, code: true },
        }),
      ]);
      const subjectsByName = new Map(match(subjects, values('subjectSlug')));
      const levelsByName = new Map(match(levels, values('courseLevelCode')));
      for (const row of rows) {
        const subject = subjectsByName.get(
          row.subjectSlug?.trim().toLowerCase(),
        );
        const level = levelsByName.get(
          row.courseLevelCode?.trim().toLowerCase(),
        );
        if (subject) {
          row.__subjectId = subject.id;
          row.subjectSlug = subject.slug ?? row.subjectSlug;
        }
        if (level) {
          row.__courseLevelId = level.id;
          row.courseLevelCode = level.code ?? row.courseLevelCode;
        }
      }
    }
    if (resource === 'universities') {
      const countries = await this.prisma.country.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, slug: true },
      });
      const countriesByName = new Map(match(countries, values('countrySlug')));
      for (const row of rows) {
        const country = countriesByName.get(
          row.countrySlug?.trim().toLowerCase(),
        );
        if (country) {
          row.__countryId = country.id;
          row.countrySlug = country.slug ?? row.countrySlug;
        }
      }
    }
  }

  async template(resourceKey: string, format: 'csv' | 'xlsx') {
    const definition = bulkResource(resourceKey);
    const fields = bulkFields(definition);
    const columns = fields.map(
      (field) => `${field.label}${field.required ? ' *' : ''}`,
    );
    const example = Object.fromEntries(
      fields.map((field) => [
        `${field.label}${field.required ? ' *' : ''}`,
        definition.exampleRow[field.key] ?? '',
      ]),
    );
    if (format === 'csv') {
      return {
        buffer: Buffer.from(toCsv(columns, [example]), 'utf8'),
        extension: 'csv',
      };
    }
    return {
      buffer: await toXlsxTemplate(columns, example, {
        resourceLabel: definition.label,
      }),
      extension: 'xlsx',
    };
  }

  private static readonly INCLUDE_MAP: Record<string, Record<string, unknown>> =
    {
      countries: { continent: { select: { slug: true, name: true } } },
      states: { country: { select: { slug: true, name: true } } },
      cities: {
        country: { select: { slug: true, name: true } },
        state: { select: { slug: true, name: true } },
      },
      courses: {
        subject: { select: { slug: true, name: true } },
        courseLevel: { select: { code: true, name: true } },
      },
      universities: { country: { select: { slug: true, name: true } } },
      campuses: { university: { select: { slug: true, name: true } } },
      offerings: {
        university: { select: { slug: true, name: true } },
        genericCourse: { select: { slug: true, name: true } },
        campus: { select: { slug: true, name: true } },
        courseLevel: { select: { code: true, name: true } },
      },
      scholarships: { provider: { select: { slug: true, name: true } } },
      'consultant-locations': { country: { select: { slug: true, name: true } } },
    };

  private async fetchRecords(
    resourceKey: string,
    definition: BulkResourceDefinition,
  ) {
    return delegate(this.prisma, definition).findMany({
      where: { deletedAt: null },
      include: BulkOperationsService.INCLUDE_MAP[resourceKey],
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Lightweight JSON listing (id + the same field set as export) used by
   * the admin bulk-update/bulk-archive record picker — the file-download
   * `export` endpoint returns a binary buffer, not something a UI can list. */
  async listRecords(resourceKey: string) {
    const definition = bulkResource(resourceKey);
    const rows = await this.fetchRecords(resourceKey, definition);
    return rows.map((row: Record<string, unknown>) => ({
      id: row.id,
      ...definition.toExportRow(row),
    }));
  }

  async export(resourceKey: string, format: 'csv' | 'xlsx') {
    const definition = bulkResource(resourceKey);
    const rows = await this.fetchRecords(resourceKey, definition);
    const fields = bulkFields(definition);
    const columns = fields.map((field) => field.label);
    const exportRows = rows.map((row: Record<string, unknown>) => {
      const legacy = definition.toExportRow(row);
      return Object.fromEntries(fields.map((field) => [
        field.label,
        this.humanExportValue(field.key, legacy, row),
      ]));
    });
    if (format === 'csv') {
      return {
        buffer: Buffer.from(toCsv(columns, exportRows), 'utf8'),
        extension: 'csv',
      };
    }
    return {
      buffer: await toXlsx(columns, exportRows),
      extension: 'xlsx',
    };
  }

  private humanExportValue(
    key: string,
    legacy: Record<string, unknown>,
    row: Record<string, unknown>,
  ) {
    const relation = row[key.replace(/(?:Slug|Code)$/, '')] as
      | { name?: string }
      | undefined;
    return relation?.name ?? legacy[key] ?? '';
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
    const rows = await this.parseUploaded(buffer, filename, definition);
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
    const rows = await this.parseUploaded(buffer, filename, definition);
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
      data: coerceUpdateFields(fields),
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
