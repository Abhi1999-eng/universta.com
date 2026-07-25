import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  isUniqueConstraintError,
  paginationMeta,
  slugify,
} from '../catalog/catalog.constants';
import { writeAudit } from '../catalog/catalog.audit';
import type { AuthenticatedRequest } from '../auth/auth.types';
import type {
  CountryActionDto,
  CountryListQueryDto,
  CreateCountryDto,
  DirectoryQueryDto,
  SuggestionsQueryDto,
  UpdateCountryDto,
} from './dto/country.dto';
import { PROFILE_INCLUDE } from './profiles/country-profiles.service';
import {
  publicProfileSummary,
  type ProfileBundle,
  type ProfileStatisticsRecord,
} from './profiles/profile.mappers';
import { PUBLIC_INTAKE_AVAILABILITY } from './profiles/profile.constants';

const COUNTRY_INCLUDE = {
  continent: {
    select: { id: true, name: true, slug: true, status: true, deletedAt: true },
  },
  flagMedia: {
    select: { publicUrl: true, altText: true, status: true, deletedAt: true },
  },
  ...PROFILE_INCLUDE,
} satisfies Prisma.CountryInclude;

type CountryRecord = {
  id: string;
  continentId: string;
  name: string;
  pageHeading: string;
  slug: string;
  iso2Code: string | null;
  iso3Code: string | null;
  shortDescription: string;
  isFeatured: boolean;
  displayOrder: number;
  status: string;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  continent: {
    id: string;
    name: string;
    slug: string;
    status: string;
    deletedAt: Date | null;
  };
  flagMedia: {
    publicUrl: string;
    altText: string | null;
    status: string;
    deletedAt: Date | null;
  } | null;
  statistics: ProfileStatisticsRecord | null;
} & ProfileBundle;

export interface FlagDto {
  url: string;
  alt: string;
}

export interface CountryPublicDto {
  id: string;
  name: string;
  slug: string;
  pageHeading: string;
  shortDescription: string;
  continent: { id: string; name: string; slug: string };
  flag: FlagDto | null;
  featured: boolean;
  displayOrder: number;
  statistics: { universitiesCount: number | null } | null;
  profiles: ReturnType<typeof publicProfileSummary>;
}

export interface CountryAdminDto extends CountryPublicDto {
  iso2Code: string | null;
  iso3Code: string | null;
  status: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function actorId(request: AuthenticatedRequest): string {
  const id = request.user?.sub;
  if (!id) {
    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message: 'Super Admin access is required',
      details: null,
    });
  }
  return id;
}

function conflict(code: string, message: string): ConflictException {
  return new ConflictException({ code, message, details: null });
}

function notFound(): NotFoundException {
  return new NotFoundException({
    code: 'COUNTRY_NOT_FOUND',
    message: 'Country not found',
    details: null,
  });
}

function isVerifiedStatistics(
  statistics: CountryRecord['statistics'],
): boolean {
  return Boolean(statistics?.verifiedAt && statistics.sourceReference);
}

@Injectable()
export class CountriesService {
  constructor(private readonly prisma: PrismaService) {}

  async publicList(query: CountryListQueryDto) {
    const where = this.publicWhere(query);
    const [total, countries] = await Promise.all([
      this.prisma.country.count({ where }),
      this.prisma.country.findMany({
        where,
        include: COUNTRY_INCLUDE,
        orderBy: this.publicOrderBy(query.sort),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);
    return {
      data: countries.map((country) =>
        this.toPublic(country as unknown as CountryRecord),
      ),
      meta: paginationMeta(query.page, query.limit, total),
    };
  }

  async suggestions(query: SuggestionsQueryDto) {
    const q = query.q.trim();
    const countries = await this.prisma.country.findMany({
      where: {
        ...this.publicWhere({ q }),
      },
      include: COUNTRY_INCLUDE,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: query.limit,
    });
    return countries.map((country) => {
      const record = country as unknown as CountryRecord;
      return {
        id: record.id,
        name: record.name,
        slug: record.slug,
        flag: this.flag(record),
        continent: this.continent(record),
        universitiesCount: isVerifiedStatistics(record.statistics)
          ? (record.statistics?.universitiesCount ?? null)
          : null,
        profiles: publicProfileSummary(record),
      };
    });
  }

  async directory(query: DirectoryQueryDto) {
    const where = {
      ...this.publicWhere(query),
      ...(query.letter ? { name: { startsWith: query.letter } } : {}),
    };
    const [total, countries] = await Promise.all([
      this.prisma.country.count({ where }),
      this.prisma.country.findMany({
        where,
        include: COUNTRY_INCLUDE,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);
    return {
      data: countries.map((country) => {
        const record = country as unknown as CountryRecord;
        const verified = isVerifiedStatistics(record.statistics);
        return {
          name: record.name,
          slug: record.slug,
          flag: this.flag(record),
          shortDescription: record.shortDescription,
          programCounts: verified
            ? {
                ug: record.statistics?.ugCoursesCount ?? null,
                pg: record.statistics?.pgCoursesCount ?? null,
                pgdm: record.statistics?.pgdmCoursesCount ?? null,
                mba: record.statistics?.mbaCoursesCount ?? null,
              }
            : { ug: null, pg: null, pgdm: null, mba: null },
          letter: record.name.slice(0, 1).toUpperCase(),
          isAvailable: true,
          profiles: publicProfileSummary(record),
        };
      }),
      meta: paginationMeta(query.page, query.limit, total),
    };
  }

  async publicDetail(slug: string): Promise<CountryPublicDto> {
    const country = await this.prisma.country.findFirst({
      where: {
        slug,
        status: 'PUBLISHED',
        deletedAt: null,
        continent: { status: 'ACTIVE', deletedAt: null },
      },
      include: COUNTRY_INCLUDE,
    });
    if (!country) throw notFound();
    return this.toPublic(country);
  }

  async adminList(query: CountryListQueryDto) {
    const where: Prisma.CountryWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.continentId ? { continentId: query.continentId } : {}),
      ...(query.featured !== undefined ? { isFeatured: query.featured } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q } },
              { slug: { contains: query.q } },
              { iso2Code: { contains: query.q } },
              { iso3Code: { contains: query.q } },
            ],
          }
        : {}),
    };
    const [total, countries] = await Promise.all([
      this.prisma.country.count({ where }),
      this.prisma.country.findMany({
        where,
        include: COUNTRY_INCLUDE,
        orderBy: this.adminOrderBy(query.sort),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);
    return {
      data: countries.map((country) =>
        this.toAdmin(country as unknown as CountryRecord),
      ),
      meta: paginationMeta(query.page, query.limit, total),
    };
  }

  async getAdmin(id: string): Promise<CountryAdminDto> {
    const country = await this.adminRecord(id);
    return this.toAdmin(country);
  }

  async create(
    dto: CreateCountryDto,
    request: AuthenticatedRequest,
  ): Promise<CountryAdminDto> {
    const userId = actorId(request);
    await this.ensureContinent(dto.continentId);
    const name = dto.name.trim();
    const slug = dto.slug?.trim() || slugify(name);
    await this.ensureUnique(name, slug, dto.iso2Code, dto.iso3Code);
    try {
      const country = await this.prisma.country.create({
        data: {
          continentId: dto.continentId,
          name,
          slug,
          iso2Code: dto.iso2Code?.trim().toUpperCase(),
          iso3Code: dto.iso3Code?.trim().toUpperCase(),
          pageHeading: dto.pageHeading.trim(),
          shortDescription: dto.shortDescription.trim(),
          isFeatured: dto.isFeatured ?? false,
          displayOrder: dto.displayOrder ?? 0,
          flagMediaId: dto.flagMediaId,
          status: 'DRAFT',
          createdByUserId: userId,
          updatedByUserId: userId,
        },
        include: COUNTRY_INCLUDE,
      });
      await writeAudit(
        this.prisma,
        request,
        userId,
        'CATALOG',
        'COUNTRY',
        country.id,
        'COUNTRY_CREATED',
        null,
        {
          name,
          slug,
          iso2Code: country.iso2Code,
          iso3Code: country.iso3Code,
          status: country.status,
        },
        'Country created',
      );
      return this.toAdmin(country);
    } catch (error) {
      this.throwUniqueConflict(error);
      throw error;
    }
  }

  async update(
    id: string,
    dto: UpdateCountryDto,
    request: AuthenticatedRequest,
  ): Promise<CountryAdminDto> {
    const userId = actorId(request);
    const current = await this.adminRecord(id);
    this.assertVersion(current.updatedAt, dto.expectedUpdatedAt);
    await this.ensureContinent(dto.continentId);
    const name = dto.name.trim();
    const slug = dto.slug?.trim() ?? current.slug;
    const iso2Code = dto.iso2Code?.trim().toUpperCase();
    const iso3Code = dto.iso3Code?.trim().toUpperCase();
    await this.ensureUnique(name, slug, iso2Code, iso3Code, id);
    const data: Prisma.CountryUncheckedUpdateInput = {
      continentId: dto.continentId,
      name,
      slug,
      iso2Code,
      iso3Code,
      pageHeading: dto.pageHeading.trim(),
      shortDescription: dto.shortDescription.trim(),
      ...(dto.isFeatured !== undefined ? { isFeatured: dto.isFeatured } : {}),
      ...(dto.displayOrder !== undefined
        ? { displayOrder: dto.displayOrder }
        : {}),
      ...(dto.flagMediaId !== undefined
        ? { flagMediaId: dto.flagMediaId }
        : {}),
      updatedByUserId: userId,
    };
    try {
      const updated = await this.prisma.country.update({
        where: { id },
        data,
        include: COUNTRY_INCLUDE,
      });
      await writeAudit(
        this.prisma,
        request,
        userId,
        'CATALOG',
        'COUNTRY',
        id,
        'COUNTRY_UPDATED',
        {
          name: current.name,
          slug: current.slug,
          iso2Code: current.iso2Code,
          iso3Code: current.iso3Code,
        },
        {
          name: updated.name,
          slug: updated.slug,
          iso2Code: updated.iso2Code,
          iso3Code: updated.iso3Code,
        },
        'Country updated',
      );
      return this.toAdmin(updated);
    } catch (error) {
      this.throwUniqueConflict(error);
      throw error;
    }
  }

  async publish(
    id: string,
    dto: CountryActionDto,
    request: AuthenticatedRequest,
  ): Promise<CountryAdminDto> {
    const userId = actorId(request);
    const current = await this.adminRecord(id);
    this.assertVersion(current.updatedAt, dto.expectedUpdatedAt);
    if (current.status === 'PUBLISHED') return this.toAdmin(current);
    const readiness = this.readiness(current);
    if (readiness.length > 0) {
      throw new UnprocessableEntityException({
        code: 'COUNTRY_NOT_READY',
        message: 'Country is not ready to publish',
        details: readiness,
      });
    }
    const updated = await this.prisma.country.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        updatedByUserId: userId,
      },
      include: COUNTRY_INCLUDE,
    });
    await writeAudit(
      this.prisma,
      request,
      userId,
      'CATALOG',
      'COUNTRY',
      id,
      'COUNTRY_PUBLISHED',
      {
        status: current.status,
        publishedAt: current.publishedAt?.toISOString() ?? null,
      },
      {
        status: 'PUBLISHED',
        publishedAt: updated.publishedAt?.toISOString() ?? null,
      },
      'Country published',
    );
    return this.toAdmin(updated);
  }

  async unpublish(
    id: string,
    dto: CountryActionDto,
    request: AuthenticatedRequest,
  ): Promise<CountryAdminDto> {
    const userId = actorId(request);
    const current = await this.adminRecord(id);
    this.assertVersion(current.updatedAt, dto.expectedUpdatedAt);
    if (current.status === 'DRAFT' && !current.publishedAt)
      return this.toAdmin(current);
    const updated = await this.prisma.country.update({
      where: { id },
      data: { status: 'DRAFT', publishedAt: null, updatedByUserId: userId },
      include: COUNTRY_INCLUDE,
    });
    await writeAudit(
      this.prisma,
      request,
      userId,
      'CATALOG',
      'COUNTRY',
      id,
      'COUNTRY_UNPUBLISHED',
      {
        status: current.status,
        publishedAt: current.publishedAt?.toISOString() ?? null,
      },
      { status: 'DRAFT', publishedAt: null },
      'Country unpublished',
    );
    return this.toAdmin(updated);
  }

  async remove(
    id: string,
    dto: CountryActionDto,
    request: AuthenticatedRequest,
  ): Promise<{ deleted: true }> {
    const userId = actorId(request);
    const current = await this.adminRecord(id);
    this.assertVersion(current.updatedAt, dto.expectedUpdatedAt);
    await this.prisma.country.update({
      where: { id },
      data: {
        status: 'DELETED',
        deletedAt: new Date(),
        updatedByUserId: userId,
      },
    });
    await writeAudit(
      this.prisma,
      request,
      userId,
      'CATALOG',
      'COUNTRY',
      id,
      'COUNTRY_DELETED',
      { name: current.name, slug: current.slug, status: current.status },
      { status: 'DELETED', deleted: true },
      'Country soft-deleted',
    );
    return { deleted: true };
  }

  private publicWhere(query: {
    q?: string;
    continent?: string;
    featured?: boolean;
    letter?: string;
    budgetBand?: string;
    ieltsOptional?: boolean;
    intake?: string;
    visaSuccessBand?: string;
    pathwayStrength?: string;
    hasTopRankedUniversities?: boolean;
  }): Prisma.CountryWhereInput {
    const workProfileFilter: Prisma.CountryWorkProfileWhereInput = {};
    if (query.visaSuccessBand) {
      Object.assign(workProfileFilter, {
        visaSuccessBand: query.visaSuccessBand,
        sourceReference: { not: null },
        verifiedAt: { not: null },
      });
    }
    if (query.pathwayStrength) {
      Object.assign(workProfileFilter, {
        immigrationPathwayStrength: query.pathwayStrength,
        sourceReference: { not: null },
        verifiedAt: { not: null },
      });
    }
    return {
      status: 'PUBLISHED',
      deletedAt: null,
      continent: { status: 'ACTIVE', deletedAt: null },
      ...(query.continent
        ? {
            continent: {
              slug: query.continent,
              status: 'ACTIVE',
              deletedAt: null,
            },
          }
        : {}),
      ...(query.featured !== undefined ? { isFeatured: query.featured } : {}),
      ...(query.letter ? { name: { startsWith: query.letter } } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q } },
              { slug: { contains: query.q } },
            ],
          }
        : {}),
      ...(query.budgetBand
        ? {
            costProfile: {
              is: {
                budgetBand: query.budgetBand,
                sourceReference: { not: null },
                verifiedAt: { not: null },
              },
            },
          }
        : {}),
      ...(query.ieltsOptional
        ? {
            languageRequirements: {
              is: {
                sourceReference: { not: null },
                verifiedAt: { not: null },
                OR: [
                  { ieltsRequirement: 'OPTIONAL' },
                  { ieltsRequirement: 'NOT_REQUIRED' },
                  { languageWaiverAvailable: true },
                ],
              },
            },
          }
        : {}),
      ...(query.intake
        ? {
            intakes: {
              some: {
                availabilityStatus: { in: [...PUBLIC_INTAKE_AVAILABILITY] },
                intake: {
                  status: 'ACTIVE',
                  OR: [{ id: query.intake }, { slug: query.intake }],
                },
              },
            },
          }
        : {}),
      ...(Object.keys(workProfileFilter).length > 0
        ? { workProfile: { is: workProfileFilter } }
        : {}),
      ...(query.hasTopRankedUniversities !== undefined
        ? {
            statistics: {
              is: {
                sourceReference: { not: null },
                verifiedAt: { not: null },
                topRankedUniversitiesCount: query.hasTopRankedUniversities
                  ? { gt: 0 }
                  : 0,
              },
            },
          }
        : {}),
    };
  }

  private publicOrderBy(
    sort: string | undefined,
  ): Prisma.CountryOrderByWithRelationInput[] {
    switch (sort) {
      case 'name':
        return [{ name: 'asc' }, { id: 'asc' }];
      case 'featured':
        return [
          { isFeatured: 'desc' },
          { displayOrder: 'asc' },
          { name: 'asc' },
          { id: 'asc' },
        ];
      default:
        return [{ displayOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }];
    }
  }

  private adminOrderBy(
    sort: string | undefined,
  ): Prisma.CountryOrderByWithRelationInput[] {
    switch (sort) {
      case 'name':
        return [{ name: 'asc' }, { id: 'asc' }];
      case 'featured':
        return [
          { isFeatured: 'desc' },
          { displayOrder: 'asc' },
          { name: 'asc' },
          { id: 'asc' },
        ];
      default:
        return [{ displayOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }];
    }
  }

  private async adminRecord(id: string): Promise<CountryRecord> {
    const record = await this.prisma.country.findFirst({
      where: { id, deletedAt: null },
      include: COUNTRY_INCLUDE,
    });
    if (!record) throw notFound();
    return record;
  }

  private async ensureContinent(id: string): Promise<void> {
    const continent = await this.prisma.continent.findFirst({
      where: { id, deletedAt: null },
    });
    if (!continent)
      throw conflict(
        'COUNTRY_CONTINENT_INVALID',
        'The selected continent is not available',
      );
  }

  private async ensureUnique(
    name: string,
    slug: string,
    iso2Code: string | undefined,
    iso3Code: string | undefined,
    excludeId?: string,
  ): Promise<void> {
    const records = await this.prisma.country.findMany({
      where: {
        deletedAt: null,
        OR: [
          { name },
          { slug },
          ...(iso2Code ? [{ iso2Code }] : []),
          ...(iso3Code ? [{ iso3Code }] : []),
        ],
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { name: true, slug: true, iso2Code: true, iso3Code: true },
    });
    if (records.some((record) => record.name === name))
      throw conflict('COUNTRY_NAME_CONFLICT', 'Country name already exists');
    if (records.some((record) => record.slug === slug))
      throw conflict('COUNTRY_SLUG_CONFLICT', 'Country slug already exists');
    if (iso2Code && records.some((record) => record.iso2Code === iso2Code))
      throw conflict(
        'COUNTRY_CODE_CONFLICT',
        'Country ISO alpha-2 code already exists',
      );
    if (iso3Code && records.some((record) => record.iso3Code === iso3Code))
      throw conflict(
        'COUNTRY_CODE_CONFLICT',
        'Country ISO alpha-3 code already exists',
      );
  }

  private throwUniqueConflict(error: unknown): void {
    if (isUniqueConstraintError(error)) {
      throw conflict(
        'COUNTRY_CODE_CONFLICT',
        'Country name, slug, or ISO code already exists',
      );
    }
  }

  private assertVersion(current: Date, expected: string | undefined): void {
    if (expected && current.getTime() !== new Date(expected).getTime()) {
      throw conflict(
        'COUNTRY_STALE_VERSION',
        'The country changed in another session. Reload before saving',
      );
    }
  }

  private readiness(
    record: CountryRecord,
  ): Array<{ field: string; code: string; message: string }> {
    const issues: Array<{ field: string; code: string; message: string }> = [];
    if (!record.name.trim())
      issues.push({
        field: 'name',
        code: 'REQUIRED',
        message: 'Name is required',
      });
    if (!record.slug.trim())
      issues.push({
        field: 'slug',
        code: 'REQUIRED',
        message: 'Slug is required',
      });
    if (!record.iso2Code)
      issues.push({
        field: 'iso2Code',
        code: 'REQUIRED',
        message: 'ISO alpha-2 code is required',
      });
    if (!record.iso3Code)
      issues.push({
        field: 'iso3Code',
        code: 'REQUIRED',
        message: 'ISO alpha-3 code is required',
      });
    if (!record.pageHeading.trim())
      issues.push({
        field: 'pageHeading',
        code: 'REQUIRED',
        message: 'Page heading is required',
      });
    if (!record.shortDescription.trim())
      issues.push({
        field: 'shortDescription',
        code: 'REQUIRED',
        message: 'Short description is required',
      });
    if (record.continent.deletedAt || record.continent.status !== 'ACTIVE')
      issues.push({
        field: 'continentId',
        code: 'INVALID',
        message: 'An active continent is required',
      });
    return issues;
  }

  private continent(record: CountryRecord) {
    return {
      id: record.continent.id,
      name: record.continent.name,
      slug: record.continent.slug,
    };
  }

  private flag(record: CountryRecord): FlagDto | null {
    if (
      !record.flagMedia ||
      record.flagMedia.status !== 'ACTIVE' ||
      record.flagMedia.deletedAt
    )
      return null;
    return {
      url: record.flagMedia.publicUrl,
      alt: record.flagMedia.altText || `Flag of ${record.name}`,
    };
  }

  private toPublic(record: CountryRecord): CountryPublicDto {
    const verified = isVerifiedStatistics(record.statistics);
    return {
      id: record.id,
      name: record.name,
      slug: record.slug,
      pageHeading: record.pageHeading,
      shortDescription: record.shortDescription,
      continent: this.continent(record),
      flag: this.flag(record),
      featured: record.isFeatured,
      displayOrder: record.displayOrder,
      statistics: record.statistics
        ? {
            universitiesCount: verified
              ? record.statistics.universitiesCount
              : null,
          }
        : null,
      profiles: publicProfileSummary(record),
    };
  }

  private toAdmin(record: CountryRecord): CountryAdminDto {
    return {
      ...this.toPublic(record),
      iso2Code: record.iso2Code,
      iso3Code: record.iso3Code,
      status: record.status,
      publishedAt: record.publishedAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
