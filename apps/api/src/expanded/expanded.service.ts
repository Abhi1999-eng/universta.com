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
  | 'offerings'
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
  offerings: 'universityCourseOffering',
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
          where: { consultant: publishedWhere() },
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
    if (resource === 'universities') {
      const record = await this.prisma.university.findFirst({
        where: { id, deletedAt: null },
        include: {
          country: true,
          campuses: {
            where: { deletedAt: null },
            orderBy: { displayOrder: 'asc' },
          },
          accreditations: {
            where: { deletedAt: null },
            orderBy: { displayOrder: 'asc' },
          },
        },
      });
      return this.withSeo(resource, record ?? this.notFound(resource));
    }
    if (resource === 'offerings') {
      const record = await this.prisma.universityCourseOffering.findFirst({
        where: { id, deletedAt: null },
        include: {
          university: true,
          campus: true,
          genericCourse: true,
          courseLevel: true,
          intakes: {
            include: { intake: true },
            orderBy: { intake: { monthNumber: 'asc' } },
          },
          requirements: {
            where: { deletedAt: null },
            orderBy: { displayOrder: 'asc' },
          },
        },
      });
      return this.withSeo(resource, record ?? this.notFound(resource));
    }
    if (resource === 'scholarships') {
      const record = await this.prisma.scholarship.findFirst({
        where: { id, deletedAt: null },
        include: {
          provider: true,
          countries: { include: { country: true } },
          universities: { include: { university: true } },
          offerings: { include: { offering: true } },
        },
      });
      return this.withSeo(resource, record ?? this.notFound(resource));
    }
    if (resource === 'consultants') {
      const record = await this.prisma.consultant.findFirst({
        where: { id, deletedAt: null },
        include: {
          locations: { include: { location: true } },
          services: { orderBy: { displayOrder: 'asc' } },
          countries: { include: { country: true } },
          languages: true,
        },
      });
      return this.withSeo(resource, record ?? this.notFound(resource));
    }
    // Prisma's generated delegates are selected by a validated resource key.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const delegate = this.prisma[
      resourceModel[resource] as keyof PrismaService
    ] as any;
    const row = await delegate.findFirst({
      where: resource === 'navigation-menus' ? { id } : { id, deletedAt: null },
    });
    return this.withSeo(resource, row ?? this.notFound(resource));
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
      const created = await delegate.create({
        data: { ...data, ...this.relationWrites(resource, body, false) },
      });
      await this.saveSeo(resource, String(created.id), body.seo);
      return created;
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
      const updated = await delegate.update({
        where: { id },
        data: {
          ...this.writeData(resource, body, true),
          ...this.relationWrites(resource, body, true),
        },
      });
      await this.saveSeo(resource, id, body.seo);
      return updated;
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

  async formOptions() {
    const active = { deletedAt: null };
    const [
      countries,
      universities,
      offerings,
      courses,
      levels,
      modes,
      intakes,
      locations,
      providers,
      media,
    ] = await Promise.all([
      this.prisma.country.findMany({
        where: active,
        select: { id: true, name: true, slug: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.university.findMany({
        where: active,
        select: { id: true, name: true, slug: true, countryId: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.universityCourseOffering.findMany({
        where: active,
        select: { id: true, name: true, slug: true, universityId: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.course.findMany({
        where: active,
        select: { id: true, name: true, slug: true, courseLevelId: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.courseLevel.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true, code: true },
        orderBy: { educationOrder: 'asc' },
      }),
      this.prisma.studyMode.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.intake.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true, slug: true, monthNumber: true },
        orderBy: { monthNumber: 'asc' },
      }),
      this.prisma.consultantLocation.findMany({
        where: active,
        select: { id: true, name: true, slug: true, city: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.scholarshipProvider.findMany({
        where: active,
        select: { id: true, name: true, slug: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.mediaAsset.findMany({
        where: { status: 'ACTIVE', deletedAt: null },
        select: { id: true, altText: true, originalFileName: true },
        take: 100,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const campuses = await this.prisma.universityCampus.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, universityId: true },
      orderBy: { name: 'asc' },
    });
    return {
      countries,
      universities,
      offerings,
      courses,
      levels,
      modes,
      intakes,
      locations,
      providers,
      media,
      campuses,
    };
  }

  private relationWrites(
    resource: Exclude<Resource, 'contact-inquiries'>,
    body: Data,
    replace: boolean,
  ): Data {
    const strings = (value: unknown) =>
      Array.isArray(value)
        ? [
            ...new Set(
              value.filter(
                (item): item is string =>
                  typeof item === 'string' && item.trim() !== '',
              ),
            ),
          ]
        : [];
    const rows = (value: unknown) =>
      Array.isArray(value)
        ? value.filter(
            (item): item is Data =>
              Boolean(item) && typeof item === 'object' && !Array.isArray(item),
          )
        : [];
    const reset = replace ? { deleteMany: {} } : {};

    if (resource === 'universities') {
      const campuses = rows(body.campuses).filter(
        (row) => typeof row.name === 'string' && row.name.trim(),
      );
      const accreditations = rows(body.accreditations).filter(
        (row) => typeof row.name === 'string' && row.name.trim(),
      );
      return {
        ...(Array.isArray(body.campuses)
          ? {
              campuses: {
                ...reset,
                create: campuses.map((row, index) => ({
                  name: String(row.name).trim(),
                  slug:
                    this.optionalText(row.slug) ??
                    `${String(row.name)
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, '-')
                      .replace(/^-|-$/g, '')}-${index + 1}`,
                  city: this.optionalText(row.city),
                  state: this.optionalText(row.state),
                  address: this.optionalText(row.address),
                  overview: this.optionalText(row.overview),
                  status: 'ACTIVE',
                  displayOrder: index + 1,
                })),
              },
            }
          : {}),
        ...(Array.isArray(body.accreditations)
          ? {
              accreditations: {
                ...reset,
                create: accreditations.map((row, index) => ({
                  name: String(row.name).trim(),
                  accreditor: this.optionalText(row.accreditor),
                  referenceUrl: this.optionalText(row.referenceUrl),
                  verifiedAt: this.dateValue(row.verifiedAt),
                  status: 'ACTIVE',
                  displayOrder: index + 1,
                })),
              },
            }
          : {}),
      };
    }
    if (resource === 'offerings') {
      const intakes = rows(body.intakes).filter(
        (row) => typeof row.intakeId === 'string',
      );
      const requirements = rows(body.requirements).filter(
        (row) => typeof row.title === 'string' && row.title.trim(),
      );
      return {
        ...(Array.isArray(body.intakes)
          ? {
              intakes: {
                ...reset,
                create: intakes.map((row) => ({
                  intakeId: String(row.intakeId),
                  deadline: this.dateValue(row.deadline),
                  notes: this.optionalText(row.notes),
                  status: 'ACTIVE',
                })),
              },
            }
          : {}),
        ...(Array.isArray(body.requirements)
          ? {
              requirements: {
                ...reset,
                create: requirements.map((row, index) => ({
                  category: this.optionalText(row.category) ?? 'ACADEMIC',
                  title: String(row.title).trim(),
                  description: this.optionalText(row.description),
                  minimumScore: this.decimalValue(row.minimumScore),
                  status: 'ACTIVE',
                  displayOrder: index + 1,
                })),
              },
            }
          : {}),
      };
    }
    if (resource === 'scholarships') {
      const countryIds = strings(body.countryIds);
      const universityIds = strings(body.universityIds);
      const offeringIds = strings(body.offeringIds);
      return {
        ...(Array.isArray(body.countryIds)
          ? {
              countries: {
                ...reset,
                create: countryIds.map((countryId) => ({ countryId })),
              },
            }
          : {}),
        ...(Array.isArray(body.universityIds)
          ? {
              universities: {
                ...reset,
                create: universityIds.map((universityId) => ({ universityId })),
              },
            }
          : {}),
        ...(Array.isArray(body.offeringIds)
          ? {
              offerings: {
                ...reset,
                create: offeringIds.map((offeringId) => ({ offeringId })),
              },
            }
          : {}),
      };
    }
    if (resource === 'consultants') {
      const locationIds = strings(body.locationIds);
      const countryIds = strings(body.countryIds);
      const services = strings(body.services);
      const languages = strings(body.languages);
      return {
        ...(Array.isArray(body.locationIds)
          ? {
              locations: {
                ...reset,
                create: locationIds.map((locationId) => ({ locationId })),
              },
            }
          : {}),
        ...(Array.isArray(body.countryIds)
          ? {
              countries: {
                ...reset,
                create: countryIds.map((countryId) => ({ countryId })),
              },
            }
          : {}),
        ...(Array.isArray(body.services)
          ? {
              services: {
                ...reset,
                create: services.map((name, index) => ({
                  name,
                  slug: `${name
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-|-$/g, '')}-${index + 1}`,
                  displayOrder: index + 1,
                })),
              },
            }
          : {}),
        ...(Array.isArray(body.languages)
          ? {
              languages: {
                ...reset,
                create: languages.map((name) => ({ name })),
              },
            }
          : {}),
      };
    }
    return {};
  }

  private async saveSeo(resource: Resource, ownerId: string, value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    const seo = value as Data;
    const seoTitle = this.optionalText(seo.seoTitle);
    const metaDescription = this.optionalText(seo.metaDescription);
    if (!seoTitle || !metaDescription) return;
    await this.prisma.seoMetadata.upsert({
      where: { ownerType_ownerId: { ownerType: resource, ownerId } },
      update: {
        seoTitle,
        metaDescription,
        canonicalUrl: this.optionalText(seo.canonicalUrl),
        focusKeyword: this.optionalText(seo.focusKeyword),
        robotsIndex: seo.robotsIndex !== false,
        robotsFollow: seo.robotsFollow !== false,
      },
      create: {
        ownerType: resource,
        ownerId,
        seoTitle,
        metaDescription,
        canonicalUrl: this.optionalText(seo.canonicalUrl),
        focusKeyword: this.optionalText(seo.focusKeyword),
        robotsIndex: seo.robotsIndex !== false,
        robotsFollow: seo.robotsFollow !== false,
      },
    });
  }

  private async withSeo(resource: Resource, record: { id: unknown }) {
    const seo = await this.prisma.seoMetadata.findUnique({
      where: {
        ownerType_ownerId: { ownerType: resource, ownerId: String(record.id) },
      },
    });
    return { ...record, seo };
  }

  private decimalValue(value: unknown) {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private dateValue(value: unknown) {
    if (typeof value !== 'string' || !value.trim()) return undefined;
    const parsed = new Date(value);
    return Number.isNaN(parsed.valueOf()) ? undefined : parsed;
  }

  private writeData(
    resource: Exclude<Resource, 'contact-inquiries'>,
    body: Data,
    partial = false,
  ) {
    const ignored = new Set([
      'id',
      'createdAt',
      'updatedAt',
      'deletedAt',
      'publishedAt',
      'seo',
      'campuses',
      'accreditations',
      'intakes',
      'requirements',
      'countryIds',
      'universityIds',
      'offeringIds',
      'locationIds',
      'services',
      'languages',
      'speakers',
      'providerName',
    ]);
    const allowed: Partial<
      Record<Exclude<Resource, 'contact-inquiries'>, Set<string>>
    > = {
      universities: new Set([
        'countryId',
        'name',
        'slug',
        'institutionType',
        'shortDescription',
        'overview',
        'featuredMediaId',
        'sourceReference',
        'status',
        'displayOrder',
      ]),
      offerings: new Set([
        'universityId',
        'genericCourseId',
        'campusId',
        'name',
        'slug',
        'shortDescription',
        'overview',
        'courseLevelId',
        'studyMode',
        'durationMin',
        'durationMax',
        'durationUnit',
        'tuitionMin',
        'tuitionMax',
        'currencyCode',
        'tuitionPeriod',
        'applicationUrl',
        'sourceReference',
        'featuredMediaId',
        'status',
        'displayOrder',
      ]),
      scholarships: new Set([
        'providerId',
        'title',
        'slug',
        'summary',
        'description',
        'benefitType',
        'amount',
        'currencyCode',
        'eligibility',
        'deadline',
        'applicationUrl',
        'sourceReference',
        'featuredMediaId',
        'status',
        'displayOrder',
      ]),
      consultants: new Set([
        'name',
        'slug',
        'shortDescription',
        'description',
        'email',
        'phone',
        'websiteUrl',
        'verificationStatus',
        'sourceReference',
        'featuredMediaId',
        'status',
        'displayOrder',
      ]),
      jobs: new Set([
        'title',
        'slug',
        'summary',
        'department',
        'employmentType',
        'location',
        'remoteStatus',
        'description',
        'responsibilities',
        'qualifications',
        'publishedDate',
        'expiryDate',
        'applicationUrl',
        'applicationEmail',
        'status',
        'displayOrder',
      ]),
      events: new Set([
        'title',
        'slug',
        'summary',
        'description',
        'startsAt',
        'endsAt',
        'timezone',
        'eventType',
        'venue',
        'onlineUrl',
        'registrationUrl',
        'featuredMediaId',
        'status',
        'displayOrder',
      ]),
      'success-stories': new Set([
        'countryId',
        'universityId',
        'offeringId',
        'title',
        'slug',
        'journey',
        'attribution',
        'attributionNote',
        'featuredMediaId',
        'status',
        'displayOrder',
      ]),
      testimonials: new Set([
        'universityId',
        'offeringId',
        'quote',
        'attribution',
        'attributionNote',
        'imageMediaId',
        'status',
        'displayOrder',
      ]),
    };
    const data: Data = {};
    for (const [key, value] of Object.entries(body))
      if (
        !ignored.has(key) &&
        value !== undefined &&
        (!allowed[resource] || allowed[resource]?.has(key))
      )
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
      !partial &&
      resource !== 'testimonials'
    )
      throw new UnprocessableEntityException({
        code: 'TITLE_REQUIRED',
        message: 'A title or name is required',
        details: null,
      });
    if (
      resource === 'testimonials' &&
      !partial &&
      !this.optionalText(data.quote)
    )
      throw new UnprocessableEntityException({
        code: 'QUOTE_REQUIRED',
        message: 'A testimonial quote is required',
        details: null,
      });
    if (
      [
        'universities',
        'offerings',
        'scholarships',
        'consultants',
        'jobs',
        'events',
        'success-stories',
        'pages',
      ].includes(resource) &&
      !this.optionalText(data.slug) &&
      !partial
    )
      throw new UnprocessableEntityException({
        code: 'SLUG_REQUIRED',
        message: 'A slug is required',
        details: null,
      });
    if (resource === 'events' && Array.isArray(body.speakers))
      data.speakersJson = body.speakers;
    const normalizeDate = (key: string) => {
      if (!(key in data)) return;
      if (data[key] === null || data[key] === '') {
        data[key] = null;
        return;
      }
      const parsed = this.dateValue(data[key]);
      if (!parsed)
        throw new UnprocessableEntityException({
          code: 'VALIDATION_ERROR',
          message: `${key} must be a valid date`,
          details: null,
        });
      data[key] = parsed;
    };
    const normalizeDecimal = (key: string) => {
      if (!(key in data)) return;
      if (data[key] === null || data[key] === '') {
        data[key] = null;
        return;
      }
      const parsed = this.decimalValue(data[key]);
      if (parsed === undefined)
        throw new UnprocessableEntityException({
          code: 'VALIDATION_ERROR',
          message: `${key} must be a valid number`,
          details: null,
        });
      data[key] = parsed;
    };
    if (resource === 'offerings')
      for (const key of [
        'durationMin',
        'durationMax',
        'tuitionMin',
        'tuitionMax',
      ])
        normalizeDecimal(key);
    if (resource === 'scholarships') {
      normalizeDecimal('amount');
      normalizeDate('deadline');
    }
    if (resource === 'jobs') {
      normalizeDate('publishedDate');
      normalizeDate('expiryDate');
    }
    if (resource === 'events') {
      normalizeDate('startsAt');
      normalizeDate('endsAt');
      const startsAt = data.startsAt as Date | null | undefined;
      const endsAt = data.endsAt as Date | null | undefined;
      if (!startsAt)
        throw new UnprocessableEntityException({
          code: 'EVENT_START_REQUIRED',
          message: 'An event start date and time is required',
          details: null,
        });
      if (endsAt && endsAt <= startsAt)
        throw new UnprocessableEntityException({
          code: 'EVENT_DATE_RANGE_INVALID',
          message: 'Event end date and time must be after the start',
          details: null,
        });
    }
    if (data.status === 'PUBLISHED') data.publishedAt = new Date();
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
