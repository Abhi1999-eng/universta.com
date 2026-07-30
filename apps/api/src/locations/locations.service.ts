import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { slugify } from '../catalog/catalog.constants';
import { PrismaService } from '../prisma/prisma.service';

const PAGE_LIMIT = 12;
const MAX_LIMIT = 50;

function pageOf(query: Record<string, string | undefined>) {
  const page = Math.max(1, Number(query.page ?? 1) || 1);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(query.limit ?? PAGE_LIMIT) || PAGE_LIMIT),
  );
  return { page, limit, skip: (page - 1) * limit };
}

function meta(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: total ? Math.ceil(total / limit) : 0,
  };
}

function isUniqueConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  );
}

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- Public ----------

  async publicCountryStates(countrySlug: string) {
    const country = await this.prisma.country.findFirst({
      where: { slug: countrySlug, status: 'PUBLISHED', deletedAt: null },
    });
    if (!country) return [];
    return this.prisma.state.findMany({
      where: { countryId: country.id, status: 'PUBLISHED', deletedAt: null },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async publicCities(
    countrySlug: string,
    query: Record<string, string | undefined>,
  ) {
    const country = await this.prisma.country.findFirst({
      where: { slug: countrySlug, status: 'PUBLISHED', deletedAt: null },
    });
    if (!country)
      throw new NotFoundException({
        code: 'COUNTRY_NOT_FOUND',
        message: 'Country not found',
        details: null,
      });
    const { page, limit, skip } = pageOf(query);
    const where = {
      countryId: country.id,
      status: 'PUBLISHED',
      deletedAt: null,
      ...(query.state ? { state: { slug: query.state } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.city.findMany({
        where,
        include: {
          state: { select: { name: true, slug: true } },
          heroMedia: true,
        },
        orderBy: [
          { isFeatured: 'desc' },
          { displayOrder: 'asc' },
          { name: 'asc' },
        ],
        skip,
        take: limit,
      }),
      this.prisma.city.count({ where }),
    ]);
    return { data: rows, meta: meta(page, limit, total), country };
  }

  /** Published cities across every published country. City detail pages were
   * previously reachable only by first opening a specific country, which left
   * the "Cities" destination nav entry with nowhere sensible to point. */
  async publicAllCities(query: Record<string, string | undefined>) {
    const { page, limit, skip } = pageOf(query);
    const where = {
      status: 'PUBLISHED',
      deletedAt: null,
      country: {
        status: 'PUBLISHED',
        deletedAt: null,
        ...(query.country ? { slug: query.country } : {}),
      },
    };
    const [rows, total] = await Promise.all([
      this.prisma.city.findMany({
        where,
        include: {
          state: { select: { name: true, slug: true } },
          country: { select: { name: true, slug: true } },
          heroMedia: true,
        },
        orderBy: [
          { isFeatured: 'desc' },
          { displayOrder: 'asc' },
          { name: 'asc' },
        ],
        skip,
        take: limit,
      }),
      this.prisma.city.count({ where }),
    ]);
    return { data: rows, meta: meta(page, limit, total) };
  }

  async publicCityDetail(countrySlug: string, citySlug: string) {
    const country = await this.prisma.country.findFirst({
      where: { slug: countrySlug, status: 'PUBLISHED', deletedAt: null },
    });
    if (!country) return null;
    const city = await this.prisma.city.findFirst({
      where: {
        countryId: country.id,
        slug: citySlug,
        status: 'PUBLISHED',
        deletedAt: null,
      },
      include: {
        country: true,
        state: { select: { name: true, slug: true } },
        heroMedia: true,
      },
    });
    if (!city) return null;
    const seo = await this.prisma.seoMetadata.findUnique({
      where: { ownerType_ownerId: { ownerType: 'city', ownerId: city.id } },
    });
    return { ...city, seo };
  }

  // ---------- Admin: States ----------

  async adminListStates(countryId?: string) {
    return this.prisma.state.findMany({
      where: { deletedAt: null, ...(countryId ? { countryId } : {}) },
      include: { country: { select: { name: true, slug: true } } },
      orderBy: [{ countryId: 'asc' }, { displayOrder: 'asc' }],
    });
  }

  async adminDetailState(id: string) {
    const state = await this.prisma.state.findFirst({
      where: { id, deletedAt: null },
      include: { country: { select: { name: true, slug: true } } },
    });
    if (!state)
      throw new NotFoundException({
        code: 'STATE_NOT_FOUND',
        message: 'State not found',
        details: null,
      });
    return state;
  }

  async createState(body: {
    countryId: string;
    name: string;
    slug?: string;
    status?: string;
    displayOrder?: number;
  }) {
    const country = await this.prisma.country.findFirst({
      where: { id: body.countryId, deletedAt: null },
    });
    if (!country)
      throw new BadRequestException({
        code: 'COUNTRY_NOT_FOUND',
        message: 'The selected country does not exist',
        details: null,
      });
    const slug = body.slug?.trim() || slugify(body.name);
    try {
      return await this.prisma.state.create({
        data: {
          countryId: body.countryId,
          name: body.name.trim(),
          slug,
          status: body.status ?? 'DRAFT',
          displayOrder: body.displayOrder ?? 0,
        },
      });
    } catch (error) {
      if (isUniqueConflict(error))
        throw new ConflictException({
          code: 'STATE_SLUG_TAKEN',
          message: 'A state with this slug already exists for this country',
          details: null,
        });
      throw error;
    }
  }

  async updateState(
    id: string,
    body: {
      name?: string;
      slug?: string;
      status?: string;
      displayOrder?: number;
    },
  ) {
    await this.adminDetailState(id);
    try {
      return await this.prisma.state.update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { name: body.name.trim() } : {}),
          ...(body.slug !== undefined ? { slug: body.slug.trim() } : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
          ...(body.displayOrder !== undefined
            ? { displayOrder: body.displayOrder }
            : {}),
        },
      });
    } catch (error) {
      if (isUniqueConflict(error))
        throw new ConflictException({
          code: 'STATE_SLUG_TAKEN',
          message: 'A state with this slug already exists for this country',
          details: null,
        });
      throw error;
    }
  }

  async archiveState(id: string) {
    await this.adminDetailState(id);
    const citiesUsingState = await this.prisma.city.count({
      where: { stateId: id, deletedAt: null },
    });
    if (citiesUsingState > 0)
      throw new ConflictException({
        code: 'STATE_IN_USE',
        message: `${citiesUsingState} cit${citiesUsingState === 1 ? 'y is' : 'ies are'} still assigned to this state`,
        details: null,
      });
    return this.prisma.state.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'ARCHIVED' },
    });
  }

  // ---------- Admin: Cities ----------

  async adminListCities(query: { countryId?: string; q?: string }) {
    return this.prisma.city.findMany({
      where: {
        deletedAt: null,
        ...(query.countryId ? { countryId: query.countryId } : {}),
        ...(query.q?.trim() ? { name: { contains: query.q.trim() } } : {}),
      },
      include: {
        country: { select: { name: true, slug: true } },
        state: { select: { name: true, slug: true } },
      },
      orderBy: [{ countryId: 'asc' }, { displayOrder: 'asc' }],
    });
  }

  async adminDetailCity(id: string) {
    const city = await this.prisma.city.findFirst({
      where: { id, deletedAt: null },
      include: {
        country: { select: { name: true, slug: true } },
        state: { select: { id: true, name: true, slug: true } },
        heroMedia: true,
      },
    });
    if (!city)
      throw new NotFoundException({
        code: 'CITY_NOT_FOUND',
        message: 'City not found',
        details: null,
      });
    const seo = await this.prisma.seoMetadata.findUnique({
      where: { ownerType_ownerId: { ownerType: 'city', ownerId: id } },
      include: { ogMedia: true, twitterMedia: true },
    });
    return { ...city, seo };
  }

  /** City did not previously have any SEO management -- this follows the
   * same simple owner-type-keyed SeoMetadata pattern already used for the
   * "expanded" resources (jobs, events, success stories, testimonials)
   * rather than Country's richer version-checked editor, since City has no
   * existing optimistic-concurrency convention to match. */
  async saveCitySeo(id: string, body: Record<string, unknown>) {
    await this.adminDetailCity(id);
    const text = (value: unknown) =>
      typeof value === 'string' && value.trim() ? value.trim() : undefined;
    const seoTitle = text(body.seoTitle);
    const metaDescription = text(body.metaDescription);
    if (!seoTitle || !metaDescription)
      throw new BadRequestException({
        code: 'SEO_FIELDS_REQUIRED',
        message: 'seoTitle and metaDescription are required',
        details: null,
      });
    const shared = {
      seoTitle,
      metaDescription,
      canonicalUrl: text(body.canonicalUrl),
      focusKeyword: text(body.focusKeyword),
      ogTitle: text(body.ogTitle),
      ogDescription: text(body.ogDescription),
      ogMediaId: text(body.ogMediaId),
      twitterTitle: text(body.twitterTitle),
      twitterDescription: text(body.twitterDescription),
      twitterMediaId: text(body.twitterMediaId),
      robotsIndex: body.robotsIndex !== false,
      robotsFollow: body.robotsFollow !== false,
    };
    return this.prisma.seoMetadata.upsert({
      where: { ownerType_ownerId: { ownerType: 'city', ownerId: id } },
      update: shared,
      create: { ownerType: 'city', ownerId: id, ...shared },
      include: { ogMedia: true, twitterMedia: true },
    });
  }

  async createCity(
    body: {
      countryId: string;
      stateId?: string | null;
      name: string;
      slug?: string;
      shortDescription?: string;
      overview?: string;
      heroMediaId?: string | null;
      isFeatured?: boolean;
      status?: string;
      displayOrder?: number;
    },
    actorUserId?: string,
  ) {
    const country = await this.prisma.country.findFirst({
      where: { id: body.countryId, deletedAt: null },
    });
    if (!country)
      throw new BadRequestException({
        code: 'COUNTRY_NOT_FOUND',
        message: 'The selected country does not exist',
        details: null,
      });
    if (body.stateId) {
      const state = await this.prisma.state.findFirst({
        where: { id: body.stateId, countryId: body.countryId, deletedAt: null },
      });
      if (!state)
        throw new BadRequestException({
          code: 'STATE_NOT_FOUND',
          message: 'The selected state does not belong to this country',
          details: null,
        });
    }
    const slug = body.slug?.trim() || slugify(body.name);
    try {
      return await this.prisma.city.create({
        data: {
          countryId: body.countryId,
          stateId: body.stateId || null,
          name: body.name.trim(),
          slug,
          shortDescription: body.shortDescription || null,
          overview: body.overview || null,
          heroMediaId: body.heroMediaId || null,
          isFeatured: body.isFeatured ?? false,
          status: body.status ?? 'DRAFT',
          displayOrder: body.displayOrder ?? 0,
          createdByUserId: actorUserId ?? null,
          updatedByUserId: actorUserId ?? null,
        },
      });
    } catch (error) {
      if (isUniqueConflict(error))
        throw new ConflictException({
          code: 'CITY_SLUG_TAKEN',
          message: 'A city with this slug already exists for this country',
          details: null,
        });
      throw error;
    }
  }

  async updateCity(
    id: string,
    body: {
      stateId?: string | null;
      name?: string;
      slug?: string;
      shortDescription?: string;
      overview?: string;
      heroMediaId?: string | null;
      isFeatured?: boolean;
      status?: string;
      displayOrder?: number;
    },
    actorUserId?: string,
  ) {
    const current = await this.adminDetailCity(id);
    if (body.stateId) {
      const state = await this.prisma.state.findFirst({
        where: {
          id: body.stateId,
          countryId: current.countryId,
          deletedAt: null,
        },
      });
      if (!state)
        throw new BadRequestException({
          code: 'STATE_NOT_FOUND',
          message: 'The selected state does not belong to this country',
          details: null,
        });
    }
    const wasPublished = current.status === 'PUBLISHED';
    const willPublish = (body.status ?? current.status) === 'PUBLISHED';
    try {
      return await this.prisma.city.update({
        where: { id },
        data: {
          ...(body.stateId !== undefined
            ? { stateId: body.stateId || null }
            : {}),
          ...(body.name !== undefined ? { name: body.name.trim() } : {}),
          ...(body.slug !== undefined ? { slug: body.slug.trim() } : {}),
          ...(body.shortDescription !== undefined
            ? { shortDescription: body.shortDescription || null }
            : {}),
          ...(body.overview !== undefined
            ? { overview: body.overview || null }
            : {}),
          ...(body.heroMediaId !== undefined
            ? { heroMediaId: body.heroMediaId || null }
            : {}),
          ...(body.isFeatured !== undefined
            ? { isFeatured: body.isFeatured }
            : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
          ...(body.displayOrder !== undefined
            ? { displayOrder: body.displayOrder }
            : {}),
          ...(!wasPublished && willPublish ? { publishedAt: new Date() } : {}),
          updatedByUserId: actorUserId ?? current.updatedByUserId,
        },
      });
    } catch (error) {
      if (isUniqueConflict(error))
        throw new ConflictException({
          code: 'CITY_SLUG_TAKEN',
          message: 'A city with this slug already exists for this country',
          details: null,
        });
      throw error;
    }
  }

  async archiveCity(id: string) {
    await this.adminDetailCity(id);
    return this.prisma.city.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'ARCHIVED' },
    });
  }

  // ---------- Admin: Consultant locations ----------
  // ConsultantLocation had a real model and a public detail route (see
  // ExpandedService#consultantLocation) but no admin CRUD of its own --
  // it could only ever be seeded, never created or edited from the UI.

  async adminListConsultantLocations(query: {
    countryId?: string;
    q?: string;
  }) {
    return this.prisma.consultantLocation.findMany({
      where: {
        deletedAt: null,
        ...(query.countryId ? { countryId: query.countryId } : {}),
        ...(query.q?.trim() ? { name: { contains: query.q.trim() } } : {}),
      },
      include: {
        country: { select: { name: true, slug: true } },
        stateRef: { select: { name: true, slug: true } },
        cityRef: { select: { name: true, slug: true } },
        _count: { select: { consultants: true } },
      },
      orderBy: [{ name: 'asc' }],
    });
  }

  async adminDetailConsultantLocation(id: string) {
    const location = await this.prisma.consultantLocation.findFirst({
      where: { id, deletedAt: null },
      include: {
        country: { select: { id: true, name: true, slug: true } },
        stateRef: { select: { id: true, name: true, slug: true } },
        cityRef: { select: { id: true, name: true, slug: true } },
      },
    });
    if (!location)
      throw new NotFoundException({
        code: 'CONSULTANT_LOCATION_NOT_FOUND',
        message: 'Consultant location not found',
        details: null,
      });
    const seo = await this.prisma.seoMetadata.findUnique({
      where: {
        ownerType_ownerId: { ownerType: 'consultantLocation', ownerId: id },
      },
      include: { ogMedia: true, twitterMedia: true },
    });
    return { ...location, seo };
  }

  async createConsultantLocation(body: {
    countryId?: string | null;
    stateId?: string | null;
    cityId?: string | null;
    name: string;
    slug?: string;
    city: string;
    state?: string | null;
    overview?: string | null;
    status?: string;
  }) {
    const slug = body.slug?.trim() || slugify(body.name);
    try {
      return await this.prisma.consultantLocation.create({
        data: {
          countryId: body.countryId || null,
          stateId: body.stateId || null,
          cityId: body.cityId || null,
          name: body.name.trim(),
          slug,
          city: body.city.trim(),
          state: body.state || null,
          overview: body.overview || null,
          status: body.status ?? 'ACTIVE',
        },
      });
    } catch (error) {
      if (isUniqueConflict(error))
        throw new ConflictException({
          code: 'CONSULTANT_LOCATION_SLUG_TAKEN',
          message: 'A consultant location with this slug already exists',
          details: null,
        });
      throw error;
    }
  }

  async updateConsultantLocation(
    id: string,
    body: {
      countryId?: string | null;
      stateId?: string | null;
      cityId?: string | null;
      name?: string;
      slug?: string;
      city?: string;
      state?: string | null;
      overview?: string | null;
      status?: string;
    },
  ) {
    await this.adminDetailConsultantLocation(id);
    try {
      return await this.prisma.consultantLocation.update({
        where: { id },
        data: {
          ...(body.countryId !== undefined
            ? { countryId: body.countryId || null }
            : {}),
          ...(body.stateId !== undefined
            ? { stateId: body.stateId || null }
            : {}),
          ...(body.cityId !== undefined ? { cityId: body.cityId || null } : {}),
          ...(body.name !== undefined ? { name: body.name.trim() } : {}),
          ...(body.slug !== undefined ? { slug: body.slug.trim() } : {}),
          ...(body.city !== undefined ? { city: body.city.trim() } : {}),
          ...(body.state !== undefined ? { state: body.state || null } : {}),
          ...(body.overview !== undefined
            ? { overview: body.overview || null }
            : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
        },
      });
    } catch (error) {
      if (isUniqueConflict(error))
        throw new ConflictException({
          code: 'CONSULTANT_LOCATION_SLUG_TAKEN',
          message: 'A consultant location with this slug already exists',
          details: null,
        });
      throw error;
    }
  }

  async archiveConsultantLocation(id: string) {
    await this.adminDetailConsultantLocation(id);
    const mapped = await this.prisma.consultantLocationMap.count({
      where: { locationId: id },
    });
    if (mapped > 0)
      throw new ConflictException({
        code: 'CONSULTANT_LOCATION_IN_USE',
        message: `${mapped} consultant${mapped === 1 ? ' is' : 's are'} still linked to this location`,
        details: null,
      });
    return this.prisma.consultantLocation.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'ARCHIVED' },
    });
  }

  async saveConsultantLocationSeo(id: string, body: Record<string, unknown>) {
    await this.adminDetailConsultantLocation(id);
    const text = (value: unknown) =>
      typeof value === 'string' && value.trim() ? value.trim() : undefined;
    const seoTitle = text(body.seoTitle);
    const metaDescription = text(body.metaDescription);
    if (!seoTitle || !metaDescription)
      throw new BadRequestException({
        code: 'SEO_FIELDS_REQUIRED',
        message: 'seoTitle and metaDescription are required',
        details: null,
      });
    const shared = {
      seoTitle,
      metaDescription,
      canonicalUrl: text(body.canonicalUrl),
      focusKeyword: text(body.focusKeyword),
      ogTitle: text(body.ogTitle),
      ogDescription: text(body.ogDescription),
      ogMediaId: text(body.ogMediaId),
      twitterTitle: text(body.twitterTitle),
      twitterDescription: text(body.twitterDescription),
      twitterMediaId: text(body.twitterMediaId),
      robotsIndex: body.robotsIndex !== false,
      robotsFollow: body.robotsFollow !== false,
    };
    return this.prisma.seoMetadata.upsert({
      where: {
        ownerType_ownerId: { ownerType: 'consultantLocation', ownerId: id },
      },
      update: shared,
      create: { ownerType: 'consultantLocation', ownerId: id, ...shared },
      include: { ogMedia: true, twitterMedia: true },
    });
  }
}
