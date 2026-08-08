import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { Roles } from '../auth/auth.decorators';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { successEnvelope } from '../catalog/catalog.responses';
import { PrismaService } from '../prisma/prisma.service';

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function nullableText(value: unknown) {
  if (value === null || value === '') return null;
  return text(value);
}

function isUniqueConflict(error: unknown) {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002',
  );
}

function validateSlug(value: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    throw new BadRequestException({
      code: 'INVALID_CONSULTANT_LOCATION_SLUG',
      message:
        'Slug must use lowercase letters, numbers and single hyphens only',
      details: null,
    });
  }
}

function status(value: unknown, fallback = 'ACTIVE') {
  if (value === undefined || value === null || value === '') return fallback;
  if (value !== 'ACTIVE' && value !== 'INACTIVE') {
    throw new BadRequestException({
      code: 'INVALID_CONSULTANT_LOCATION_STATUS',
      message: 'Status must be ACTIVE or INACTIVE',
      details: null,
    });
  }
  return value;
}

@ApiTags('locations-admin')
@ApiBearerAuth()
@Controller('admin/consultant-locations')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class ConsultantLocationsAdminController {
  constructor(private readonly prisma: PrismaService) {}

  private async detailRecord(id: string) {
    const location = await this.prisma.consultantLocation.findFirst({
      where: { id, deletedAt: null },
      include: {
        country: { select: { id: true, name: true, slug: true } },
        stateRef: { select: { id: true, name: true, slug: true } },
        cityRef: { select: { id: true, name: true, slug: true } },
        _count: { select: { consultants: true } },
      },
    });
    if (!location) {
      throw new NotFoundException({
        code: 'CONSULTANT_LOCATION_NOT_FOUND',
        message: 'Consultant location not found',
        details: null,
      });
    }
    return location;
  }

  @Get()
  async list(
    @Req() req: AuthenticatedRequest,
    @Query() query: Record<string, string>,
  ) {
    const q = query.q?.trim();
    const rows = await this.prisma.consultantLocation.findMany({
      where: {
        deletedAt: null,
        ...(query.countryId ? { countryId: query.countryId } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q } },
                { slug: { contains: q } },
                { city: { contains: q } },
                { state: { contains: q } },
              ],
            }
          : {}),
      },
      include: {
        country: { select: { id: true, name: true, slug: true } },
        stateRef: { select: { id: true, name: true, slug: true } },
        cityRef: { select: { id: true, name: true, slug: true } },
        _count: { select: { consultants: true } },
      },
      orderBy: [{ name: 'asc' }],
    });
    return successEnvelope(req, rows);
  }

  @Get(':id')
  async detail(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const location = await this.detailRecord(id);
    const seo = await this.prisma.seoMetadata.findUnique({
      where: {
        ownerType_ownerId: { ownerType: 'consultantLocation', ownerId: id },
      },
      select: {
        seoTitle: true,
        metaDescription: true,
        canonicalUrl: true,
        focusKeyword: true,
        ogTitle: true,
        ogDescription: true,
        ogMediaId: true,
        twitterTitle: true,
        twitterDescription: true,
        twitterMediaId: true,
        robotsIndex: true,
        robotsFollow: true,
      },
    });
    return successEnvelope(req, { ...location, seo });
  }

  @Post()
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() body: Record<string, unknown>,
  ) {
    const name = text(body.name);
    const city = text(body.city);
    if (!name || !city) {
      throw new BadRequestException({
        code: 'CONSULTANT_LOCATION_FIELDS_REQUIRED',
        message: 'Name and city are required',
        details: null,
      });
    }
    const slug = text(body.slug) ?? slugify(name);
    validateSlug(slug);

    try {
      const created = await this.prisma.consultantLocation.create({
        data: {
          countryId: nullableText(body.countryId),
          stateId: nullableText(body.stateId),
          cityId: nullableText(body.cityId),
          name,
          slug,
          city,
          state: nullableText(body.state),
          overview: nullableText(body.overview),
          status: status(body.status),
        },
      });
      return successEnvelope(req, created);
    } catch (error) {
      if (isUniqueConflict(error)) {
        throw new ConflictException({
          code: 'CONSULTANT_LOCATION_SLUG_TAKEN',
          message: 'A consultant location with this slug already exists',
          details: null,
        });
      }
      throw error;
    }
  }

  @Patch(':id')
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const current = await this.detailRecord(id);
    const nextSlug =
      body.slug !== undefined ? nullableText(body.slug) : undefined;
    if (nextSlug !== undefined) {
      if (!nextSlug) {
        throw new BadRequestException({
          code: 'INVALID_CONSULTANT_LOCATION_SLUG',
          message: 'Slug cannot be blank when updating it',
          details: null,
        });
      }
      validateSlug(nextSlug);
    }

    try {
      const updated = await this.prisma.consultantLocation.update({
        where: { id },
        data: {
          ...(body.countryId !== undefined
            ? { countryId: nullableText(body.countryId) }
            : {}),
          ...(body.stateId !== undefined
            ? { stateId: nullableText(body.stateId) }
            : {}),
          ...(body.cityId !== undefined
            ? { cityId: nullableText(body.cityId) }
            : {}),
          ...(body.name !== undefined
            ? { name: text(body.name) ?? current.name }
            : {}),
          ...(nextSlug !== undefined ? { slug: nextSlug } : {}),
          ...(body.city !== undefined
            ? { city: text(body.city) ?? current.city }
            : {}),
          ...(body.state !== undefined
            ? { state: nullableText(body.state) }
            : {}),
          ...(body.overview !== undefined
            ? { overview: nullableText(body.overview) }
            : {}),
          ...(body.status !== undefined
            ? { status: status(body.status, current.status) }
            : {}),
        },
      });
      return successEnvelope(req, updated);
    } catch (error) {
      if (isUniqueConflict(error)) {
        throw new ConflictException({
          code: 'CONSULTANT_LOCATION_SLUG_TAKEN',
          message: 'A consultant location with this slug already exists',
          details: null,
        });
      }
      throw error;
    }
  }

  @Delete(':id')
  async archive(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    await this.detailRecord(id);
    const mapped = await this.prisma.consultantLocationMap.count({
      where: { locationId: id },
    });
    if (mapped > 0) {
      throw new ConflictException({
        code: 'CONSULTANT_LOCATION_IN_USE',
        message: `${mapped} consultant${mapped === 1 ? ' is' : 's are'} still linked to this location`,
        details: null,
      });
    }
    const archived = await this.prisma.consultantLocation.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'ARCHIVED' },
    });
    return successEnvelope(req, archived);
  }

  @Put(':id/seo')
  async saveSeo(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    await this.detailRecord(id);
    const seoTitle = text(body.seoTitle);
    const metaDescription = text(body.metaDescription);
    if (!seoTitle || !metaDescription) {
      throw new BadRequestException({
        code: 'SEO_FIELDS_REQUIRED',
        message: 'seoTitle and metaDescription are required',
        details: null,
      });
    }
    const shared = {
      seoTitle,
      metaDescription,
      canonicalUrl: nullableText(body.canonicalUrl),
      focusKeyword: nullableText(body.focusKeyword),
      ogTitle: nullableText(body.ogTitle),
      ogDescription: nullableText(body.ogDescription),
      ogMediaId: nullableText(body.ogMediaId),
      twitterTitle: nullableText(body.twitterTitle),
      twitterDescription: nullableText(body.twitterDescription),
      twitterMediaId: nullableText(body.twitterMediaId),
      robotsIndex: body.robotsIndex !== false,
      robotsFollow: body.robotsFollow !== false,
    };
    const seo = await this.prisma.seoMetadata.upsert({
      where: {
        ownerType_ownerId: { ownerType: 'consultantLocation', ownerId: id },
      },
      update: shared,
      create: { ownerType: 'consultantLocation', ownerId: id, ...shared },
      select: {
        seoTitle: true,
        metaDescription: true,
        canonicalUrl: true,
        focusKeyword: true,
        ogTitle: true,
        ogDescription: true,
        ogMediaId: true,
        twitterTitle: true,
        twitterDescription: true,
        twitterMediaId: true,
        robotsIndex: true,
        robotsFollow: true,
      },
    });
    return successEnvelope(req, seo);
  }
}
