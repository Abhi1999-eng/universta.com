import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

export type Resource =
  | 'universities'
  | 'scholarships'
  | 'consultants'
  | 'jobs'
  | 'events'
  | 'success-stories'
  | 'testimonials'
  | 'pages'
  | 'navigation-menus'
  | 'contact-inquiries';

type Query = Record<string, string | undefined>;
type Data = Record<string, unknown>;

const PAGE_LIMIT = 12;
const MAX_LIMIT = 50;
const resourceModel: Record<Resource, string> = {
  universities: 'university',
  scholarships: 'scholarship',
  consultants: 'consultant',
  jobs: 'job',
  events: 'event',
  'success-stories': 'successStory',
  testimonials: 'testimonial',
  pages: 'page',
  'navigation-menus': 'navigationMenu',
  'contact-inquiries': 'contactInquiry',
};

function pageOf(query: Query) {
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

function publishedWhere() {
  return { status: 'PUBLISHED', deletedAt: null };
}

function contains(value: string | undefined) {
  return value?.trim() ? { contains: value.trim() } : undefined;
}

function idFrom(actor: { sub?: string } | undefined) {
  if (!actor?.sub)
    throw new BadRequestException('Authenticated admin is required');
  return actor.sub;
}

function contactNumber() {
  return `CT-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`;
}

function leadNumber() {
  return `LD-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
}

@Injectable()
export class ExpandedService {
  private readonly contactAttempts = new Map<string, number>();

  constructor(private readonly prisma: PrismaService) {}

  async editorial(slug: string) {
    const page = await this.prisma.page.findFirst({
      where: { slug, ...publishedWhere() },
      include: {
        sections: {
          where: { status: 'ACTIVE', deletedAt: null },
          orderBy: { displayOrder: 'asc' },
        },
      },
    });
    if (!page)
      throw new NotFoundException({
        code: 'PAGE_NOT_FOUND',
        message: 'Page not found',
        details: null,
      });
    return page;
  }

  async navigation(menuKey: string) {
    const menu = await this.prisma.navigationMenu.findFirst({
      where: { menuKey, status: 'ACTIVE' },
      include: {
        items: {
          where: { status: 'ACTIVE' },
          orderBy: { displayOrder: 'asc' },
          include: { page: { select: { slug: true } } },
        },
      },
    });
    return menu;
  }

  async list(
    resource: Exclude<
      Resource,
      'pages' | 'navigation-menus' | 'contact-inquiries'
    >,
    query: Query,
  ) {
    const { page, limit, skip } = pageOf(query);
    const q = contains(query.q);
    if (resource === 'universities') {
      const where: any = {
        ...publishedWhere(),
        ...(q ? { OR: [{ name: q }, { shortDescription: q }] } : {}),
        ...(query.country
          ? {
              country: {
                slug: query.country,
                status: 'PUBLISHED',
                deletedAt: null,
              },
            }
          : {}),
        ...(query.type ? { institutionType: query.type } : {}),
        ...(query.subject
          ? {
              offerings: {
                some: {
                  genericCourse: { subject: { slug: query.subject } },
                  ...publishedWhere(),
                },
              },
            }
          : {}),
      };
      const [data, total] = await this.prisma.$transaction([
        this.prisma.university.findMany({
          where,
          skip,
          take: limit,
          orderBy: [
            { isFeatured: 'desc' },
            { displayOrder: 'asc' },
            { name: 'asc' },
          ],
          include: {
            country: { select: { name: true, slug: true } },
            campuses: {
              where: { status: 'ACTIVE', deletedAt: null },
              select: { id: true },
            },
            _count: { select: { offerings: { where: publishedWhere() } } },
          },
        }),
        this.prisma.university.count({ where }),
      ]);
      return { data, meta: meta(page, limit, total) };
    }
    if (resource === 'scholarships') {
      const where: any = {
        ...publishedWhere(),
        ...(q ? { OR: [{ title: q }, { summary: q }] } : {}),
        ...(query.country
          ? { countries: { some: { country: { slug: query.country } } } }
          : {}),
        ...(query.university
          ? {
              universities: {
                some: { university: { slug: query.university } },
              },
            }
          : {}),
        ...(query.type ? { benefitType: query.type } : {}),
        ...(query.deadline === 'open'
          ? { OR: [{ deadline: null }, { deadline: { gte: new Date() } }] }
          : {}),
      };
      const [data, total] = await this.prisma.$transaction([
        this.prisma.scholarship.findMany({
          where,
          skip,
          take: limit,
          orderBy: [
            { isFeatured: 'desc' },
            { deadline: 'asc' },
            { title: 'asc' },
          ],
          include: {
            provider: true,
            countries: {
              include: { country: { select: { name: true, slug: true } } },
            },
            universities: {
              include: { university: { select: { name: true, slug: true } } },
            },
          },
        }),
        this.prisma.scholarship.count({ where }),
      ]);
      return { data, meta: meta(page, limit, total) };
    }
    if (resource === 'consultants') {
      const where: any = {
        ...publishedWhere(),
        ...(q
          ? { OR: [{ name: q }, { shortDescription: q }, { description: q }] }
          : {}),
        ...(query.location
          ? {
              locations: {
                some: {
                  location: {
                    slug: query.location,
                    status: 'ACTIVE',
                    deletedAt: null,
                  },
                },
              },
            }
          : {}),
        ...(query.country
          ? { countries: { some: { country: { slug: query.country } } } }
          : {}),
        ...(query.service
          ? { services: { some: { slug: query.service } } }
          : {}),
        ...(query.language
          ? { languages: { some: { name: { contains: query.language } } } }
          : {}),
        ...(query.verified === 'true'
          ? { verificationStatus: 'VERIFIED' }
          : {}),
      };
      const [data, total] = await this.prisma.$transaction([
        this.prisma.consultant.findMany({
          where,
          skip,
          take: limit,
          orderBy: [
            { isFeatured: 'desc' },
            { displayOrder: 'asc' },
            { name: 'asc' },
          ],
          include: {
            locations: { include: { location: true } },
            countries: {
              include: { country: { select: { name: true, slug: true } } },
            },
            services: true,
            languages: true,
          },
        }),
        this.prisma.consultant.count({ where }),
      ]);
      return { data, meta: meta(page, limit, total) };
    }
    // Prisma's generated delegates are selected by a validated resource key.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const delegate = this.prisma[
      resourceModel[resource] as keyof PrismaService
    ] as any;
    const titleField = resource === 'testimonials' ? 'quote' : 'title';
    const where: any = {
      ...publishedWhere(),
      ...(q ? { [titleField]: q } : {}),
    };
    if (resource === 'jobs')
      where.OR = [{ expiryDate: null }, { expiryDate: { gte: new Date() } }];
    const [data, total] = await Promise.all([
      delegate.findMany({
        where,
        skip,
        take: limit,
        orderBy:
          resource === 'events'
            ? [{ startsAt: 'asc' }]
            : [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
      }),
      delegate.count({ where }),
    ]);
    return { data, meta: meta(page, limit, Number(total)) };
  }

  async detail(
    resource: Exclude<
      Resource,
      'pages' | 'navigation-menus' | 'contact-inquiries'
    >,
    slug: string,
  ) {
    if (resource === 'universities') return this.universityDetail(slug);
    if (resource === 'scholarships')
      return (
        this.prisma.scholarship.findFirst({
          where: { slug, ...publishedWhere() },
          include: {
            provider: true,
            countries: { include: { country: true } },
            universities: { include: { university: true } },
            offerings: {
              include: {
                offering: {
                  include: {
                    university: true,
                    campus: true,
                    genericCourse: true,
                  },
                },
              },
            },
          },
        }) ?? this.notFound(resource)
      );
    if (resource === 'consultants')
      return (
        this.prisma.consultant.findFirst({
          where: { slug, ...publishedWhere() },
          include: {
            locations: {
              include: { location: { include: { country: true } } },
            },
            countries: { include: { country: true } },
            services: true,
            languages: true,
          },
        }) ?? this.notFound(resource)
      );
    // Prisma's generated delegates are selected by a validated resource key.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const delegate = this.prisma[
      resourceModel[resource] as keyof PrismaService
    ] as any;
    const row = await delegate.findFirst({
      where: { slug, ...publishedWhere() },
    });
    return row ?? this.notFound(resource);
  }

  private async universityDetail(slug: string) {
    const row = await this.prisma.university.findFirst({
      where: { slug, ...publishedWhere() },
      include: {
        country: true,
        campuses: {
          where: { status: 'ACTIVE', deletedAt: null },
          orderBy: { displayOrder: 'asc' },
        },
        accreditations: {
          where: { status: 'ACTIVE', deletedAt: null },
          orderBy: { displayOrder: 'asc' },
        },
        offerings: {
          where: publishedWhere(),
          include: {
            genericCourse: { include: { subject: true, courseLevel: true } },
            campus: true,
            intakes: { where: { status: 'ACTIVE' }, include: { intake: true } },
          },
          orderBy: { displayOrder: 'asc' },
        },
      },
    });
    return row ?? this.notFound('universities');
  }

  async universityOfferings(
    universitySlug: string,
    offeringSlug?: string,
    query: Query = {},
  ) {
    const university = await this.prisma.university.findFirst({
      where: { slug: universitySlug, ...publishedWhere() },
      select: { id: true, name: true, slug: true },
    });
    if (!university) return this.notFound('universities');
    const where: any = {
      universityId: university.id,
      ...publishedWhere(),
      ...(offeringSlug ? { slug: offeringSlug } : {}),
    };
    if (offeringSlug) {
      const row = await this.prisma.universityCourseOffering.findFirst({
        where,
        include: {
          university: { include: { country: true } },
          campus: true,
          genericCourse: {
            include: { subject: true, subSubject: true, courseLevel: true },
          },
          intakes: { where: { status: 'ACTIVE' }, include: { intake: true } },
          requirements: {
            where: { status: 'ACTIVE', deletedAt: null },
            orderBy: { displayOrder: 'asc' },
          },
        },
      });
      return row ?? this.notFound('offerings');
    }
    const { page, limit, skip } = pageOf(query);
    const [data, total] = await this.prisma.$transaction([
      this.prisma.universityCourseOffering.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { isFeatured: 'desc' },
          { displayOrder: 'asc' },
          { name: 'asc' },
        ],
        include: {
          campus: true,
          genericCourse: { include: { subject: true, courseLevel: true } },
          intakes: { where: { status: 'ACTIVE' }, include: { intake: true } },
        },
      }),
      this.prisma.universityCourseOffering.count({ where }),
    ]);
    return { university, data, meta: meta(page, limit, total) };
  }

  async consultantLocation(slug: string) {
    const location = await this.prisma.consultantLocation.findFirst({
      where: { slug, status: 'ACTIVE', deletedAt: null },
      include: {
        country: true,
        consultants: {
          include: {
            consultant: {
              include: {
                services: true,
                countries: { include: { country: true } },
                languages: true,
              },
            },
          },
        },
      },
    });
    return location ?? this.notFound('consultant locations');
  }

  async compare(
    type: 'countries' | 'universities' | 'courses' | 'consultants',
    items: string[],
  ) {
    const slugs = [
      ...new Set(
        items.map((item) => item.trim().toLowerCase()).filter(Boolean),
      ),
    ].slice(0, 3);
    if (!slugs.length) return { items: [], invalid: [] };
    if (type === 'countries') {
      const rows = await this.prisma.country.findMany({
        where: { slug: { in: slugs }, ...publishedWhere() },
        include: {
          costProfile: true,
          workProfile: true,
          languageRequirements: true,
          intakes: { include: { intake: true } },
          statistics: true,
        },
      });
      return this.ordered(slugs, rows);
    }
    if (type === 'universities')
      return this.ordered(
        slugs,
        await this.prisma.university.findMany({
          where: { slug: { in: slugs }, ...publishedWhere() },
          include: {
            country: true,
            campuses: true,
            accreditations: true,
            _count: { select: { offerings: { where: publishedWhere() } } },
          },
        }),
      );
    if (type === 'courses')
      return this.ordered(
        slugs,
        await this.prisma.universityCourseOffering.findMany({
          where: { slug: { in: slugs }, ...publishedWhere() },
          include: {
            university: true,
            campus: true,
            genericCourse: { include: { courseLevel: true } },
            intakes: { include: { intake: true } },
            requirements: true,
          },
        }),
      );
    return this.ordered(
      slugs,
      await this.prisma.consultant.findMany({
        where: { slug: { in: slugs }, ...publishedWhere() },
        include: {
          locations: { include: { location: true } },
          countries: { include: { country: true } },
          services: true,
          languages: true,
        },
      }),
    );
  }

  private ordered(slugs: string[], rows: Array<{ slug: string }>) {
    const bySlug = new Map(rows.map((row) => [row.slug, row]));
    return {
      items: slugs.flatMap((slug) =>
        bySlug.has(slug) ? [bySlug.get(slug)!] : [],
      ),
      invalid: slugs.filter((slug) => !bySlug.has(slug)),
    };
  }

  async createContact(dto: Data, origin?: string) {
    if (dto.companyWebsite) return { received: true };
    const fullName = this.requiredText(dto.fullName, 'fullName');
    const email = this.requiredEmail(dto.email);
    const message = this.requiredText(dto.message, 'message');
    if (dto.privacyConsent !== true)
      throw new UnprocessableEntityException({
        code: 'CONTACT_PRIVACY_REQUIRED',
        message: 'Privacy consent is required',
        details: null,
      });
    const key = `${email}:${origin ?? ''}`;
    const previous = this.contactAttempts.get(key) ?? 0;
    if (Date.now() - previous < 10_000) return { received: true };
    this.contactAttempts.set(key, Date.now());
    const row = await this.prisma.contactInquiry.create({
      data: {
        inquiryNumber: contactNumber(),
        fullName,
        email,
        phoneNumber: this.optionalText(dto.phoneNumber),
        subject: this.optionalText(dto.subject),
        message,
        privacyConsent: true,
      },
    });
    return { received: true, inquiryNumber: row.inquiryNumber };
  }

  async adminList(resource: Resource, query: Query) {
    const { page, limit, skip } = pageOf(query);
    // Prisma's generated delegates are selected by a validated resource key.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const delegate = this.prisma[
      resourceModel[resource] as keyof PrismaService
    ] as any;
    const q = contains(query.q);
    const where: any =
      resource === 'navigation-menus' ? {} : { deletedAt: null };
    if (q)
      where.OR =
        resource === 'contact-inquiries'
          ? [{ fullName: q }, { email: q }, { inquiryNumber: q }]
          : [{ name: q }, { title: q }, { slug: q }];
    if (query.status) where.status = query.status;
    const [data, total] = await Promise.all([
      delegate.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ updatedAt: 'desc' }],
      }),
      delegate.count({ where }),
    ]);
    return { data, meta: meta(page, limit, Number(total)) };
  }

  async adminDetail(resource: Resource, id: string) {
    // Prisma's generated delegates are selected by a validated resource key.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const delegate = this.prisma[
      resourceModel[resource] as keyof PrismaService
    ] as any;
    const row = await delegate.findFirst({
      where: resource === 'navigation-menus' ? { id } : { id, deletedAt: null },
    });
    return row ?? this.notFound(resource);
  }

  async adminCreate(
    resource: Exclude<Resource, 'contact-inquiries'>,
    body: Data,
  ) {
    // Prisma's generated delegates are selected by a validated resource key.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const delegate = this.prisma[
      resourceModel[resource] as keyof PrismaService
    ] as any;
    const data = this.writeData(resource, body);
    try {
      return await delegate.create({ data });
    } catch (error) {
      throw this.conflict(error);
    }
  }

  async adminUpdate(
    resource: Exclude<Resource, 'contact-inquiries'>,
    id: string,
    body: Data,
  ) {
    // Prisma's generated delegates are selected by a validated resource key.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const delegate = this.prisma[
      resourceModel[resource] as keyof PrismaService
    ] as any;
    await this.adminDetail(resource, id);
    try {
      return await delegate.update({
        where: { id },
        data: this.writeData(resource, body),
      });
    } catch (error) {
      throw this.conflict(error);
    }
  }

  async adminPublish(
    resource: Exclude<Resource, 'contact-inquiries'>,
    id: string,
    published: boolean,
  ) {
    // Prisma's generated delegates are selected by a validated resource key.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const delegate = this.prisma[
      resourceModel[resource] as keyof PrismaService
    ] as any;
    await this.adminDetail(resource, id);
    if (resource === 'navigation-menus')
      return delegate.update({
        where: { id },
        data: { status: published ? 'ACTIVE' : 'INACTIVE' },
      });
    return delegate.update({
      where: { id },
      data: {
        status: published ? 'PUBLISHED' : 'DRAFT',
        publishedAt: published ? new Date() : null,
      },
    });
  }

  async adminDelete(resource: Resource, id: string) {
    // Prisma's generated delegates are selected by a validated resource key.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const delegate = this.prisma[
      resourceModel[resource] as keyof PrismaService
    ] as any;
    await this.adminDetail(resource, id);
    if (resource === 'navigation-menus')
      return delegate.update({ where: { id }, data: { status: 'INACTIVE' } });
    return delegate.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        ...(resource === 'contact-inquiries' ? {} : { status: 'DRAFT' }),
      },
    });
  }

  async convertContact(id: string, actor: { sub?: string } | undefined) {
    const actorId = idFrom(actor);
    return this.prisma.$transaction(async (tx) => {
      const inquiry = await tx.contactInquiry.findFirst({
        where: { id, deletedAt: null },
      });
      if (!inquiry) return this.notFound('contact inquiry');
      if (inquiry.convertedLeadId)
        return tx.lead.findUnique({ where: { id: inquiry.convertedLeadId } });
      if (!inquiry.phoneNumber)
        throw new UnprocessableEntityException({
          code: 'CONTACT_PHONE_REQUIRED',
          message: 'A phone number is required before conversion',
          details: null,
        });
      const [firstName, ...last] = inquiry.fullName.trim().split(/\s+/);
      const lead = await tx.lead.create({
        data: {
          leadNumber: leadNumber(),
          formType: 'CONTACT_CONVERSION',
          sourceType: 'CONTACT_INQUIRY',
          sourceEntityId: inquiry.id,
          sourcePageUrl: '/contact',
          firstName,
          lastName: last.join(' ') || null,
          email: inquiry.email,
          phoneNumber: inquiry.phoneNumber,
          message: inquiry.message,
          status: 'NEW',
          priority: 'NORMAL',
          privacyConsent: true,
          landingPageUrl: '/contact',
        },
      });
      await tx.contactInquiry.update({
        where: { id },
        data: {
          convertedLeadId: lead.id,
          convertedByUserId: actorId,
          convertedAt: new Date(),
          status: 'CONVERTED',
        },
      });
      await tx.auditLog.create({
        data: {
          userId: actorId,
          module: 'CONTACT',
          entityType: 'ContactInquiry',
          entityId: id,
          action: 'CONVERT_TO_LEAD',
          newValues: { leadId: lead.id },
          description: 'Contact enquiry converted to counselling lead',
        },
      });
      return lead;
    });
  }

  private writeData(
    resource: Exclude<Resource, 'contact-inquiries'>,
    body: Data,
  ) {
    const ignored = new Set([
      'id',
      'createdAt',
      'updatedAt',
      'deletedAt',
      'publishedAt',
    ]);
    const data: Data = {};
    for (const [key, value] of Object.entries(body))
      if (!ignored.has(key) && value !== undefined)
        data[key] = typeof value === 'string' ? value.trim() : value;
    const title =
      typeof data.title === 'string'
        ? data.title
        : typeof data.name === 'string'
          ? data.name
          : null;
    if (
      resource !== 'navigation-menus' &&
      !title &&
      resource !== 'testimonials'
    )
      throw new UnprocessableEntityException({
        code: 'TITLE_REQUIRED',
        message: 'A title or name is required',
        details: null,
      });
    if (resource === 'testimonials' && !this.optionalText(data.quote))
      throw new UnprocessableEntityException({
        code: 'QUOTE_REQUIRED',
        message: 'A testimonial quote is required',
        details: null,
      });
    if (
      [
        'universities',
        'scholarships',
        'consultants',
        'jobs',
        'events',
        'success-stories',
        'pages',
      ].includes(resource) &&
      !this.optionalText(data.slug)
    )
      throw new UnprocessableEntityException({
        code: 'SLUG_REQUIRED',
        message: 'A slug is required',
        details: null,
      });
    return data;
  }

  private requiredText(value: unknown, name: string) {
    const text = this.optionalText(value);
    if (!text)
      throw new UnprocessableEntityException({
        code: 'VALIDATION_ERROR',
        message: `${name} is required`,
        details: null,
      });
    return text;
  }
  private optionalText(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }
  private requiredEmail(value: unknown) {
    const email = this.requiredText(value, 'email').toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new UnprocessableEntityException({
        code: 'VALIDATION_ERROR',
        message: 'A valid email is required',
        details: null,
      });
    return email;
  }
  private conflict(error: unknown) {
    if (
      typeof error === 'object' &&
      error &&
      (error as { code?: string }).code === 'P2002'
    )
      return new ConflictException({
        code: 'CONFLICT',
        message: 'A unique field already exists',
        details: null,
      });
    return error;
  }
  private notFound(resource: string): never {
    throw new NotFoundException({
      code: 'NOT_FOUND',
      message: `${resource} not found`,
      details: null,
    });
  }
}
