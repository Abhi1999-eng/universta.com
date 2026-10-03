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
  bulkFieldValueErrors,
  type BulkResourceDefinition,
  type BulkRow,
} from './bulk-resources';
import { parseCsv, rowsWithHeader, toCsv } from './csv.util';
import { createLimiter } from '../courses/courses.service';
import { changedColumns } from './row-diff';
import { parseXlsx, toXlsx, toXlsxTemplate } from './xlsx.util';

const MAX_ROWS = 2000;
/* How many dependency checks are in flight at once when archiving a whole
   resource, and how many ids go into one UPDATE. */
const ARCHIVE_CHECK_CONCURRENCY = 8;
const ARCHIVE_WRITE_CHUNK = 500;

/** Splits a list into runs of at most `size`. */
function chunk<T>(rows: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let from = 0; from < rows.length; from += size)
    out.push(rows.slice(from, from + size));
  return out;
}

/** ISS-035. Every bulk-update value arrives as a raw string from the admin's
 * single generic text input, regardless of the target column's real type.
 * String columns pass through Prisma untouched, and Decimal/DateTime columns
 * accept a string representation directly -- but the two Int/Boolean columns
 * across the whole registry (`displayOrder`, `isFeatured`) do not, and
 * `updateMany` threw an unhandled 500 rather than applying the value. */
/* `isFeatured` used to be the one boolean here. Nothing is featured any
   more, so the only value a sheet's bulk edit has to coerce is a number. */
const INTEGER_UPDATE_FIELDS = new Set(['displayOrder']);

function coerceUpdateFields(
  fields: Record<string, unknown>,
): Record<string, unknown> {
  const coerced: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (INTEGER_UPDATE_FIELDS.has(key) && typeof value === 'string') {
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
  /** Rows whose record already said exactly what the sheet says. */
  unchanged: number;
  failed: number;
  errors: RowError[];
}

type TransactionalTable = {
  create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
  update(args: {
    where: { id: string | null };
    data: Record<string, unknown>;
  }): Promise<{ id: string }>;
};

function delegate(prisma: PrismaService, definition: BulkResourceDefinition) {
  // Every resource's Prisma model is selected from a fixed, validated
  // registry key, never from unvalidated user input directly.

  return (prisma as any)[definition.model];
}

function isFile(filename: string, ext: string) {
  return filename.toLowerCase().endsWith(ext);
}

/**
 * What a failed row says to the operator who uploaded the file.
 *
 * A write that the database refuses arrives here as a driver error, and its
 * message is a stack with the service's own file path and line numbers in it.
 * Printed into an import report that is the whole explanation someone gets --
 * a duplicate slug read as `Invalid scoped.create() invocation ... Unique
 * constraint failed on the constraint: countries_slug_deleted_key`, which
 * names neither the row's problem nor what to do about it.
 */
function importRowError(error: unknown): string {
  const known = error as { code?: unknown; meta?: { target?: unknown } };
  const message = error instanceof Error ? error.message : '';
  /* The driver adapter leaves `meta.target` empty on MySQL and names the
     constraint in the message instead, so both are read. */
  const named = /constraint: `([^`]+)`/.exec(message)?.[1];
  const target = Array.isArray(known?.meta?.target)
    ? known.meta.target.map(String)
    : typeof known?.meta?.target === 'string'
      ? [known.meta.target]
      : named
        ? [named]
        : [];
  /* `countries_slug_deleted_key` is the constraint's name, not a column an
     operator can see. The column is the part in the middle. */
  const columns = target
    .map((name) =>
      name
        .replace(/^[a-z]+_/, '')
        .replace(/_(deleted_)?key$/, '')
        .replace(/_/g, ' ')
        .trim(),
    )
    .filter(Boolean);

  if (known?.code === 'P2002')
    return columns.length
      ? `Another country already uses this ${columns.join(' and ')}`
      : 'Another record already uses one of the values in this row';
  if (known?.code === 'P2003')
    return 'This row points at a record that does not exist';
  if (known?.code === 'P2025')
    return 'The record this row updates no longer exists';

  /* Anything else keeps its first line only: the rest is a stack trace, and
     the report has one line per row. */
  return (
    message
      .split('\n')
      .map((line) => line.trim())
      .find(Boolean) ?? 'Unexpected error'
  );
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
        // `__`-prefixed keys carry ids this service resolved itself; a column
        // of that name in an upload would skip the lookup, so it is ignored.
        if (header.trim().startsWith('__')) continue;
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
        validations: fields.flatMap((field) =>
          field.allowedValues?.length
            ? [
                {
                  column: `${field.label}${field.required ? ' *' : ''}`,
                  allowedValues: field.allowedValues,
                },
              ]
            : [],
        ),
      }),
      extension: 'xlsx',
    };
  }

  private static readonly INCLUDE_MAP: Record<string, Record<string, unknown>> =
    {
      countries: {
        continent: { select: { slug: true, name: true } },
        subjectMaps: {
          include: { subject: { select: { name: true, slug: true } } },
          orderBy: [{ displayOrder: 'asc' }, { subjectId: 'asc' }],
        },
        tagMaps: {
          include: { tag: { select: { name: true, slug: true } } },
          orderBy: { tag: { slug: 'asc' } },
        },
        intakes: {
          include: { intake: { select: { name: true, slug: true } } },
          orderBy: [{ displayOrder: 'asc' }, { intakeId: 'asc' }],
        },
        faqs: {
          where: { deletedAt: null },
          orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
        },
        contentSections: { where: { deletedAt: null } },
        costProfile: true,
        workProfile: true,
        languageRequirements: true,
        statistics: true,
        listingMedia: { select: { publicUrl: true } },
        flagMedia: { select: { publicUrl: true } },
        heroMedia: { select: { publicUrl: true } },
      },
      /* The subject sheet carries its specializations in one column, so the
         export and the unchanged-check both have to read them back. */
      subjects: {
        subSubjects: {
          where: { deletedAt: null },
          select: { name: true },
          orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        },
      },
      states: { country: { select: { slug: true, name: true } } },
      cities: {
        country: { select: { slug: true, name: true } },
        state: { select: { slug: true, name: true } },
      },
      courses: {
        subject: { select: { slug: true, name: true } },
        // The sheet carries the specialization, so the export has to read it.
        subSubject: { select: { slug: true, name: true } },
        courseLevel: { select: { code: true, name: true } },
        /* And the destinations, which is what makes a course public. */
        countryCourses: {
          where: { deletedAt: null },
          select: { country: { select: { slug: true } } },
          orderBy: { country: { slug: 'asc' } },
        },
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
      'consultant-locations': {
        country: { select: { slug: true, name: true } },
      },
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
      return Object.fromEntries(
        fields.map((field) => [
          field.label,
          this.humanExportValue(field.key, legacy, row),
        ]),
      );
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
      { name?: string } | undefined;
    return relation?.name ?? legacy[key] ?? '';
  }

  /** Each resource's own `parseRow` is the single source of truth for
   * required-field validation (it already knows which fields need a
   * relation lookup vs. a plain presence check), so this just runs it per
   * row and collects the line number alongside the result. */
  /**
   * Writes one row. When a resource declares a reconciler the scalar write and
   * the relation work share a transaction, so a row can never land with new
   * scalars beside stale taxonomy.
   */
  private async writeRow(
    definition: BulkResourceDefinition,
    id: string | null,
    parsed: { data: Record<string, unknown>; relations?: unknown },
    mode: 'create' | 'update',
  ): Promise<void> {
    if (!definition.reconcile) {
      const table = delegate(this.prisma, definition);
      if (mode === 'update')
        await table.update({ where: { id }, data: parsed.data });
      else await table.create({ data: parsed.data });
      return;
    }
    await this.prisma.$transaction(async (tx) => {
      // Same fixed-registry selection the non-transactional path uses.
      const scoped = (tx as unknown as Record<string, TransactionalTable>)[
        definition.model
      ];
      const record =
        mode === 'update'
          ? await scoped.update({ where: { id }, data: parsed.data })
          : await scoped.create({ data: parsed.data });
      await definition.reconcile!(tx, String(record.id), parsed.relations);
    });
  }

  /**
   * Which columns of an uploaded row differ from the stored record, or null
   * when the record cannot be read back in the shape the sheet uses.
   *
   * Null means "no opinion", and the caller writes the row rather than risking
   * a skip it cannot justify: not knowing whether something changed is never a
   * reason to drop an edit.
   */
  private async changedAgainstStored(
    resourceKey: string,
    definition: BulkResourceDefinition,
    id: string,
    row: BulkRow,
  ): Promise<string[] | null> {
    try {
      const stored = (await delegate(this.prisma, definition).findFirst({
        where: { id },
        include: BulkOperationsService.INCLUDE_MAP[resourceKey],
      })) as Record<string, unknown> | null;
      if (!stored) return null;
      const fields = bulkFields(definition);
      const exported = definition.toExportRow(stored);
      /* What the export download writes for this record: the same projection,
         with relation slugs and codes swapped for display names. A re-uploaded
         export carries those names, so the comparison has to know them. */
      const asDownloaded = Object.fromEntries(
        fields.map((field) => [
          field.key,
          this.humanExportValue(field.key, exported, stored),
        ]),
      );
      return changedColumns(fields, row, exported, asDownloaded);
    } catch {
      return null;
    }
  }

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
      const fieldErrors = bulkFieldValueErrors(definition, row);
      results.push({
        line,
        row,
        parsed: fieldErrors.length
          ? { errors: [...fieldErrors, ...(parsed.errors ?? [])] }
          : parsed,
      });
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
      unchanged: 0,
      failed: 0,
      errors: [],
    };
    const table = delegate(this.prisma, definition);
    for (const { line, row, parsed } of validated) {
      if (parsed.errors) {
        summary.failed += 1;
        summary.errors.push({ line, errors: parsed.errors });
        continue;
      }
      try {
        const slug = parsed.data.slug as string;
        const externalUid =
          resourceKey === 'countries'
            ? (parsed.data.externalUid as string | null | undefined)
            : undefined;
        /* A supplied uid identifies the record, and the slug is the
           fallback the comment here always claimed it was -- which it was
           not. A uid matching nothing made this skip the slug entirely and
           try to create, so re-uploading a sheet of uids into a database
           whose rows had never been given one failed every single line with
           "Another country already uses this name", about the record the
           slug was pointing straight at.

           The fallback only adopts a record that has no uid of its own. A
           slug held by a record carrying a *different* uid is the conflict
           the guard below was written for, and stays one: the sheet is
           claiming to introduce a new record under a slug somebody else is
           already using. The delegate is untyped, so name the fields used. */
        const slugOwner = (await table.findFirst({
          where: { slug, deletedAt: null },
        })) as { id: string; externalUid?: string | null } | null;
        let existing = (
          externalUid
            ? await table.findFirst({ where: { externalUid, deletedAt: null } })
            : null
        ) as { id: string } | null;
        const matchedByUid = Boolean(existing);
        if (!existing && (!externalUid || !slugOwner?.externalUid))
          existing = slugOwner;
        if (matchedByUid && slugOwner && slugOwner.id !== existing?.id) {
          /* The uid points at one record and the slug at another: renaming
             one and re-pointing the other are both plausible readings, so
             the row is rejected rather than guessed at. Only when the uid
             actually matched something -- a uid nobody holds, over a slug
             somebody else does, is just a taken slug, and the database says
             so more plainly than this could. */
          summary.failed += 1;
          summary.errors.push({
            line,
            errors: [
              `uid "${externalUid}" matches a different record than slug "${slug}"; resolve the conflict before importing`,
            ],
          });
          continue;
        }
        if (existing) {
          /* A row that says nothing new is not a conflict and not an update.
             Re-sending a whole sheet to change three countries should touch
             three records, whichever mode it is sent in. */
          const changed = await this.changedAgainstStored(
            resourceKey,
            definition,
            existing.id,
            row,
          );
          /* A reconciler can have work the columns cannot describe, so the
             resource gets to say so before the row is written off. */
          const relationWork = definition.relationsChanged
            ? await definition.relationsChanged(
                existing.id,
                parsed.relations,
                this.prisma,
              )
            : false;
          if (changed !== null && changed.length === 0 && !relationWork) {
            summary.unchanged += 1;
            continue;
          }
          if (mode !== 'upsert') {
            summary.failed += 1;
            summary.errors.push({
              line,
              errors: [
                changed?.length
                  ? `a record with slug "${slug}" already exists and this row changes ${changed.join(', ')} (use upsert mode to apply it)`
                  : `a record with slug "${slug}" already exists (use upsert mode to update it)`,
              ],
            });
            continue;
          }
          await this.writeRow(definition, existing.id, parsed, 'update');
          summary.updated += 1;
        } else {
          await this.writeRow(definition, null, parsed, 'create');
          summary.created += 1;
        }
      } catch (error) {
        summary.failed += 1;
        summary.errors.push({ line, errors: [importRowError(error)] });
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
        unchanged: summary.unchanged,
        failed: summary.failed,
      },
      `Bulk ${mode} import: ${summary.created} created, ${summary.updated} updated, ${summary.unchanged} unchanged, ${summary.failed} failed`,
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

  /**
   * Archives a selection, or everything the resource holds.
   *
   * `all` is here because a selection stops being able to say "all of them"
   * once a resource is large: the universities alone are nine thousand, and
   * the cap below stops at {@link MAX_ROWS}. Passed `all`, the ids are read
   * here rather than travelling over the wire, and everything after that is
   * the same path -- each row's own dependency check, the unique-key release
   * countries need, one audit entry naming what went.
   */
  async bulkArchive(
    resourceKey: string,
    ids: string[],
    request: AuthenticatedRequest,
    actorUserId: string,
    all = false,
  ) {
    const definition = bulkResource(resourceKey);
    const table = delegate(this.prisma, definition);
    if (all) {
      const rows = (await table.findMany({
        where: { deletedAt: null },
        select: { id: true },
      })) as Array<{ id: string }>;
      ids = rows.map((row) => row.id);
      if (ids.length === 0)
        throw new NotFoundException({
          code: 'NO_RECORDS_ARCHIVABLE',
          message: `Nothing live to archive in ${resourceKey}`,
          details: null,
        });
    } else if (ids.length === 0 || ids.length > MAX_ROWS)
      throw new BadRequestException({
        code: 'INVALID_SELECTION',
        message: `Select between 1 and ${MAX_ROWS} records`,
        details: null,
      });
    const blocked: { id: string; reason: string }[] = [];
    const archivable: string[] = [];
    if (!definition.dependencyCheck) archivable.push(...ids);
    else {
      /* One or two counts per row, and a resource can hand this nine
         thousand of them: run sequentially that is twenty thousand round
         trips and the request is gone long before the last one. Eight at a
         time is the ceiling the facet counts settled on against the same
         database. */
      const gate = createLimiter(ARCHIVE_CHECK_CONCURRENCY);
      const checks = await Promise.all(
        ids.map((id) =>
          gate(async () => ({
            id,
            reason: await definition.dependencyCheck!(id, this.prisma),
          })),
        ),
      );
      for (const check of checks) {
        if (check.reason) blocked.push({ id: check.id, reason: check.reason });
        else archivable.push(check.id);
      }
    }
    if (archivable.length === 0)
      throw new NotFoundException({
        code: 'NO_RECORDS_ARCHIVABLE',
        message: 'None of the selected records could be archived',
        details: null,
      });
    const deletedAt = new Date();
    /**
     * A country's name, slug and ISO codes are each unique together with its
     * `deletedKey`, which is empty while the row is live. Archiving without
     * filling that key leaves the pair ("algeria", "") in the index, so the
     * slug stays taken and the country can never be created again -- not by
     * hand and not by the import that put it there. The editor's own delete
     * has always filled it; this is the same soft delete, so it fills it too.
     *
     * Written one row at a time because each row's key is its own id, which
     * `updateMany` cannot express.
     */
    const result = definition.releasesUniqueKeys
      ? {
          count: (
            await this.prisma.$transaction(
              archivable.map((id) =>
                table.updateMany({
                  where: { id, deletedAt: null },
                  data: { deletedAt, status: 'ARCHIVED', deletedKey: id },
                }),
              ),
            )
          ).reduce((sum: number, one: { count: number }) => sum + one.count, 0),
        }
      : /* Chunked, because `IN (...)` with nine thousand ids is one
           statement the server may refuse outright on packet size. */
        {
          count: (
            await Promise.all(
              chunk(archivable, ARCHIVE_WRITE_CHUNK).map((part) =>
                table.updateMany({
                  where: { id: { in: part }, deletedAt: null },
                  data: { deletedAt, status: 'ARCHIVED' },
                }),
              ),
            )
          ).reduce((sum: number, one: { count: number }) => sum + one.count, 0),
        };
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
