import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
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
  ContinentListQueryDto,
  CreateContinentDto,
  DeleteContinentDto,
  UpdateContinentDto,
} from './dto/continent.dto';

export interface ContinentPublicDto {
  id: string;
  name: string;
  slug: string;
  code: string | null;
  description: string | null;
  displayOrder: number;
  countriesCount: number;
  status: string;
}

export interface ContinentAdminDto extends ContinentPublicDto {
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
}

/** How many linked countries a dependency conflict names before it stops. */
const DEPENDENCY_SAMPLE = 5;

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

function normalizeCode(value: string | undefined): string | undefined {
  return value === undefined ? undefined : value.trim().toUpperCase();
}

function conflict(
  code: string,
  message: string,
  details: unknown = null,
): ConflictException {
  return new ConflictException({ code, message, details });
}

function notFound(): NotFoundException {
  return new NotFoundException({
    code: 'CONTINENT_NOT_FOUND',
    message: 'Continent not found',
    details: null,
  });
}

@Injectable()
export class ContinentsService {
  constructor(private readonly prisma: PrismaService) {}

  async publicList(): Promise<ContinentPublicDto[]> {
    const continents = await this.prisma.continent.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
    });
    return Promise.all(
      continents.map(async (continent) =>
        this.toPublic(
          continent,
          await this.prisma.country.count({
            where: {
              continentId: continent.id,
              status: 'PUBLISHED',
              deletedAt: null,
            },
          }),
        ),
      ),
    );
  }

  async adminList(query: ContinentListQueryDto) {
    const where: Prisma.ContinentWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q } },
              { slug: { contains: query.q } },
              { code: { contains: query.q } },
            ],
          }
        : {}),
    };
    const orderBy = this.continentOrderBy(query.sort);
    const [total, continents] = await Promise.all([
      this.prisma.continent.count({ where }),
      this.prisma.continent.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);
    const data = await Promise.all(
      continents.map(async (continent) =>
        this.toAdmin(
          continent,
          await this.prisma.country.count({
            where: { continentId: continent.id, deletedAt: null },
          }),
        ),
      ),
    );
    return { data, meta: paginationMeta(query.page, query.limit, total) };
  }

  async getAdmin(id: string): Promise<ContinentAdminDto> {
    const continent = await this.prisma.continent.findFirst({
      where: { id, deletedAt: null },
    });
    if (!continent) throw notFound();
    const count = await this.prisma.country.count({
      where: { continentId: id, deletedAt: null },
    });
    return this.toAdmin(continent, count);
  }

  async create(
    dto: CreateContinentDto,
    request: AuthenticatedRequest,
  ): Promise<ContinentAdminDto> {
    const userId = actorId(request);
    const name = dto.name.trim();
    const slug = dto.slug?.trim() || slugify(name);
    await this.ensureUnique(name, slug, normalizeCode(dto.code));
    try {
      const continent = await this.prisma.continent.create({
        data: {
          name,
          slug,
          code: normalizeCode(dto.code),
          shortDescription: dto.shortDescription?.trim(),
          isFeatured: dto.isFeatured ?? false,
          displayOrder: dto.displayOrder ?? 0,
          status: dto.status ?? 'ACTIVE',
          createdByUserId: userId,
          updatedByUserId: userId,
        },
      });
      await writeAudit(
        this.prisma,
        request,
        userId,
        'CATALOG',
        'CONTINENT',
        continent.id,
        'CONTINENT_CREATED',
        null,
        {
          name,
          slug,
          code: normalizeCode(dto.code) ?? null,
          status: continent.status,
        },
        'Continent created',
      );
      return this.toAdmin(continent, 0);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw conflict(
          'CONTINENT_CONFLICT',
          'Continent name, slug, or code already exists',
        );
      }
      throw error;
    }
  }

  async update(
    id: string,
    dto: UpdateContinentDto,
    request: AuthenticatedRequest,
  ): Promise<ContinentAdminDto> {
    const userId = actorId(request);
    const current = await this.prisma.continent.findFirst({
      where: { id, deletedAt: null },
    });
    if (!current) throw notFound();
    this.assertVersion(
      current.updatedAt,
      dto.expectedUpdatedAt,
      'CONTINENT_STALE_VERSION',
    );
    const name = dto.name.trim();
    const slug = dto.slug?.trim() ?? current.slug;
    const code = normalizeCode(dto.code);
    await this.ensureUnique(name, slug, code, id);
    const data: Prisma.ContinentUncheckedUpdateInput = {
      name,
      slug,
      ...(dto.code !== undefined ? { code } : {}),
      ...(dto.shortDescription !== undefined
        ? { shortDescription: dto.shortDescription.trim() }
        : {}),
      ...(dto.isFeatured !== undefined ? { isFeatured: dto.isFeatured } : {}),
      ...(dto.displayOrder !== undefined
        ? { displayOrder: dto.displayOrder }
        : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.iconMediaId !== undefined
        ? { iconMediaId: dto.iconMediaId }
        : {}),
      ...(dto.heroMediaId !== undefined
        ? { heroMediaId: dto.heroMediaId }
        : {}),
      updatedByUserId: userId,
    };
    try {
      const updated = await this.prisma.continent.update({
        where: { id },
        data,
      });
      await writeAudit(
        this.prisma,
        request,
        userId,
        'CATALOG',
        'CONTINENT',
        id,
        'CONTINENT_UPDATED',
        {
          name: current.name,
          slug: current.slug,
          code: current.code,
          status: current.status,
        },
        {
          name: updated.name,
          slug: updated.slug,
          code: updated.code,
          status: updated.status,
        },
        'Continent updated',
      );
      return this.toAdmin(
        updated,
        await this.prisma.country.count({
          where: { continentId: id, deletedAt: null },
        }),
      );
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw conflict(
          'CONTINENT_CONFLICT',
          'Continent name, slug, or code already exists',
        );
      }
      throw error;
    }
  }

  async remove(
    id: string,
    dto: DeleteContinentDto,
    request: AuthenticatedRequest,
  ): Promise<{ deleted: true }> {
    const userId = actorId(request);
    const current = await this.prisma.continent.findFirst({
      where: { id, deletedAt: null },
    });
    if (!current) throw notFound();
    this.assertVersion(
      current.updatedAt,
      dto.expectedUpdatedAt,
      'CONTINENT_STALE_VERSION',
    );
    // Named rather than counted: an operator who is told "3 countries" still
    // has to go looking for them, so the dependency answer carries the first
    // few by name. Nothing cascades — the countries keep their continent and
    // the delete is refused outright.
    const linked = await this.prisma.country.findMany({
      where: { continentId: id, deletedAt: null },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true, slug: true, status: true },
      take: DEPENDENCY_SAMPLE + 1,
    });
    if (linked.length > 0) {
      const countriesCount = await this.prisma.country.count({
        where: { continentId: id, deletedAt: null },
      });
      throw conflict(
        'CONTINENT_IN_USE',
        `${countriesCount} ${countriesCount === 1 ? 'country is' : 'countries are'} still assigned to this continent. Reassign or remove them first.`,
        {
          countriesCount,
          countries: linked.slice(0, DEPENDENCY_SAMPLE),
        },
      );
    }
    await this.prisma.continent.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        // Releases this row's name, slug and code so the same continent can be
        // created again. See the `deletedKey` note on the Prisma model.
        deletedKey: id,
        status: 'INACTIVE',
        updatedByUserId: userId,
      },
    });
    await writeAudit(
      this.prisma,
      request,
      userId,
      'CATALOG',
      'CONTINENT',
      id,
      'CONTINENT_DELETED',
      { name: current.name, slug: current.slug, status: current.status },
      { status: 'INACTIVE', deleted: true },
      'Continent soft-deleted',
    );
    return { deleted: true };
  }

  private async ensureUnique(
    name: string,
    slug: string,
    code: string | undefined,
    excludeId?: string,
  ): Promise<void> {
    const records = await this.prisma.continent.findMany({
      where: {
        deletedAt: null,
        OR: [{ name }, { slug }, ...(code ? [{ code }] : [])],
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { name: true, slug: true, code: true },
    });
    if (records.some((record) => record.name === name))
      throw conflict(
        'CONTINENT_NAME_CONFLICT',
        'Continent name already exists',
      );
    if (records.some((record) => record.slug === slug))
      throw conflict(
        'CONTINENT_SLUG_CONFLICT',
        'Continent slug already exists',
      );
    if (code && records.some((record) => record.code === code))
      throw conflict(
        'CONTINENT_CODE_CONFLICT',
        'Continent code already exists',
      );
  }

  private assertVersion(
    current: Date,
    expected: string | undefined,
    code: string,
  ): void {
    if (expected && current.getTime() !== new Date(expected).getTime()) {
      throw conflict(
        code,
        'The record changed in another session. Reload before saving',
      );
    }
  }

  private continentOrderBy(
    sort: string | undefined,
  ): Prisma.ContinentOrderByWithRelationInput[] {
    switch (sort) {
      case 'name':
        return [{ name: 'asc' }, { id: 'asc' }];
      case 'createdAt':
        return [{ createdAt: 'desc' }, { name: 'asc' }, { id: 'asc' }];
      case 'updatedAt':
        return [{ updatedAt: 'desc' }, { name: 'asc' }, { id: 'asc' }];
      default:
        return [{ displayOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }];
    }
  }

  private toPublic(
    record: {
      id: string;
      name: string;
      slug: string;
      code: string | null;
      shortDescription: string | null;
      displayOrder: number;
      status: string;
    },
    countriesCount: number,
  ): ContinentPublicDto {
    return {
      id: record.id,
      name: record.name,
      slug: record.slug,
      code: record.code,
      description: record.shortDescription,
      displayOrder: record.displayOrder,
      countriesCount,
      status: record.status,
    };
  }

  private toAdmin(
    record: {
      id: string;
      name: string;
      slug: string;
      code: string | null;
      shortDescription: string | null;
      displayOrder: number;
      status: string;
      isFeatured: boolean;
      createdAt: Date;
      updatedAt: Date;
    },
    countriesCount: number,
  ): ContinentAdminDto {
    return {
      ...this.toPublic(record, countriesCount),
      isFeatured: record.isFeatured,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
