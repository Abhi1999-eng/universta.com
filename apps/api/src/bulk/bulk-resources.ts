import { slugify } from '../catalog/catalog.constants';
import type { PrismaService } from '../prisma/prisma.service';

export type BulkRow = Record<string, string>;
export type BulkParseResult =
  | { data: Record<string, unknown>; errors?: undefined }
  | { data?: undefined; errors: string[] };

export interface BulkResourceDefinition {
  key: string;
  label: string;
  /** Prisma delegate name for this resource, used generically by the service. */
  model: 'country' | 'state' | 'city' | 'subject' | 'course' | 'job' | 'event';
  /** Column used to match an existing row for upsert/export identity. */
  uniqueColumn: 'slug';
  columns: string[];
  requiredColumns: string[];
  exampleRow: BulkRow;
  /** Update-mode-only editable columns (excludes identity/relation columns
   * that bulk *update* should never silently move a record between, even
   * though CSV *import* create mode does resolve them). */
  updatableColumns: string[];
  parseRow(row: BulkRow, prisma: PrismaService): Promise<BulkParseResult>;
  toExportRow(record: Record<string, unknown>): Record<string, unknown>;
  /** Returns a human-readable reason the row can't be archived (e.g. "3
   * cities still reference this state"), or null if it's safe to archive. */
  dependencyCheck?(id: string, prisma: PrismaService): Promise<string | null>;
}

function slugOrFallback(row: BulkRow, fallbackSource: string) {
  return row.slug?.trim() || slugify(fallbackSource);
}

const countries: BulkResourceDefinition = {
  key: 'countries',
  label: 'Countries',
  model: 'country',
  uniqueColumn: 'slug',
  columns: [
    'slug',
    'name',
    'continentSlug',
    'pageHeading',
    'shortDescription',
    'iso2Code',
    'iso3Code',
    'status',
  ],
  requiredColumns: ['name', 'continentSlug', 'pageHeading', 'shortDescription'],
  exampleRow: {
    slug: '',
    name: 'Demo Country',
    continentSlug: 'asia',
    pageHeading: 'Study in Demo Country',
    shortDescription:
      'A fictional demo country used only to show the expected import shape.',
    iso2Code: '',
    iso3Code: '',
    status: 'DRAFT',
  },
  updatableColumns: [
    'name',
    'pageHeading',
    'shortDescription',
    'iso2Code',
    'iso3Code',
    'status',
  ],
  async parseRow(row, prisma) {
    const errors: string[] = [];
    if (!row.name?.trim()) errors.push('name is required');
    if (!row.pageHeading?.trim()) errors.push('pageHeading is required');
    if (!row.shortDescription?.trim())
      errors.push('shortDescription is required');
    const continent = row.continentSlug?.trim()
      ? await prisma.continent.findFirst({
          where: { slug: row.continentSlug.trim(), deletedAt: null },
        })
      : null;
    if (!continent)
      errors.push(`continentSlug "${row.continentSlug}" was not found`);
    if (errors.length) return { errors };
    return {
      data: {
        slug: slugOrFallback(row, row.name),
        name: row.name.trim(),
        continentId: continent!.id,
        pageHeading: row.pageHeading.trim(),
        shortDescription: row.shortDescription.trim(),
        iso2Code: row.iso2Code?.trim() || null,
        iso3Code: row.iso3Code?.trim() || null,
        status: row.status?.trim() || 'DRAFT',
      },
    };
  },
  toExportRow(record) {
    return {
      slug: record.slug,
      name: record.name,
      continentSlug:
        (record as { continent?: { slug?: string } }).continent?.slug ?? '',
      pageHeading: record.pageHeading,
      shortDescription: record.shortDescription,
      iso2Code: record.iso2Code ?? '',
      iso3Code: record.iso3Code ?? '',
      status: record.status,
    };
  },
};

const states: BulkResourceDefinition = {
  key: 'states',
  label: 'States / provinces',
  model: 'state',
  uniqueColumn: 'slug',
  columns: ['slug', 'name', 'countrySlug', 'status', 'displayOrder'],
  requiredColumns: ['name', 'countrySlug'],
  exampleRow: {
    slug: '',
    name: 'Demo Province',
    countrySlug: 'demo-country',
    status: 'DRAFT',
    displayOrder: '0',
  },
  updatableColumns: ['name', 'status', 'displayOrder'],
  async parseRow(row, prisma) {
    const errors: string[] = [];
    if (!row.name?.trim()) errors.push('name is required');
    const country = row.countrySlug?.trim()
      ? await prisma.country.findFirst({
          where: { slug: row.countrySlug.trim(), deletedAt: null },
        })
      : null;
    if (!country) errors.push(`countrySlug "${row.countrySlug}" was not found`);
    if (errors.length) return { errors };
    return {
      data: {
        slug: slugOrFallback(row, row.name),
        name: row.name.trim(),
        countryId: country!.id,
        status: row.status?.trim() || 'DRAFT',
        displayOrder: Number(row.displayOrder) || 0,
      },
    };
  },
  toExportRow(record) {
    return {
      slug: record.slug,
      name: record.name,
      countrySlug:
        (record as { country?: { slug?: string } }).country?.slug ?? '',
      status: record.status,
      displayOrder: record.displayOrder,
    };
  },
  async dependencyCheck(id, prisma) {
    const count = await prisma.city.count({
      where: { stateId: id, deletedAt: null },
    });
    return count > 0
      ? `${count} cit${count === 1 ? 'y' : 'ies'} still reference this state`
      : null;
  },
};

const cities: BulkResourceDefinition = {
  key: 'cities',
  label: 'Cities',
  model: 'city',
  uniqueColumn: 'slug',
  columns: [
    'slug',
    'name',
    'countrySlug',
    'stateSlug',
    'shortDescription',
    'isFeatured',
    'status',
    'displayOrder',
  ],
  requiredColumns: ['name', 'countrySlug'],
  exampleRow: {
    slug: '',
    name: 'Demo City',
    countrySlug: 'demo-country',
    stateSlug: '',
    shortDescription:
      'A fictional demo city used only to show the expected import shape.',
    isFeatured: 'false',
    status: 'DRAFT',
    displayOrder: '0',
  },
  updatableColumns: [
    'name',
    'shortDescription',
    'isFeatured',
    'status',
    'displayOrder',
  ],
  async parseRow(row, prisma) {
    const errors: string[] = [];
    if (!row.name?.trim()) errors.push('name is required');
    const country = row.countrySlug?.trim()
      ? await prisma.country.findFirst({
          where: { slug: row.countrySlug.trim(), deletedAt: null },
        })
      : null;
    if (!country) errors.push(`countrySlug "${row.countrySlug}" was not found`);
    let stateId: string | null = null;
    if (row.stateSlug?.trim() && country) {
      const state = await prisma.state.findFirst({
        where: {
          slug: row.stateSlug.trim(),
          countryId: country.id,
          deletedAt: null,
        },
      });
      if (!state)
        errors.push(
          `stateSlug "${row.stateSlug}" was not found for this country`,
        );
      else stateId = state.id;
    }
    if (errors.length) return { errors };
    return {
      data: {
        slug: slugOrFallback(row, row.name),
        name: row.name.trim(),
        countryId: country!.id,
        stateId,
        shortDescription: row.shortDescription?.trim() || null,
        isFeatured: row.isFeatured?.trim().toLowerCase() === 'true',
        status: row.status?.trim() || 'DRAFT',
        displayOrder: Number(row.displayOrder) || 0,
      },
    };
  },
  toExportRow(record) {
    return {
      slug: record.slug,
      name: record.name,
      countrySlug:
        (record as { country?: { slug?: string } }).country?.slug ?? '',
      stateSlug:
        (record as { state?: { slug?: string } | null }).state?.slug ?? '',
      shortDescription: record.shortDescription ?? '',
      isFeatured: record.isFeatured,
      status: record.status,
      displayOrder: record.displayOrder,
    };
  },
};

const subjects: BulkResourceDefinition = {
  key: 'subjects',
  label: 'Subjects',
  model: 'subject',
  uniqueColumn: 'slug',
  columns: [
    'slug',
    'name',
    'shortDescription',
    'isFeatured',
    'status',
    'displayOrder',
  ],
  requiredColumns: ['name'],
  exampleRow: {
    slug: '',
    name: 'Demo Subject',
    shortDescription:
      'A fictional demo subject used only to show the expected import shape.',
    isFeatured: 'false',
    status: 'DRAFT',
    displayOrder: '0',
  },
  updatableColumns: [
    'name',
    'shortDescription',
    'isFeatured',
    'status',
    'displayOrder',
  ],
  async parseRow(row) {
    if (!row.name?.trim()) return { errors: ['name is required'] };
    return {
      data: {
        slug: slugOrFallback(row, row.name),
        name: row.name.trim(),
        shortDescription: row.shortDescription?.trim() || null,
        isFeatured: row.isFeatured?.trim().toLowerCase() === 'true',
        status: row.status?.trim() || 'DRAFT',
        displayOrder: Number(row.displayOrder) || 0,
      },
    };
  },
  toExportRow(record) {
    return {
      slug: record.slug,
      name: record.name,
      shortDescription: record.shortDescription ?? '',
      isFeatured: record.isFeatured,
      status: record.status,
      displayOrder: record.displayOrder,
    };
  },
};

const courses: BulkResourceDefinition = {
  key: 'courses',
  label: 'Generic courses',
  model: 'course',
  uniqueColumn: 'slug',
  columns: [
    'slug',
    'name',
    'subjectSlug',
    'courseLevelCode',
    'shortDescription',
    'isFeatured',
    'status',
  ],
  requiredColumns: ['name', 'subjectSlug', 'courseLevelCode'],
  exampleRow: {
    slug: '',
    name: 'Demo Course',
    subjectSlug: 'demo-subject',
    courseLevelCode: 'UG',
    shortDescription:
      'A fictional demo course used only to show the expected import shape.',
    isFeatured: 'false',
    status: 'DRAFT',
  },
  updatableColumns: ['name', 'shortDescription', 'isFeatured', 'status'],
  async parseRow(row, prisma) {
    const errors: string[] = [];
    if (!row.name?.trim()) errors.push('name is required');
    const subject = row.subjectSlug?.trim()
      ? await prisma.subject.findFirst({
          where: { slug: row.subjectSlug.trim(), deletedAt: null },
        })
      : null;
    if (!subject) errors.push(`subjectSlug "${row.subjectSlug}" was not found`);
    const courseLevel = row.courseLevelCode?.trim()
      ? await prisma.courseLevel.findFirst({
          where: { code: row.courseLevelCode.trim() },
        })
      : null;
    if (!courseLevel)
      errors.push(`courseLevelCode "${row.courseLevelCode}" was not found`);
    if (errors.length) return { errors };
    return {
      data: {
        slug: slugOrFallback(row, row.name),
        name: row.name.trim(),
        subjectId: subject!.id,
        courseLevelId: courseLevel!.id,
        shortDescription: row.shortDescription?.trim() || null,
        isFeatured: row.isFeatured?.trim().toLowerCase() === 'true',
        status: row.status?.trim() || 'DRAFT',
      },
    };
  },
  toExportRow(record) {
    return {
      slug: record.slug,
      name: record.name,
      subjectSlug:
        (record as { subject?: { slug?: string } }).subject?.slug ?? '',
      courseLevelCode:
        (record as { courseLevel?: { code?: string } }).courseLevel?.code ?? '',
      shortDescription: record.shortDescription ?? '',
      isFeatured: record.isFeatured,
      status: record.status,
    };
  },
};

const jobs: BulkResourceDefinition = {
  key: 'jobs',
  label: 'Careers / jobs',
  model: 'job',
  uniqueColumn: 'slug',
  columns: [
    'slug',
    'title',
    'department',
    'employmentType',
    'location',
    'remoteStatus',
    'summary',
    'status',
  ],
  requiredColumns: ['title'],
  exampleRow: {
    slug: '',
    title: 'Demo Role',
    department: 'Operations',
    employmentType: 'FULL_TIME',
    location: 'Remote',
    remoteStatus: 'REMOTE',
    summary:
      'A fictional demo role used only to show the expected import shape.',
    status: 'DRAFT',
  },
  updatableColumns: [
    'title',
    'department',
    'employmentType',
    'location',
    'remoteStatus',
    'summary',
    'status',
  ],
  async parseRow(row) {
    if (!row.title?.trim()) return { errors: ['title is required'] };
    return {
      data: {
        slug: slugOrFallback(row, row.title),
        title: row.title.trim(),
        department: row.department?.trim() || null,
        employmentType: row.employmentType?.trim() || null,
        location: row.location?.trim() || null,
        remoteStatus: row.remoteStatus?.trim() || null,
        summary: row.summary?.trim() || null,
        status: row.status?.trim() || 'DRAFT',
      },
    };
  },
  toExportRow(record) {
    return {
      slug: record.slug,
      title: record.title,
      department: record.department ?? '',
      employmentType: record.employmentType ?? '',
      location: record.location ?? '',
      remoteStatus: record.remoteStatus ?? '',
      summary: record.summary ?? '',
      status: record.status,
    };
  },
};

const events: BulkResourceDefinition = {
  key: 'events',
  label: 'Events',
  model: 'event',
  uniqueColumn: 'slug',
  columns: [
    'slug',
    'title',
    'startsAt',
    'endsAt',
    'eventType',
    'venue',
    'onlineUrl',
    'summary',
    'status',
  ],
  requiredColumns: ['title', 'startsAt'],
  exampleRow: {
    slug: '',
    title: 'Demo Info Session',
    startsAt: '2026-09-01T10:00:00.000Z',
    endsAt: '',
    eventType: 'ONLINE',
    venue: '',
    onlineUrl: 'https://example.com/demo-session',
    summary:
      'A fictional demo event used only to show the expected import shape.',
    status: 'DRAFT',
  },
  updatableColumns: [
    'title',
    'endsAt',
    'eventType',
    'venue',
    'onlineUrl',
    'summary',
    'status',
  ],
  async parseRow(row) {
    const errors: string[] = [];
    if (!row.title?.trim()) errors.push('title is required');
    const startsAt = row.startsAt?.trim()
      ? new Date(row.startsAt.trim())
      : null;
    if (!startsAt || Number.isNaN(startsAt.valueOf()))
      errors.push('startsAt must be a valid ISO date');
    const endsAt = row.endsAt?.trim() ? new Date(row.endsAt.trim()) : null;
    if (row.endsAt?.trim() && (!endsAt || Number.isNaN(endsAt.valueOf())))
      errors.push('endsAt must be a valid ISO date');
    if (errors.length) return { errors };
    return {
      data: {
        slug: slugOrFallback(row, row.title),
        title: row.title.trim(),
        startsAt: startsAt!,
        endsAt: endsAt ?? null,
        eventType: row.eventType?.trim() || 'OFFLINE',
        venue: row.venue?.trim() || null,
        onlineUrl: row.onlineUrl?.trim() || null,
        summary: row.summary?.trim() || null,
        status: row.status?.trim() || 'DRAFT',
      },
    };
  },
  toExportRow(record) {
    return {
      slug: record.slug,
      title: record.title,
      startsAt: (record.startsAt as Date)?.toISOString?.() ?? '',
      endsAt: (record.endsAt as Date | null)?.toISOString?.() ?? '',
      eventType: record.eventType,
      venue: record.venue ?? '',
      onlineUrl: record.onlineUrl ?? '',
      summary: record.summary ?? '',
      status: record.status,
    };
  },
};

/** Wired resources for Milestone 8. Universities, Campuses, University
 * Course Offerings, Scholarships and Consultants are deliberately not
 * registered yet — their multi-entity relational shape (campus/provider/
 * intake/requirement graphs) needs a materially larger per-resource mapper
 * than the flat-to-single-FK cases here, and wiring them with the same
 * care given to these seven would not fit this milestone. The underlying
 * engine (parse/dry-run/import/export/bulk-update/bulk-archive, file
 * security) is fully generic — extending coverage is a matter of adding
 * another BulkResourceDefinition, not new engine work. */
export const BULK_RESOURCES: Record<string, BulkResourceDefinition> = {
  countries,
  states,
  cities,
  subjects,
  courses,
  jobs,
  events,
};

export function bulkResource(key: string): BulkResourceDefinition {
  const definition = BULK_RESOURCES[key];
  if (!definition) throw new Error(`Unknown bulk resource: ${key}`);
  return definition;
}
