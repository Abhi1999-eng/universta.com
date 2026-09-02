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
import { CountryDerivedService } from './country-derived.service';
import {
  countryFeatureLabel,
  COUNTRY_FEATURE_CODES,
  COUNTRY_TESTS,
} from './country-configuration.constants';
import { resolveCountryMetadata } from './country-metadata';

const COUNTRY_INCLUDE = {
  continent: {
    select: { id: true, name: true, slug: true, status: true, deletedAt: true },
  },
  flagMedia: {
    select: { publicUrl: true, altText: true, status: true, deletedAt: true },
  },
  listingMedia: {
    select: { publicUrl: true, altText: true, status: true, deletedAt: true },
  },
  heroMedia: {
    select: { publicUrl: true, altText: true, status: true, deletedAt: true },
  },
  subjectMaps: {
    include: {
      subject: {
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          deletedAt: true,
        },
      },
    },
    orderBy: [{ displayOrder: 'asc' }, { subjectId: 'asc' }],
  },
  tagMaps: {
    include: {
      tag: { select: { id: true, name: true, slug: true, status: true } },
    },
    orderBy: { tag: { name: 'asc' } },
  },
  _count: {
    select: { universities: true, courses: true, scholarshipCountries: true },
  },
  popularUniversities: {
    select: { universityId: true, displayOrder: true },
    orderBy: [{ displayOrder: 'asc' }, { universityId: 'asc' }],
  },
  popularCourses: {
    select: { courseId: true, displayOrder: true },
    orderBy: [{ displayOrder: 'asc' }, { courseId: 'asc' }],
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
  externalUid: string | null;
  capitalCity: string | null;
  officialLanguage: string | null;
  currencyName: string | null;
  currencyCode: string | null;
  currencySymbol: string | null;
  flagMediaId: string | null;
  listingMediaId: string | null;
  heroMediaId: string | null;
  featureCodes: Prisma.JsonValue | null;
  acceptedTests: Prisma.JsonValue | null;
  intakeMonths: Prisma.JsonValue | null;
  postStudyWorkPermitMonths: number | null;
  shortDescription: string;
  overview: string | null;
  tagline: string | null;
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
  listingMedia: {
    publicUrl: string;
    altText: string | null;
    status: string;
    deletedAt: Date | null;
  } | null;
  heroMedia: {
    publicUrl: string;
    altText: string | null;
    status: string;
    deletedAt: Date | null;
  } | null;
  subjectMaps: Array<{
    subjectId: string;
    displayOrder: number;
    subject: {
      id: string;
      name: string;
      slug: string;
      status: string;
      deletedAt: Date | null;
    };
  }>;
  tagMaps: Array<{
    tagId: string;
    tag: { id: string; name: string; slug: string; status: string };
  }>;
  _count: {
    universities: number;
    courses: number;
    scholarshipCountries: number;
  };
  popularUniversities: Array<{ universityId: string; displayOrder: number }>;
  popularCourses: Array<{ courseId: string; displayOrder: number }>;
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
  tagline: string | null;
  overview: string | null;
  capitalCity: string | null;
  officialLanguage: string | null;
  continent: { id: string; name: string; slug: string };
  flag: FlagDto | null;
  featured: boolean;
  displayOrder: number;
  statistics: { universitiesCount: number | null } | null;
  profiles: ReturnType<typeof publicProfileSummary>;
  configuration: {
    features: Array<{ code: string; label: string }>;
    acceptedTests: string[];
    intakeMonths: number[];
    postStudyWorkPermitMonths: number | null;
  };
  currency: { code: string; symbol: string | null } | null;
  subjects: Array<{ id: string; name: string; slug: string }>;
  tags: Array<{ id: string; name: string; slug: string }>;
  derived?: Awaited<ReturnType<CountryDerivedService['detail']>>;
}

export interface CountryAdminDto extends CountryPublicDto {
  externalUid: string | null;
  iso2Code: string | null;
  iso3Code: string | null;
  /* The public payload renders media and currency for display; the editor
   * needs the raw values back, or reopening a country and saving it clears
   * whatever it could not repopulate. */
  currencyName: string | null;
  flagMediaId: string | null;
  listingMediaId: string | null;
  heroMediaId: string | null;
  status: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  popularUniversityIds: string[];
  popularCourseIds: string[];
  subjectIds: string[];
  tagIds: string[];
  subjects: Array<{ id: string; name: string; slug: string }>;
  tags: Array<{ id: string; name: string; slug: string }>;
  linkedCounts: { universities: number; courses: number; scholarships: number };
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

/**
 * Whether a stored statistics row is allowed to speak for the country.
 *
 * Two conditions, both required. `sourceMode` says an editor deliberately took
 * ownership of the number -- DERIVED means "keep following the catalogue", and
 * a row left on DERIVED must never override the live count even if it still
 * carries verification from an earlier manual period. The source reference and
 * verification date then say the number was actually checked. Without both
 * halves the caller falls back to `CountryDerivedService`, so a stale figure
 * can never quietly contradict the published universities it claims to count.
 */
function isVerifiedStatistics(
  statistics: CountryRecord['statistics'],
): boolean {
  if (!statistics) return false;
  if (statistics.sourceMode === 'DERIVED') return false;
  return Boolean(statistics.verifiedAt && statistics.sourceReference);
}

@Injectable()
export class CountriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly derived: CountryDerivedService,
  ) {}

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
    const record = country as unknown as CountryRecord;
    const metadata = resolveCountryMetadata(record.name);
    const currencyCode = record.currencyCode ?? metadata?.currencyCode ?? null;
    const currencySymbol =
      record.currencySymbol ?? metadata?.currencySymbol ?? null;
    return {
      ...this.toPublic(record),
      currency: currencyCode
        ? { code: currencyCode, symbol: currencySymbol }
        : null,
      derived: await this.derived.detail({
        id: record.id,
        currencyCode,
        currencySymbol,
      }),
    };
  }

  async adminList(query: CountryListQueryDto) {
    const where: Prisma.CountryWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.continentId ? { continentId: query.continentId } : {}),
      ...(query.featured !== undefined ? { isFeatured: query.featured } : {}),
      ...(query.subjectId
        ? { subjectMaps: { some: { subjectId: query.subjectId } } }
        : {}),
      ...(query.tagId ? { tagMaps: { some: { tagId: query.tagId } } } : {}),
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
    const [curation, derived] = await Promise.all([
      this.derived.curationOptions(country.id),
      this.derived.detail({
        id: country.id,
        currencyCode: country.currencyCode,
        currencySymbol: country.currencySymbol,
      }),
    ]);
    return {
      ...this.toAdmin(country),
      popularUniversityIds: country.popularUniversities
        .map((relation) => relation.universityId)
        .filter((id) =>
          curation.universities.some((university) => university.id === id),
        ),
      popularCourseIds: country.popularCourses
        .map((relation) => relation.courseId)
        .filter((id) => curation.courses.some((course) => course.id === id)),
      derived,
    };
  }

  async curationOptions(id: string) {
    await this.adminRecord(id);
    return this.derived.curationOptions(id);
  }

  async create(
    dto: CreateCountryDto,
    request: AuthenticatedRequest,
  ): Promise<CountryAdminDto> {
    const userId = actorId(request);
    await this.ensureContinent(dto.continentId);
    if (dto.popularUniversityIds?.length || dto.popularCourseIds?.length) {
      throw new UnprocessableEntityException({
        code: 'COUNTRY_CURATED_RELATION_INVALID',
        message:
          'Save the country before curating published Universities or Courses',
        details: null,
      });
    }
    const name = dto.name.trim();
    const slug = dto.slug?.trim() || slugify(name);
    const metadata = this.metadataOrLegacyIdentity(name, dto);
    const iso2Code = dto.iso2Code ?? metadata?.iso2Code;
    const iso3Code = dto.iso3Code ?? metadata?.iso3Code;
    await this.ensureUnique(name, slug, iso2Code, iso3Code);
    try {
      const country = await this.prisma.$transaction(async (tx) => {
        await this.ensureSubjects(dto.subjectIds, tx);
        await this.ensureTags(dto.tagIds, tx);
        return tx.country.create({
          data: {
            continentId: dto.continentId,
            name,
            slug,
            iso2Code,
            iso3Code,
            externalUid: dto.externalUid,
            capitalCity: dto.capitalCity,
            officialLanguage: dto.officialLanguage,
            currencyName: dto.currencyName,
            currencyCode: dto.currencyCode ?? metadata?.currencyCode,
            currencySymbol: dto.currencySymbol ?? metadata?.currencySymbol,
            tagline: dto.tagline,
            overview: dto.overview,
            pageHeading: dto.pageHeading.trim(),
            shortDescription: dto.shortDescription.trim(),
            isFeatured: dto.isFeatured ?? false,
            displayOrder: dto.displayOrder ?? 0,
            flagMediaId: dto.flagMediaId,
            listingMediaId: dto.listingMediaId,
            heroMediaId: dto.heroMediaId,
            subjectMaps: dto.subjectIds
              ? {
                  create: dto.subjectIds.map((subjectId, displayOrder) => ({
                    subjectId,
                    displayOrder,
                  })),
                }
              : undefined,
            tagMaps: dto.tagIds
              ? { create: dto.tagIds.map((tagId) => ({ tagId })) }
              : undefined,
            ...this.configurationData(dto),
            status: 'DRAFT',
            createdByUserId: userId,
            updatedByUserId: userId,
          },
          include: COUNTRY_INCLUDE,
        });
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
      await this.derived.replaceCuratedRelationships(
        country.id,
        dto.popularUniversityIds,
        dto.popularCourseIds,
      );
      return this.getAdmin(country.id);
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
    const metadata = resolveCountryMetadata(name);
    const iso2Code =
      dto.iso2Code ?? current.iso2Code ?? metadata?.iso2Code ?? undefined;
    const iso3Code =
      dto.iso3Code ?? current.iso3Code ?? metadata?.iso3Code ?? undefined;
    await this.ensureUnique(name, slug, iso2Code, iso3Code, id);
    await this.derived.validateCuratedRelationships(
      id,
      dto.popularUniversityIds,
      dto.popularCourseIds,
    );
    const data: Prisma.CountryUncheckedUpdateInput = {
      continentId: dto.continentId,
      name,
      slug,
      iso2Code,
      iso3Code,
      ...(dto.externalUid !== undefined
        ? { externalUid: dto.externalUid }
        : {}),
      ...(dto.capitalCity !== undefined
        ? { capitalCity: dto.capitalCity }
        : {}),
      ...(dto.officialLanguage !== undefined
        ? { officialLanguage: dto.officialLanguage }
        : {}),
      ...(dto.currencyName !== undefined
        ? { currencyName: dto.currencyName }
        : {}),
      ...(dto.currencyCode !== undefined
        ? { currencyCode: dto.currencyCode }
        : {}),
      ...(dto.currencySymbol !== undefined
        ? { currencySymbol: dto.currencySymbol }
        : {}),
      ...(dto.tagline !== undefined ? { tagline: dto.tagline } : {}),
      ...(dto.overview !== undefined ? { overview: dto.overview } : {}),
      pageHeading: dto.pageHeading.trim(),
      shortDescription: dto.shortDescription.trim(),
      ...(dto.isFeatured !== undefined ? { isFeatured: dto.isFeatured } : {}),
      ...(dto.displayOrder !== undefined
        ? { displayOrder: dto.displayOrder }
        : {}),
      ...(dto.flagMediaId !== undefined
        ? { flagMediaId: dto.flagMediaId }
        : {}),
      ...(dto.listingMediaId !== undefined
        ? { listingMediaId: dto.listingMediaId }
        : {}),
      ...(dto.heroMediaId !== undefined
        ? { heroMediaId: dto.heroMediaId }
        : {}),
      ...this.configurationData(dto),
      updatedByUserId: userId,
    };
    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        await this.ensureSubjects(dto.subjectIds, tx);
        await this.ensureTags(dto.tagIds, tx);
        if (dto.subjectIds !== undefined) {
          await tx.countrySubject.deleteMany({ where: { countryId: id } });
          if (dto.subjectIds.length)
            await tx.countrySubject.createMany({
              data: dto.subjectIds.map((subjectId, displayOrder) => ({
                countryId: id,
                subjectId,
                displayOrder,
              })),
            });
        }
        if (dto.tagIds !== undefined) {
          await tx.countryTagMap.deleteMany({ where: { countryId: id } });
          if (dto.tagIds.length)
            await tx.countryTagMap.createMany({
              data: dto.tagIds.map((tagId) => ({ countryId: id, tagId })),
            });
        }
        return tx.country.update({
          where: { id },
          data,
          include: COUNTRY_INCLUDE,
        });
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
      await this.derived.replaceCuratedRelationships(
        id,
        dto.popularUniversityIds,
        dto.popularCourseIds,
      );
      return this.getAdmin(updated.id);
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
        // Releases this row's name, slug and ISO codes so the same country can
        // be created again. See the `deletedKey` note on the Prisma model.
        deletedKey: id,
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
    subjectId?: string;
    tagId?: string;
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
      ...(query.subjectId
        ? { subjectMaps: { some: { subjectId: query.subjectId } } }
        : {}),
      ...(query.tagId ? { tagMaps: { some: { tagId: query.tagId } } } : {}),
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

  private async ensureSubjects(
    ids: string[] | undefined,
    prisma: Pick<PrismaService, 'subject'>,
  ): Promise<void> {
    if (ids === undefined || ids.length === 0) return;
    const found = await prisma.subject.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true },
    });
    if (found.length !== ids.length)
      throw new UnprocessableEntityException({
        code: 'COUNTRY_SUBJECT_INVALID',
        message: 'One or more selected Subjects are unavailable',
        details: null,
      });
  }

  private async ensureTags(
    ids: string[] | undefined,
    prisma: Pick<PrismaService, 'countryTag'>,
  ): Promise<void> {
    if (ids === undefined || ids.length === 0) return;
    const found = await prisma.countryTag.findMany({
      where: { id: { in: ids }, status: 'ACTIVE' },
      select: { id: true },
    });
    if (found.length !== ids.length)
      throw new UnprocessableEntityException({
        code: 'COUNTRY_TAG_INVALID',
        message: 'One or more selected tags are unavailable',
        details: null,
      });
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

  private metadataOrLegacyIdentity(name: string, dto: CreateCountryDto) {
    const metadata = resolveCountryMetadata(name);
    if (metadata) return metadata;
    // The Admin no longer exposes ISO fields, but old integrations and the
    // established isolated E2E fixtures still submit them. Retaining this
    // narrow fallback prevents a breaking API change while recognised real
    // country names always use the authoritative offline metadata above.
    if (dto.iso2Code && dto.iso3Code) {
      return {
        iso2Code: dto.iso2Code,
        iso3Code: dto.iso3Code,
        currencyCode: undefined,
        currencySymbol: undefined,
      };
    }
    // An unrecognised draft remains editable but cannot pass publication
    // readiness until its name is canonical or legacy identity data is
    // supplied. This preserves the established draft/review workflow.
    return undefined;
  }

  private configurationData(
    dto: Pick<
      CreateCountryDto,
      | 'featureCodes'
      | 'acceptedTests'
      | 'intakeMonths'
      | 'postStudyWorkPermitMonths'
    >,
  ): Pick<
    Prisma.CountryUncheckedCreateInput,
    | 'featureCodes'
    | 'acceptedTests'
    | 'intakeMonths'
    | 'postStudyWorkPermitMonths'
  > {
    const features = dto.featureCodes
      ? [...new Set(dto.featureCodes)].filter((code) =>
          COUNTRY_FEATURE_CODES.includes(
            code as (typeof COUNTRY_FEATURE_CODES)[number],
          ),
        )
      : undefined;
    const acceptedTests = dto.acceptedTests
      ? [...new Set(dto.acceptedTests)].filter((test) =>
          COUNTRY_TESTS.includes(test as (typeof COUNTRY_TESTS)[number]),
        )
      : undefined;
    const intakeMonths = dto.intakeMonths
      ? [...new Set(dto.intakeMonths)].sort((left, right) => left - right)
      : undefined;
    return {
      ...(features !== undefined ? { featureCodes: features } : {}),
      ...(acceptedTests !== undefined ? { acceptedTests } : {}),
      ...(intakeMonths !== undefined ? { intakeMonths } : {}),
      ...(dto.postStudyWorkPermitMonths !== undefined
        ? { postStudyWorkPermitMonths: dto.postStudyWorkPermitMonths }
        : {}),
    };
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
      tagline: record.tagline,
      overview: record.overview,
      capitalCity: record.capitalCity,
      officialLanguage: record.officialLanguage,
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
      configuration: {
        features: this.featureCodes(record).map((code) => ({
          code,
          label: countryFeatureLabel(code),
        })),
        acceptedTests: this.stringList(record.acceptedTests, COUNTRY_TESTS),
        intakeMonths: this.monthList(record),
        postStudyWorkPermitMonths:
          record.postStudyWorkPermitMonths ??
          record.workProfile?.postStudyWorkMaxMonths ??
          record.workProfile?.postStudyWorkMinMonths ??
          null,
      },
      currency: record.currencyCode
        ? { code: record.currencyCode, symbol: record.currencySymbol }
        : null,
      subjects: record.subjectMaps
        .filter(
          ({ subject }) => subject.status === 'PUBLISHED' && !subject.deletedAt,
        )
        .map(({ subject }) => ({
          id: subject.id,
          name: subject.name,
          slug: subject.slug,
        })),
      tags: record.tagMaps
        .filter(({ tag }) => tag.status === 'ACTIVE')
        .map(({ tag }) => ({ id: tag.id, name: tag.name, slug: tag.slug })),
    };
  }

  private toAdmin(record: CountryRecord): CountryAdminDto {
    return {
      ...this.toPublic(record),
      externalUid: record.externalUid,
      iso2Code: record.iso2Code,
      iso3Code: record.iso3Code,
      currencyName: record.currencyName,
      flagMediaId: record.flagMediaId,
      listingMediaId: record.listingMediaId,
      heroMediaId: record.heroMediaId,
      status: record.status,
      publishedAt: record.publishedAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      popularUniversityIds: record.popularUniversities.map(
        (relation) => relation.universityId,
      ),
      popularCourseIds: record.popularCourses.map(
        (relation) => relation.courseId,
      ),
      subjectIds: record.subjectMaps.map((relation) => relation.subjectId),
      tagIds: record.tagMaps.map((relation) => relation.tagId),
      /* Labels as well as ids: the Countries list renders assigned taxonomy
       * per row, and both relations are already loaded by COUNTRY_INCLUDE, so
       * this costs no additional query. */
      subjects: record.subjectMaps.map((relation) => ({
        id: relation.subject.id,
        name: relation.subject.name,
        slug: relation.subject.slug,
      })),
      tags: record.tagMaps.map((relation) => ({
        id: relation.tag.id,
        name: relation.tag.name,
        slug: relation.tag.slug,
      })),
      linkedCounts: {
        universities: record._count.universities,
        courses: record._count.courses,
        scholarships: record._count.scholarshipCountries,
      },
    };
  }

  private featureCodes(record: CountryRecord): string[] {
    const saved = this.stringList(record.featureCodes, COUNTRY_FEATURE_CODES);
    if (saved.length) return saved;
    return [
      ...(record.workProfile?.partTimeAllowed ? ['PART_TIME_ALLOWED'] : []),
      ...(record.workProfile?.postStudyWorkAvailable
        ? ['POST_STUDY_WORK_AVAILABLE']
        : []),
      ...(record.languageRequirements?.languageWaiverAvailable
        ? ['LANGUAGE_WAIVER']
        : []),
    ];
  }

  private stringList(
    value: Prisma.JsonValue | null,
    allowed: readonly string[],
  ): string[] {
    return Array.isArray(value)
      ? value.filter(
          (item): item is string =>
            typeof item === 'string' && allowed.includes(item),
        )
      : [];
  }

  private monthList(record: CountryRecord): number[] {
    const saved = Array.isArray(record.intakeMonths)
      ? record.intakeMonths.filter(
          (value): value is number => typeof value === 'number',
        )
      : [];
    if (saved.length)
      return saved.filter(
        (month) => Number.isInteger(month) && month >= 1 && month <= 12,
      );
    return [
      ...new Set(
        record.intakes
          .map((intake) => intake.intake.startMonth)
          .filter((month): month is number =>
            Boolean(month && month >= 1 && month <= 12),
          ),
      ),
    ].sort((left, right) => left - right);
  }
}
