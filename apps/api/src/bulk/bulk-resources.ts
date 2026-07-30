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
  model:
    | 'country'
    | 'state'
    | 'city'
    | 'subject'
    | 'course'
    | 'job'
    | 'event'
    | 'university'
    | 'universityCampus'
    | 'universityCourseOffering'
    | 'scholarship'
    | 'consultant'
    | 'consultantLocation';
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

const universities: BulkResourceDefinition = {
  key: 'universities',
  label: 'Universities',
  model: 'university',
  uniqueColumn: 'slug',
  columns: [
    'slug',
    'name',
    'countrySlug',
    'institutionType',
    'shortDescription',
    'status',
  ],
  requiredColumns: ['name', 'countrySlug', 'shortDescription'],
  exampleRow: {
    slug: '',
    name: 'Demo University',
    countrySlug: 'canada',
    institutionType: 'PUBLIC',
    shortDescription:
      'A fictional demo university used only to show the expected import shape.',
    status: 'DRAFT',
  },
  updatableColumns: ['name', 'institutionType', 'shortDescription', 'status'],
  async parseRow(row, prisma) {
    const errors: string[] = [];
    if (!row.name?.trim()) errors.push('name is required');
    if (!row.shortDescription?.trim())
      errors.push('shortDescription is required');
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
        institutionType: row.institutionType?.trim() || null,
        shortDescription: row.shortDescription.trim(),
        status: row.status?.trim() || 'DRAFT',
      },
    };
  },
  toExportRow(record) {
    return {
      slug: record.slug,
      name: record.name,
      countrySlug:
        (record as { country?: { slug?: string } }).country?.slug ?? '',
      institutionType: record.institutionType ?? '',
      shortDescription: record.shortDescription ?? '',
      status: record.status,
    };
  },
  async dependencyCheck(id, prisma) {
    const [campuses, offerings] = await Promise.all([
      prisma.universityCampus.count({
        where: { universityId: id, deletedAt: null },
      }),
      prisma.universityCourseOffering.count({
        where: { universityId: id, deletedAt: null },
      }),
    ]);
    if (campuses || offerings)
      return `${campuses} campus(es) and ${offerings} course offering(s) still belong to this university`;
    return null;
  },
};

/** UniversityCampus.slug is only unique per-university in the schema
 * (`@@unique([universityId, slug])`), but this bulk engine's identity
 * lookup is a flat global slug match (see BulkOperationsService#import).
 * A blank slug is therefore always generated with the university's own
 * slug as a prefix so two different universities' campuses can never
 * collide; an admin who supplies an explicit slug is responsible for
 * keeping it globally unique for bulk-import purposes. */
const campuses: BulkResourceDefinition = {
  key: 'campuses',
  label: 'University campuses',
  model: 'universityCampus',
  uniqueColumn: 'slug',
  columns: [
    'slug',
    'name',
    'universitySlug',
    'city',
    'state',
    'address',
    'status',
  ],
  requiredColumns: ['name', 'universitySlug', 'city'],
  exampleRow: {
    slug: '',
    name: 'Main Campus',
    universitySlug: 'demo-university',
    city: 'Toronto',
    state: 'Ontario',
    address: '',
    status: 'ACTIVE',
  },
  updatableColumns: ['name', 'city', 'state', 'address', 'status'],
  async parseRow(row, prisma) {
    const errors: string[] = [];
    if (!row.name?.trim()) errors.push('name is required');
    if (!row.city?.trim()) errors.push('city is required');
    const university = row.universitySlug?.trim()
      ? await prisma.university.findFirst({
          where: { slug: row.universitySlug.trim(), deletedAt: null },
        })
      : null;
    if (!university)
      errors.push(`universitySlug "${row.universitySlug}" was not found`);
    if (errors.length) return { errors };
    const slug = row.slug?.trim() || `${university!.slug}-${slugify(row.name)}`;
    return {
      data: {
        slug,
        name: row.name.trim(),
        universityId: university!.id,
        city: row.city.trim(),
        state: row.state?.trim() || null,
        address: row.address?.trim() || null,
        status: row.status?.trim() || 'ACTIVE',
      },
    };
  },
  toExportRow(record) {
    return {
      slug: record.slug,
      name: record.name,
      universitySlug:
        (record as { university?: { slug?: string } }).university?.slug ?? '',
      city: record.city ?? '',
      state: record.state ?? '',
      address: record.address ?? '',
      status: record.status,
    };
  },
  async dependencyCheck(id, prisma) {
    const offerings = await prisma.universityCourseOffering.count({
      where: { campusId: id, deletedAt: null },
    });
    if (offerings)
      return `${offerings} course offering(s) still use this campus`;
    return null;
  },
};

const offerings: BulkResourceDefinition = {
  key: 'offerings',
  label: 'University course offerings',
  model: 'universityCourseOffering',
  uniqueColumn: 'slug',
  columns: [
    'slug',
    'name',
    'universitySlug',
    'genericCourseSlug',
    'campusSlug',
    'courseLevelCode',
    'studyMode',
    'currencyCode',
    'tuitionMin',
    'tuitionMax',
    'status',
  ],
  requiredColumns: ['name', 'universitySlug', 'genericCourseSlug'],
  exampleRow: {
    slug: '',
    name: 'Bachelor of Demo Studies',
    universitySlug: 'demo-university',
    genericCourseSlug: 'demo-subject-course',
    campusSlug: '',
    courseLevelCode: 'UG',
    studyMode: 'FULL_TIME',
    currencyCode: 'CAD',
    tuitionMin: '18000',
    tuitionMax: '22000',
    status: 'DRAFT',
  },
  updatableColumns: [
    'name',
    'studyMode',
    'currencyCode',
    'tuitionMin',
    'tuitionMax',
    'status',
  ],
  async parseRow(row, prisma) {
    const errors: string[] = [];
    if (!row.name?.trim()) errors.push('name is required');
    const university = row.universitySlug?.trim()
      ? await prisma.university.findFirst({
          where: { slug: row.universitySlug.trim(), deletedAt: null },
        })
      : null;
    if (!university)
      errors.push(`universitySlug "${row.universitySlug}" was not found`);
    const genericCourse = row.genericCourseSlug?.trim()
      ? await prisma.course.findFirst({
          where: { slug: row.genericCourseSlug.trim(), deletedAt: null },
        })
      : null;
    if (!genericCourse)
      errors.push(`genericCourseSlug "${row.genericCourseSlug}" was not found`);
    let campusId: string | null = null;
    if (row.campusSlug?.trim() && university) {
      const campus = await prisma.universityCampus.findFirst({
        where: {
          slug: row.campusSlug.trim(),
          universityId: university.id,
          deletedAt: null,
        },
      });
      if (!campus)
        errors.push(
          `campusSlug "${row.campusSlug}" was not found for this university`,
        );
      else campusId = campus.id;
    }
    let courseLevelId: string | null = null;
    if (row.courseLevelCode?.trim()) {
      const courseLevel = await prisma.courseLevel.findFirst({
        where: { code: row.courseLevelCode.trim() },
      });
      if (!courseLevel)
        errors.push(`courseLevelCode "${row.courseLevelCode}" was not found`);
      else courseLevelId = courseLevel.id;
    }
    const tuitionMin = row.tuitionMin?.trim() ? Number(row.tuitionMin) : null;
    if (row.tuitionMin?.trim() && Number.isNaN(tuitionMin))
      errors.push('tuitionMin must be a number');
    const tuitionMax = row.tuitionMax?.trim() ? Number(row.tuitionMax) : null;
    if (row.tuitionMax?.trim() && Number.isNaN(tuitionMax))
      errors.push('tuitionMax must be a number');
    if (errors.length) return { errors };
    return {
      data: {
        slug: slugOrFallback(row, row.name),
        name: row.name.trim(),
        universityId: university!.id,
        genericCourseId: genericCourse!.id,
        campusId,
        courseLevelId,
        studyMode: row.studyMode?.trim() || null,
        currencyCode: row.currencyCode?.trim() || null,
        tuitionMin,
        tuitionMax,
        status: row.status?.trim() || 'DRAFT',
      },
    };
  },
  toExportRow(record) {
    return {
      slug: record.slug,
      name: record.name,
      universitySlug:
        (record as { university?: { slug?: string } }).university?.slug ?? '',
      genericCourseSlug:
        (record as { genericCourse?: { slug?: string } }).genericCourse?.slug ??
        '',
      campusSlug: (record as { campus?: { slug?: string } }).campus?.slug ?? '',
      courseLevelCode:
        (record as { courseLevel?: { code?: string } }).courseLevel?.code ?? '',
      studyMode: record.studyMode ?? '',
      currencyCode: record.currencyCode ?? '',
      tuitionMin: record.tuitionMin ?? '',
      tuitionMax: record.tuitionMax ?? '',
      status: record.status,
    };
  },
};

const scholarships: BulkResourceDefinition = {
  key: 'scholarships',
  label: 'Scholarships',
  model: 'scholarship',
  uniqueColumn: 'slug',
  columns: [
    'slug',
    'title',
    'providerSlug',
    'summary',
    'benefitType',
    'amount',
    'currencyCode',
    'deadline',
    'status',
  ],
  requiredColumns: ['title'],
  exampleRow: {
    slug: '',
    title: 'Demo Merit Scholarship',
    providerSlug: '',
    summary:
      'A fictional demo scholarship used only to show the expected import shape.',
    benefitType: 'PARTIAL_TUITION',
    amount: '5000',
    currencyCode: 'USD',
    deadline: '',
    status: 'DRAFT',
  },
  updatableColumns: [
    'title',
    'summary',
    'benefitType',
    'amount',
    'currencyCode',
    'deadline',
    'status',
  ],
  async parseRow(row, prisma) {
    const errors: string[] = [];
    if (!row.title?.trim()) errors.push('title is required');
    let providerId: string | null = null;
    if (row.providerSlug?.trim()) {
      const provider = await prisma.scholarshipProvider.findFirst({
        where: { slug: row.providerSlug.trim(), deletedAt: null },
      });
      if (!provider)
        errors.push(`providerSlug "${row.providerSlug}" was not found`);
      else providerId = provider.id;
    }
    const amount = row.amount?.trim() ? Number(row.amount) : null;
    if (row.amount?.trim() && Number.isNaN(amount))
      errors.push('amount must be a number');
    const deadline = row.deadline?.trim()
      ? new Date(row.deadline.trim())
      : null;
    if (row.deadline?.trim() && (!deadline || Number.isNaN(deadline.valueOf())))
      errors.push('deadline must be a valid date');
    if (errors.length) return { errors };
    return {
      data: {
        slug: slugOrFallback(row, row.title),
        title: row.title.trim(),
        providerId,
        summary: row.summary?.trim() || null,
        benefitType: row.benefitType?.trim() || null,
        amount,
        currencyCode: row.currencyCode?.trim() || null,
        deadline,
        status: row.status?.trim() || 'DRAFT',
      },
    };
  },
  toExportRow(record) {
    return {
      slug: record.slug,
      title: record.title,
      providerSlug:
        (record as { provider?: { slug?: string } }).provider?.slug ?? '',
      summary: record.summary ?? '',
      benefitType: record.benefitType ?? '',
      amount: record.amount ?? '',
      currencyCode: record.currencyCode ?? '',
      deadline: (record.deadline as Date | null)?.toISOString?.() ?? '',
      status: record.status,
    };
  },
};

const consultants: BulkResourceDefinition = {
  key: 'consultants',
  label: 'Consultants',
  model: 'consultant',
  uniqueColumn: 'slug',
  columns: [
    'slug',
    'name',
    'email',
    'phone',
    'websiteUrl',
    'verificationStatus',
    'shortDescription',
    'status',
  ],
  requiredColumns: ['name'],
  exampleRow: {
    slug: '',
    name: 'Demo Consultancy',
    email: 'contact@example.com',
    phone: '',
    websiteUrl: 'https://example.com',
    verificationStatus: 'UNVERIFIED',
    shortDescription:
      'A fictional demo consultancy used only to show the expected import shape.',
    status: 'DRAFT',
  },
  updatableColumns: [
    'name',
    'email',
    'phone',
    'websiteUrl',
    'verificationStatus',
    'shortDescription',
    'status',
  ],
  async parseRow(row) {
    if (!row.name?.trim()) return { errors: ['name is required'] };
    return {
      data: {
        slug: slugOrFallback(row, row.name),
        name: row.name.trim(),
        email: row.email?.trim() || null,
        phone: row.phone?.trim() || null,
        websiteUrl: row.websiteUrl?.trim() || null,
        verificationStatus: row.verificationStatus?.trim() || 'UNVERIFIED',
        shortDescription: row.shortDescription?.trim() || null,
        status: row.status?.trim() || 'DRAFT',
      },
    };
  },
  toExportRow(record) {
    return {
      slug: record.slug,
      name: record.name,
      email: record.email ?? '',
      phone: record.phone ?? '',
      websiteUrl: record.websiteUrl ?? '',
      verificationStatus: record.verificationStatus,
      shortDescription: record.shortDescription ?? '',
      status: record.status,
    };
  },
};

const consultantLocations: BulkResourceDefinition = {
  key: 'consultant-locations',
  label: 'Consultant locations',
  model: 'consultantLocation',
  uniqueColumn: 'slug',
  columns: [
    'slug',
    'name',
    'city',
    'state',
    'countrySlug',
    'overview',
    'status',
  ],
  requiredColumns: ['name', 'city'],
  exampleRow: {
    slug: '',
    name: 'Demo City Branch',
    city: 'Toronto',
    state: 'Ontario',
    countrySlug: 'canada',
    overview: '',
    status: 'ACTIVE',
  },
  updatableColumns: ['name', 'city', 'state', 'overview', 'status'],
  async parseRow(row, prisma) {
    const errors: string[] = [];
    if (!row.name?.trim()) errors.push('name is required');
    if (!row.city?.trim()) errors.push('city is required');
    let countryId: string | null = null;
    if (row.countrySlug?.trim()) {
      const country = await prisma.country.findFirst({
        where: { slug: row.countrySlug.trim(), deletedAt: null },
      });
      if (!country)
        errors.push(`countrySlug "${row.countrySlug}" was not found`);
      else countryId = country.id;
    }
    if (errors.length) return { errors };
    return {
      data: {
        slug: slugOrFallback(row, row.name),
        name: row.name.trim(),
        city: row.city.trim(),
        state: row.state?.trim() || null,
        countryId,
        overview: row.overview?.trim() || null,
        status: row.status?.trim() || 'ACTIVE',
      },
    };
  },
  toExportRow(record) {
    return {
      slug: record.slug,
      name: record.name,
      city: record.city ?? '',
      state: record.state ?? '',
      countrySlug:
        (record as { country?: { slug?: string } }).country?.slug ?? '',
      overview: record.overview ?? '',
      status: record.status,
    };
  },
  async dependencyCheck(id, prisma) {
    const mapped = await prisma.consultantLocationMap.count({
      where: { locationId: id },
    });
    if (mapped)
      return `${mapped} consultant(s) are still linked to this location`;
    return null;
  },
};

/** All 13 resources named in the Phase 1 bulk-management scope are now
 * registered. The underlying engine (parse/dry-run/import/export/
 * bulk-update/bulk-archive, file security) is fully generic -- each entry
 * below is only a column/relation mapping, no engine code. Deliberately
 * out of scope for every resource, matching the existing seven: many-to-
 * many assignment (e.g. a scholarship's eligible countries/universities,
 * a consultant's services/languages/serviced countries) stays a
 * structured-editor-only concern, consistent with how `courses` here
 * already leaves its own many-to-many `countries` relation unmanaged by
 * bulk CSV. */
export const BULK_RESOURCES: Record<string, BulkResourceDefinition> = {
  countries,
  states,
  cities,
  subjects,
  courses,
  jobs,
  events,
  universities,
  campuses,
  offerings,
  scholarships,
  consultants,
  'consultant-locations': consultantLocations,
};

export function bulkResource(key: string): BulkResourceDefinition {
  const definition = BULK_RESOURCES[key];
  if (!definition) throw new Error(`Unknown bulk resource: ${key}`);
  return definition;
}
