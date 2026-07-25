import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { writeAudit } from '../../catalog/catalog.audit';
import type { AuthenticatedRequest } from '../../auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import { CountriesService } from '../countries.service';
import { CountryProfilesService } from '../profiles/country-profiles.service';
import { COUNTRY_SECTION_TYPES, SEO_OWNER_TYPE } from './editorial.constants';
import {
  ConsultantCardDto,
  ContentSectionDto,
  FaqDto,
  MediaOptionsQueryDto,
  SeoMetadataDto,
} from './editorial.dto';

type SafeMedia = {
  id: string;
  publicUrl: string;
  title: string | null;
  altText: string | null;
  width: number | null;
  height: number | null;
};
const mediaSelect = {
  id: true,
  publicUrl: true,
  title: true,
  altText: true,
  width: true,
  height: true,
} as const;

function actorId(request: AuthenticatedRequest): string {
  const id = request.user?.sub;
  if (!id)
    throw new ConflictException({
      code: 'FORBIDDEN',
      message: 'Super Admin access is required',
      details: null,
    });
  return id;
}
function notFound(code = 'COUNTRY_NOT_FOUND'): NotFoundException {
  return new NotFoundException({
    code,
    message:
      code === 'COUNTRY_NOT_FOUND'
        ? 'Country not found'
        : 'Editorial record not found',
    details: null,
  });
}
function bad(code: string, message: string): BadRequestException {
  return new BadRequestException({ code, message, details: null });
}
function stale(code: string): ConflictException {
  return new ConflictException({
    code,
    message:
      'The editorial record changed in another session. Reload before saving',
    details: null,
  });
}
function inputJson(value: unknown): Prisma.InputJsonValue | undefined {
  return value === undefined ? undefined : (value as Prisma.InputJsonValue);
}
function trim(value: string | undefined): string | undefined {
  return value === undefined ? undefined : value.trim();
}
function scalarValues(
  record: Record<string, unknown>,
): Record<string, string | number | boolean | null> {
  return Object.fromEntries(
    Object.entries(record)
      .filter(
        ([, value]) =>
          value === null ||
          ['string', 'number', 'boolean'].includes(typeof value),
      )
      .map(([key, value]) => [key, value as string | number | boolean | null]),
  );
}

function assertSafeCopy(values: Array<string | undefined>): void {
  if (values.some((value) => value && /<[^>]*>|javascript:|data:/i.test(value)))
    throw bad(
      'EDITORIAL_BODY_INVALID',
      'Editorial copy cannot contain HTML or unsafe URLs',
    );
}

function validateEditorialConfiguration(
  value: Record<string, unknown> | undefined,
): void {
  if (value === undefined) return;
  const allowed = ['anchorLabel', 'hiddenFromNav', 'variant'];
  if (Object.keys(value).some((key) => !allowed.includes(key)))
    throw bad(
      'EDITORIAL_BODY_INVALID',
      'Section configuration contains unsupported fields',
    );
  if (
    value.anchorLabel !== undefined &&
    (typeof value.anchorLabel !== 'string' || value.anchorLabel.length > 100)
  )
    throw bad('EDITORIAL_BODY_INVALID', 'Section anchor label is invalid');
  if (
    value.variant !== undefined &&
    (typeof value.variant !== 'string' || value.variant.length > 50)
  )
    throw bad('EDITORIAL_BODY_INVALID', 'Section variant is invalid');
  if (
    value.hiddenFromNav !== undefined &&
    typeof value.hiddenFromNav !== 'boolean'
  )
    throw bad(
      'EDITORIAL_BODY_INVALID',
      'Section navigation visibility is invalid',
    );
}

export function validateEditorialBody(
  type: string,
  value: Record<string, unknown> | undefined,
): void {
  if (value === undefined) return;
  if (!(COUNTRY_SECTION_TYPES as readonly string[]).includes(type))
    throw bad('EDITORIAL_SECTION_TYPE_INVALID', 'Unsupported section type');
  const allowed: Record<string, string[]> = {
    RICH_TEXT: ['paragraphs'],
    FACT_GRID: ['items'],
    CARD_GRID: ['items'],
    STEPS: ['items'],
    CTA: ['supportingText'],
    MEDIA: ['caption'],
  };
  const keys = Object.keys(value);
  if (keys.some((key) => !allowed[type]?.includes(key)))
    throw bad(
      'EDITORIAL_BODY_INVALID',
      'Section body contains unsupported fields',
    );
  if (
    type === 'RICH_TEXT' &&
    (!Array.isArray(value.paragraphs) ||
      value.paragraphs.length > 12 ||
      value.paragraphs.some(
        (item) =>
          typeof item !== 'string' ||
          item.length > 2000 ||
          /<[^>]*>|javascript:|data:/i.test(item),
      ))
  )
    throw bad(
      'EDITORIAL_BODY_INVALID',
      'Rich text paragraphs are invalid or too long',
    );
  if (['FACT_GRID', 'CARD_GRID', 'STEPS'].includes(type)) {
    if (
      !Array.isArray(value.items) ||
      value.items.length > 12 ||
      value.items.some(
        (item) => !item || typeof item !== 'object' || Array.isArray(item),
      )
    )
      throw bad(
        'EDITORIAL_BODY_INVALID',
        'Section items are invalid or too many',
      );

    const itemKeys: Record<string, string[]> = {
      FACT_GRID: ['label', 'value'],
      CARD_GRID: ['title', 'description', 'ctaLabel', 'ctaUrl'],
      STEPS: ['step', 'title', 'description'],
    };
    for (const item of value.items) {
      const record = item as Record<string, unknown>;
      if (Object.keys(record).some((key) => !itemKeys[type].includes(key)))
        throw bad(
          'EDITORIAL_BODY_INVALID',
          'Section item contains unsupported fields',
        );
      for (const [key, itemValue] of Object.entries(record)) {
        if (
          typeof itemValue !== 'string' ||
          itemValue.length > 2000 ||
          /<[^>]*>|javascript:|data:/i.test(itemValue)
        )
          throw bad('EDITORIAL_BODY_INVALID', `Section item ${key} is invalid`);
        if (
          key === 'ctaUrl' &&
          !/^\/(?!\/)|^#[a-zA-Z0-9_-]+$|^https:\/\//.test(itemValue)
        )
          throw bad(
            'EDITORIAL_BODY_INVALID',
            'Section item CTA URL is invalid',
          );
      }
    }
  }
  if (
    type === 'CTA' &&
    value.supportingText !== undefined &&
    (typeof value.supportingText !== 'string' ||
      value.supportingText.length > 2000 ||
      /<[^>]*>|javascript:|data:/i.test(value.supportingText))
  )
    throw bad('EDITORIAL_BODY_INVALID', 'CTA supporting text is invalid');
  if (
    type === 'MEDIA' &&
    value.caption !== undefined &&
    (typeof value.caption !== 'string' ||
      value.caption.length > 1000 ||
      /<[^>]*>|javascript:|data:/i.test(value.caption))
  )
    throw bad('EDITORIAL_BODY_INVALID', 'Media caption is invalid');
}

@Injectable()
export class CountryEditorialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly countries: CountriesService,
    private readonly profiles: CountryProfilesService,
  ) {}

  async adminEditorial(countryId: string) {
    await this.country(countryId);
    const [sections, faqs, seo, consultantCards] = await Promise.all([
      this.prisma.countryContentSection.findMany({
        where: { countryId, deletedAt: null },
        include: {
          primaryMedia: { select: mediaSelect },
          secondaryMedia: { select: mediaSelect },
        },
        orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.countryFaq.findMany({
        where: { countryId, deletedAt: null },
        orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.seoMetadata.findUnique({
        where: {
          ownerType_ownerId: { ownerType: SEO_OWNER_TYPE, ownerId: countryId },
        },
        include: {
          ogMedia: { select: mediaSelect },
          twitterMedia: { select: mediaSelect },
        },
      }),
      this.prisma.consultantLandingCard.findMany({
        where: { countryId, deletedAt: null },
        include: {
          iconMedia: { select: mediaSelect },
          featuredMedia: { select: mediaSelect },
        },
        orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
      }),
    ]);
    return {
      sections: sections.map((item) => this.section(item)),
      faqs: faqs.map((item) => this.faq(item)),
      seo: seo ? this.seo(seo) : null,
      consultantCards: consultantCards.map((item) => this.card(item)),
    };
  }

  async publicPage(slug: string) {
    const country = await this.countries.publicDetail(slug);
    const [record, editorial] = await Promise.all([
      this.prisma.country.findFirst({
        where: {
          id: country.id,
          status: 'PUBLISHED',
          deletedAt: null,
          continent: { status: 'ACTIVE', deletedAt: null },
        },
        include: {
          contentSections: {
            where: { deletedAt: null, status: 'ACTIVE' },
            include: {
              primaryMedia: { select: mediaSelect },
              secondaryMedia: { select: mediaSelect },
            },
            orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
          },
          faqs: {
            where: { deletedAt: null, status: 'ACTIVE' },
            orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
          },
          consultantCards: {
            where: { deletedAt: null, status: 'PUBLISHED' },
            include: {
              iconMedia: { select: mediaSelect },
              featuredMedia: { select: mediaSelect },
            },
            orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
          },
        },
      }),
      this.prisma.seoMetadata.findUnique({
        where: {
          ownerType_ownerId: { ownerType: SEO_OWNER_TYPE, ownerId: country.id },
        },
        include: {
          ogMedia: { select: mediaSelect },
          twitterMedia: { select: mediaSelect },
        },
      }),
    ]);
    if (!record) throw notFound();
    const bundle = await this.profiles.publicBundle(country.id);
    return {
      country,
      profiles: this.profiles.publicDetail(bundle),
      sections: record.contentSections.map((item) => this.section(item)),
      faqs: record.faqs.map((item) => this.faq(item)),
      seo: editorial ? this.publicSeo(editorial) : null,
      consultantCards: record.consultantCards.map((item) =>
        this.card(item, true),
      ),
    };
  }

  async createSection(
    countryId: string,
    dto: ContentSectionDto,
    request: AuthenticatedRequest,
  ) {
    const userId = actorId(request);
    await this.country(countryId);
    validateEditorialBody(dto.sectionType, dto.bodyJson);
    validateEditorialConfiguration(dto.configurationJson);
    assertSafeCopy([dto.eyebrow, dto.heading, dto.subheading, dto.ctaLabel]);
    await this.mediaIds([dto.primaryMediaId, dto.secondaryMediaId]);
    const row = await this.prisma.countryContentSection.create({
      data: {
        countryId,
        sectionKey: dto.sectionKey,
        sectionType: dto.sectionType,
        eyebrow: trim(dto.eyebrow),
        heading: trim(dto.heading),
        subheading: trim(dto.subheading),
        bodyJson: inputJson(dto.bodyJson),
        primaryMediaId: dto.primaryMediaId,
        secondaryMediaId: dto.secondaryMediaId,
        ctaLabel: trim(dto.ctaLabel),
        ctaUrl: trim(dto.ctaUrl),
        configurationJson: inputJson(dto.configurationJson),
        displayOrder: dto.displayOrder ?? 0,
        status: dto.status ?? 'ACTIVE',
      },
      include: {
        primaryMedia: { select: mediaSelect },
        secondaryMedia: { select: mediaSelect },
      },
    });
    await writeAudit(
      this.prisma,
      request,
      userId,
      'COUNTRY_EDITORIAL',
      'COUNTRY_CONTENT_SECTION',
      row.id,
      'CONTENT_SECTION_CREATED',
      null,
      scalarValues({
        sectionKey: row.sectionKey,
        sectionType: row.sectionType,
        status: row.status,
      }),
      'Country content section created',
    );
    return this.section(row);
  }
  async updateSection(
    countryId: string,
    id: string,
    dto: ContentSectionDto,
    request: AuthenticatedRequest,
  ) {
    const userId = actorId(request);
    const current = await this.sectionRecord(countryId, id);
    this.version(
      current.updatedAt,
      dto.expectedUpdatedAt,
      'COUNTRY_CONTENT_SECTION_STALE_VERSION',
    );
    validateEditorialBody(dto.sectionType, dto.bodyJson);
    validateEditorialConfiguration(dto.configurationJson);
    assertSafeCopy([dto.eyebrow, dto.heading, dto.subheading, dto.ctaLabel]);
    await this.mediaIds([dto.primaryMediaId, dto.secondaryMediaId]);
    const row = await this.prisma.countryContentSection.update({
      where: { id },
      data: {
        sectionKey: dto.sectionKey,
        sectionType: dto.sectionType,
        eyebrow: trim(dto.eyebrow),
        heading: trim(dto.heading),
        subheading: trim(dto.subheading),
        bodyJson: inputJson(dto.bodyJson),
        primaryMediaId: dto.primaryMediaId,
        secondaryMediaId: dto.secondaryMediaId,
        ctaLabel: trim(dto.ctaLabel),
        ctaUrl: trim(dto.ctaUrl),
        configurationJson: inputJson(dto.configurationJson),
        displayOrder: dto.displayOrder ?? 0,
        status: dto.status ?? current.status,
      },
      include: {
        primaryMedia: { select: mediaSelect },
        secondaryMedia: { select: mediaSelect },
      },
    });
    await writeAudit(
      this.prisma,
      request,
      userId,
      'COUNTRY_EDITORIAL',
      'COUNTRY_CONTENT_SECTION',
      id,
      'CONTENT_SECTION_UPDATED',
      scalarValues({ sectionKey: current.sectionKey, status: current.status }),
      scalarValues({ sectionKey: row.sectionKey, status: row.status }),
      'Country content section updated',
    );
    return this.section(row);
  }
  async deleteSection(
    countryId: string,
    id: string,
    expectedUpdatedAt: string | undefined,
    request: AuthenticatedRequest,
  ) {
    const userId = actorId(request);
    const current = await this.sectionRecord(countryId, id);
    this.version(
      current.updatedAt,
      expectedUpdatedAt,
      'COUNTRY_CONTENT_SECTION_STALE_VERSION',
    );
    await this.prisma.countryContentSection.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'INACTIVE' },
    });
    await writeAudit(
      this.prisma,
      request,
      userId,
      'COUNTRY_EDITORIAL',
      'COUNTRY_CONTENT_SECTION',
      id,
      'CONTENT_SECTION_DELETED',
      scalarValues({ sectionKey: current.sectionKey }),
      { deleted: true },
      'Country content section deleted',
    );
    return { deleted: true };
  }

  async createFaq(
    countryId: string,
    dto: FaqDto,
    request: AuthenticatedRequest,
  ) {
    const userId = actorId(request);
    await this.country(countryId);
    assertSafeCopy([dto.question, dto.answer, dto.category]);
    const row = await this.prisma.countryFaq.create({
      data: {
        countryId,
        question: dto.question.trim(),
        answer: dto.answer.trim(),
        category: trim(dto.category),
        isFeatured: dto.isFeatured ?? false,
        status: dto.status ?? 'ACTIVE',
        displayOrder: dto.displayOrder ?? 0,
        createdByUserId: userId,
        updatedByUserId: userId,
      },
    });
    await writeAudit(
      this.prisma,
      request,
      userId,
      'COUNTRY_EDITORIAL',
      'COUNTRY_FAQ',
      row.id,
      'FAQ_CREATED',
      null,
      scalarValues({ question: row.question, status: row.status }),
      'Country FAQ created',
    );
    return this.faq(row);
  }
  async updateFaq(
    countryId: string,
    id: string,
    dto: FaqDto,
    request: AuthenticatedRequest,
  ) {
    const userId = actorId(request);
    const current = await this.faqRecord(countryId, id);
    assertSafeCopy([dto.question, dto.answer, dto.category]);
    this.version(
      current.updatedAt,
      dto.expectedUpdatedAt,
      'COUNTRY_FAQ_STALE_VERSION',
    );
    const row = await this.prisma.countryFaq.update({
      where: { id },
      data: {
        question: dto.question.trim(),
        answer: dto.answer.trim(),
        category: trim(dto.category),
        isFeatured: dto.isFeatured ?? false,
        status: dto.status ?? current.status,
        displayOrder: dto.displayOrder ?? current.displayOrder,
        updatedByUserId: userId,
      },
    });
    await writeAudit(
      this.prisma,
      request,
      userId,
      'COUNTRY_EDITORIAL',
      'COUNTRY_FAQ',
      id,
      'FAQ_UPDATED',
      scalarValues({ question: current.question, status: current.status }),
      scalarValues({ question: row.question, status: row.status }),
      'Country FAQ updated',
    );
    return this.faq(row);
  }
  async deleteFaq(
    countryId: string,
    id: string,
    expectedUpdatedAt: string | undefined,
    request: AuthenticatedRequest,
  ) {
    const userId = actorId(request);
    const current = await this.faqRecord(countryId, id);
    this.version(
      current.updatedAt,
      expectedUpdatedAt,
      'COUNTRY_FAQ_STALE_VERSION',
    );
    await this.prisma.countryFaq.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'INACTIVE',
        updatedByUserId: userId,
      },
    });
    await writeAudit(
      this.prisma,
      request,
      userId,
      'COUNTRY_EDITORIAL',
      'COUNTRY_FAQ',
      id,
      'FAQ_DELETED',
      scalarValues({ question: current.question }),
      { deleted: true },
      'Country FAQ deleted',
    );
    return { deleted: true };
  }

  async saveSeo(
    countryId: string,
    dto: SeoMetadataDto,
    request: AuthenticatedRequest,
  ) {
    const userId = actorId(request);
    await this.country(countryId);
    assertSafeCopy([
      dto.seoTitle,
      dto.metaDescription,
      dto.focusKeyword,
      dto.ogTitle,
      dto.ogDescription,
      dto.twitterTitle,
      dto.twitterDescription,
    ]);
    const current = await this.prisma.seoMetadata.findUnique({
      where: {
        ownerType_ownerId: { ownerType: SEO_OWNER_TYPE, ownerId: countryId },
      },
    });
    this.version(
      current?.updatedAt,
      dto.expectedUpdatedAt,
      'COUNTRY_SEO_STALE_VERSION',
    );
    await this.mediaIds([dto.ogMediaId, dto.twitterMediaId]);
    const row = await this.prisma.seoMetadata.upsert({
      where: {
        ownerType_ownerId: { ownerType: SEO_OWNER_TYPE, ownerId: countryId },
      },
      create: {
        ownerType: SEO_OWNER_TYPE,
        ownerId: countryId,
        seoTitle: dto.seoTitle.trim(),
        metaDescription: dto.metaDescription.trim(),
        canonicalUrl: trim(dto.canonicalUrl),
        focusKeyword: trim(dto.focusKeyword),
        ogTitle: trim(dto.ogTitle),
        ogDescription: trim(dto.ogDescription),
        ogMediaId: dto.ogMediaId,
        twitterTitle: trim(dto.twitterTitle),
        twitterDescription: trim(dto.twitterDescription),
        twitterMediaId: dto.twitterMediaId,
        robotsIndex: dto.robotsIndex ?? true,
        robotsFollow: dto.robotsFollow ?? true,
        schemaJson: inputJson(dto.schemaJson),
        hreflangJson: inputJson(dto.hreflangJson),
      },
      update: {
        seoTitle: dto.seoTitle.trim(),
        metaDescription: dto.metaDescription.trim(),
        canonicalUrl: trim(dto.canonicalUrl),
        focusKeyword: trim(dto.focusKeyword),
        ogTitle: trim(dto.ogTitle),
        ogDescription: trim(dto.ogDescription),
        ogMediaId: dto.ogMediaId,
        twitterTitle: trim(dto.twitterTitle),
        twitterDescription: trim(dto.twitterDescription),
        twitterMediaId: dto.twitterMediaId,
        robotsIndex: dto.robotsIndex ?? true,
        robotsFollow: dto.robotsFollow ?? true,
        schemaJson: inputJson(dto.schemaJson),
        hreflangJson: inputJson(dto.hreflangJson),
      },
      include: {
        ogMedia: { select: mediaSelect },
        twitterMedia: { select: mediaSelect },
      },
    });
    await writeAudit(
      this.prisma,
      request,
      userId,
      'COUNTRY_EDITORIAL',
      'SEO_METADATA',
      row.id,
      current ? 'SEO_UPDATED' : 'SEO_CREATED',
      null,
      scalarValues({
        ownerType: SEO_OWNER_TYPE,
        ownerId: countryId,
        seoTitle: row.seoTitle,
      }),
      'Country SEO metadata saved',
    );
    return this.seo(row);
  }
  async deleteSeo(
    countryId: string,
    expectedUpdatedAt: string | undefined,
    request: AuthenticatedRequest,
  ) {
    const userId = actorId(request);
    const current = await this.prisma.seoMetadata.findUnique({
      where: {
        ownerType_ownerId: { ownerType: SEO_OWNER_TYPE, ownerId: countryId },
      },
    });
    if (!current) return { deleted: true };
    this.version(
      current.updatedAt,
      expectedUpdatedAt,
      'COUNTRY_SEO_STALE_VERSION',
    );
    await this.prisma.seoMetadata.delete({ where: { id: current.id } });
    await writeAudit(
      this.prisma,
      request,
      userId,
      'COUNTRY_EDITORIAL',
      'SEO_METADATA',
      current.id,
      'SEO_DELETED',
      scalarValues({ ownerId: countryId }),
      { deleted: true },
      'Country SEO metadata deleted',
    );
    return { deleted: true };
  }

  async createCard(
    countryId: string,
    dto: ConsultantCardDto,
    request: AuthenticatedRequest,
  ) {
    const userId = actorId(request);
    await this.country(countryId);
    assertSafeCopy([
      dto.title,
      dto.slug,
      dto.shortDescription,
      dto.overview,
      dto.ctaLabel,
    ]);
    await this.mediaIds([dto.iconMediaId, dto.featuredMediaId]);
    const row = await this.prisma.consultantLandingCard.create({
      data: {
        countryId,
        title: dto.title.trim(),
        slug: dto.slug.trim(),
        shortDescription: dto.shortDescription.trim(),
        overview: trim(dto.overview),
        iconMediaId: dto.iconMediaId,
        featuredMediaId: dto.featuredMediaId,
        isFreeConsultation: dto.isFreeConsultation ?? true,
        ctaLabel: trim(dto.ctaLabel) ?? 'View consultants',
        ctaUrl: trim(dto.ctaUrl),
        status: dto.status ?? 'DRAFT',
        isFeatured: dto.isFeatured ?? false,
        displayOrder: dto.displayOrder ?? 0,
        publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : null,
      },
    });
    await writeAudit(
      this.prisma,
      request,
      userId,
      'COUNTRY_EDITORIAL',
      'CONSULTANT_LANDING_CARD',
      row.id,
      'CONSULTANT_CARD_CREATED',
      null,
      scalarValues({ slug: row.slug, status: row.status }),
      'Consultant landing card created',
    );
    return this.card(row);
  }
  async updateCard(
    countryId: string,
    id: string,
    dto: ConsultantCardDto,
    request: AuthenticatedRequest,
  ) {
    const userId = actorId(request);
    const current = await this.cardRecord(countryId, id);
    assertSafeCopy([
      dto.title,
      dto.slug,
      dto.shortDescription,
      dto.overview,
      dto.ctaLabel,
    ]);
    this.version(
      current.updatedAt,
      dto.expectedUpdatedAt,
      'COUNTRY_CONSULTANT_CARD_STALE_VERSION',
    );
    await this.mediaIds([dto.iconMediaId, dto.featuredMediaId]);
    const row = await this.prisma.consultantLandingCard.update({
      where: { id },
      data: {
        title: dto.title.trim(),
        slug: dto.slug.trim(),
        shortDescription: dto.shortDescription.trim(),
        overview: trim(dto.overview),
        iconMediaId: dto.iconMediaId,
        featuredMediaId: dto.featuredMediaId,
        isFreeConsultation: dto.isFreeConsultation ?? true,
        ctaLabel: trim(dto.ctaLabel) ?? current.ctaLabel,
        ctaUrl: trim(dto.ctaUrl),
        status: dto.status ?? current.status,
        isFeatured: dto.isFeatured ?? current.isFeatured,
        displayOrder: dto.displayOrder ?? current.displayOrder,
        publishedAt: dto.publishedAt
          ? new Date(dto.publishedAt)
          : current.publishedAt,
      },
    });
    await writeAudit(
      this.prisma,
      request,
      userId,
      'COUNTRY_EDITORIAL',
      'CONSULTANT_LANDING_CARD',
      id,
      'CONSULTANT_CARD_UPDATED',
      scalarValues({ slug: current.slug, status: current.status }),
      scalarValues({ slug: row.slug, status: row.status }),
      'Consultant landing card updated',
    );
    return this.card(row);
  }
  async deleteCard(
    countryId: string,
    id: string,
    expectedUpdatedAt: string | undefined,
    request: AuthenticatedRequest,
  ) {
    const userId = actorId(request);
    const current = await this.cardRecord(countryId, id);
    this.version(
      current.updatedAt,
      expectedUpdatedAt,
      'COUNTRY_CONSULTANT_CARD_STALE_VERSION',
    );
    await this.prisma.consultantLandingCard.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'DRAFT' },
    });
    await writeAudit(
      this.prisma,
      request,
      userId,
      'COUNTRY_EDITORIAL',
      'CONSULTANT_LANDING_CARD',
      id,
      'CONSULTANT_CARD_DELETED',
      scalarValues({ slug: current.slug }),
      { deleted: true },
      'Consultant landing card deleted',
    );
    return { deleted: true };
  }

  async mediaOptions(query: MediaOptionsQueryDto) {
    return this.prisma.mediaAsset.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        mediaType: 'IMAGE',
        ...(query.q
          ? {
              OR: [
                { title: { contains: query.q } },
                { originalFileName: { contains: query.q } },
              ],
            }
          : {}),
      },
      select: mediaSelect,
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      take: query.limit,
    });
  }

  private async country(id: string) {
    const row = await this.prisma.country.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!row) throw notFound();
    return row;
  }
  private async sectionRecord(countryId: string, id: string) {
    const row = await this.prisma.countryContentSection.findFirst({
      where: { id, countryId, deletedAt: null },
      include: {
        primaryMedia: { select: mediaSelect },
        secondaryMedia: { select: mediaSelect },
      },
    });
    if (!row) throw notFound('COUNTRY_CONTENT_SECTION_NOT_FOUND');
    return row;
  }
  private async faqRecord(countryId: string, id: string) {
    const row = await this.prisma.countryFaq.findFirst({
      where: { id, countryId, deletedAt: null },
    });
    if (!row) throw notFound('COUNTRY_FAQ_NOT_FOUND');
    return row;
  }
  private async cardRecord(countryId: string, id: string) {
    const row = await this.prisma.consultantLandingCard.findFirst({
      where: { id, countryId, deletedAt: null },
    });
    if (!row) throw notFound('COUNTRY_CONSULTANT_CARD_NOT_FOUND');
    return row;
  }
  private version(
    current: Date | null | undefined,
    expected: string | undefined,
    code: string,
  ) {
    if (
      current &&
      (!expected || current.getTime() !== new Date(expected).getTime())
    )
      throw stale(code);
    if (!current && expected) throw stale(code);
  }
  private async mediaIds(ids: Array<string | undefined>) {
    const selected = ids.filter((id): id is string => Boolean(id));
    if (!selected.length) return;
    const count = await this.prisma.mediaAsset.count({
      where: {
        id: { in: selected },
        status: 'ACTIVE',
        deletedAt: null,
        mediaType: 'IMAGE',
      },
    });
    if (count !== new Set(selected).size)
      throw bad(
        'EDITORIAL_MEDIA_INVALID',
        'Selected media must be an active, non-deleted image',
      );
  }
  private media(value: SafeMedia | null | undefined) {
    return value
      ? {
          id: value.id,
          url: value.publicUrl,
          title: value.title,
          alt: value.altText,
          width: value.width,
          height: value.height,
        }
      : null;
  }
  private section(row: {
    id: string;
    sectionKey: string;
    sectionType: string;
    eyebrow: string | null;
    heading: string | null;
    subheading: string | null;
    bodyJson: Prisma.JsonValue | null;
    primaryMedia?: SafeMedia | null;
    secondaryMedia?: SafeMedia | null;
    ctaLabel: string | null;
    ctaUrl: string | null;
    configurationJson: Prisma.JsonValue | null;
    displayOrder: number;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      sectionKey: row.sectionKey,
      sectionType: row.sectionType,
      eyebrow: row.eyebrow,
      heading: row.heading,
      subheading: row.subheading,
      bodyJson: row.bodyJson,
      primaryMedia: this.media(row.primaryMedia),
      secondaryMedia: this.media(row.secondaryMedia),
      ctaLabel: row.ctaLabel,
      ctaUrl: row.ctaUrl,
      configurationJson: row.configurationJson,
      displayOrder: row.displayOrder,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
  private faq(row: {
    id: string;
    question: string;
    answer: string;
    category: string | null;
    isFeatured: boolean;
    status: string;
    displayOrder: number;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      question: row.question,
      answer: row.answer,
      category: row.category,
      isFeatured: row.isFeatured,
      status: row.status,
      displayOrder: row.displayOrder,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
  private seo(row: {
    id: string;
    ownerType: string;
    ownerId: string;
    seoTitle: string;
    metaDescription: string;
    canonicalUrl: string | null;
    focusKeyword: string | null;
    ogTitle: string | null;
    ogDescription: string | null;
    ogMediaId: string | null;
    twitterTitle: string | null;
    twitterDescription: string | null;
    twitterMediaId: string | null;
    robotsIndex: boolean;
    robotsFollow: boolean;
    schemaJson: Prisma.JsonValue | null;
    hreflangJson: Prisma.JsonValue | null;
    createdAt: Date;
    updatedAt: Date;
    ogMedia?: SafeMedia | null;
    twitterMedia?: SafeMedia | null;
  }) {
    return {
      id: row.id,
      ownerType: row.ownerType,
      ownerId: row.ownerId,
      seoTitle: row.seoTitle,
      metaDescription: row.metaDescription,
      canonicalUrl: row.canonicalUrl,
      focusKeyword: row.focusKeyword,
      ogTitle: row.ogTitle,
      ogDescription: row.ogDescription,
      ogMediaId: row.ogMediaId,
      twitterTitle: row.twitterTitle,
      twitterDescription: row.twitterDescription,
      twitterMediaId: row.twitterMediaId,
      robotsIndex: row.robotsIndex,
      robotsFollow: row.robotsFollow,
      schemaJson: row.schemaJson,
      hreflangJson: row.hreflangJson,
      ogMedia: this.media(row.ogMedia),
      twitterMedia: this.media(row.twitterMedia),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
  private publicSeo(row: Parameters<CountryEditorialService['seo']>[0]) {
    const value = this.seo(row);
    return {
      seoTitle: value.seoTitle,
      metaDescription: value.metaDescription,
      canonicalUrl: value.canonicalUrl,
      ogTitle: value.ogTitle,
      ogDescription: value.ogDescription,
      ogMedia: value.ogMedia,
      twitterTitle: value.twitterTitle,
      twitterDescription: value.twitterDescription,
      twitterMedia: value.twitterMedia,
      robotsIndex: value.robotsIndex,
      robotsFollow: value.robotsFollow,
      schemaJson: value.schemaJson,
      hreflangJson: value.hreflangJson,
    };
  }
  private card(
    row: {
      id: string;
      title: string;
      slug: string;
      shortDescription: string;
      overview: string | null;
      iconMediaId: string | null;
      featuredMediaId: string | null;
      isFreeConsultation: boolean;
      ctaLabel: string;
      ctaUrl: string | null;
      status: string;
      isFeatured: boolean;
      displayOrder: number;
      publishedAt: Date | null;
      createdAt?: Date;
      updatedAt?: Date;
      iconMedia?: SafeMedia | null;
      featuredMedia?: SafeMedia | null;
    },
    publicOnly = false,
  ) {
    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      shortDescription: row.shortDescription,
      overview: row.overview,
      iconMediaId: row.iconMediaId,
      featuredMediaId: row.featuredMediaId,
      ...(publicOnly
        ? {
            iconMedia: this.media(row.iconMedia),
            featuredMedia: this.media(row.featuredMedia),
          }
        : {}),
      isFreeConsultation: row.isFreeConsultation,
      ctaLabel: row.ctaLabel,
      ctaUrl: row.ctaUrl,
      status: row.status,
      isFeatured: row.isFeatured,
      displayOrder: row.displayOrder,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      ...(!publicOnly && row.createdAt && row.updatedAt
        ? {
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
          }
        : {}),
    };
  }
}
