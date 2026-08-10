import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type { Prisma } from '../generated/prisma/client';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { paginationMeta } from '../catalog/catalog.constants';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateCounsellingLeadDto,
  CreateLeadNoteDto,
  LeadListQueryDto,
  UpdateLeadStatusDto,
} from './dto/lead.dto';
import {
  LEAD_DUPLICATE_WINDOW_MS,
  LEAD_SOURCE_TYPES,
  LEAD_STATUSES,
  type LeadSourceType,
  type LeadStatus,
} from './leads.constants';

const LEAD_RELATIONS = {
  preferredCountry: { select: { id: true, name: true, slug: true } },
  preferredCourse: { select: { id: true, name: true, slug: true } },
  preferredSubject: { select: { id: true, name: true, slug: true } },
  preferredCourseLevel: {
    select: { id: true, code: true, name: true },
  },
  preferredIntake: {
    select: { id: true, slug: true, name: true, shortLabel: true },
  },
} satisfies Prisma.LeadInclude;

const LEAD_DETAIL_INCLUDE = {
  ...LEAD_RELATIONS,
  notes: {
    where: { deletedAt: null },
    orderBy: [{ isPinned: 'desc' as const }, { createdAt: 'desc' as const }],
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  },
  statusHistory: {
    orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
    include: {
      changedBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  },
} satisfies Prisma.LeadInclude;

type ResolvedSource = {
  sourceType: LeadSourceType;
  sourceEntityId: string | null;
  sourcePageUrl: string | null;
  preferredSubjectId: string | null;
  preferredCourseId: string | null;
};

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

function leadNotFound(): NotFoundException {
  return new NotFoundException({
    code: 'LEAD_NOT_FOUND',
    message: 'Lead not found',
    details: null,
  });
}

function splitName(fullName: string): {
  firstName: string;
  lastName: string | null;
} {
  const normalized = fullName.trim().replace(/\s+/g, ' ');
  const [firstName, ...rest] = normalized.split(' ');
  return { firstName, lastName: rest.length ? rest.join(' ') : null };
}

function nextLeadNumber(): string {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `LD-${day}-${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
}

function adminSummary(lead: Record<string, unknown>) {
  return lead;
}

@Injectable()
export class LeadsService {
  private readonly pendingDuplicateKeys = new Set<string>();
  private readonly duplicateSalt = randomUUID();

  constructor(private readonly prisma: PrismaService) {}

  async publicOptions() {
    const [countries, courseLevels, intakes] = await Promise.all([
      this.prisma.country.findMany({
        where: {
          status: 'PUBLISHED',
          deletedAt: null,
          continent: { status: 'ACTIVE', deletedAt: null },
        },
        select: { slug: true, name: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.courseLevel.findMany({
        where: { status: 'ACTIVE' },
        select: { code: true, name: true },
        orderBy: [
          { educationOrder: 'asc' },
          { displayOrder: 'asc' },
          { id: 'asc' },
        ],
      }),
      this.prisma.intake.findMany({
        where: { status: 'ACTIVE' },
        select: { slug: true, name: true, shortLabel: true },
        orderBy: [
          { displayOrder: 'asc' },
          { startMonth: 'asc' },
          { id: 'asc' },
        ],
      }),
    ]);
    return { countries, courseLevels, intakes };
  }

  async createPublic(dto: CreateCounsellingLeadDto) {
    if (dto.companyWebsite) return { received: true as const };
    const duplicateKey = createHash('sha256')
      .update(this.duplicateSalt)
      .update(dto.email)
      .update('\u0000')
      .update(dto.phoneNumber)
      .digest('hex');
    if (this.pendingDuplicateKeys.has(duplicateKey)) {
      return { received: true as const };
    }
    this.pendingDuplicateKeys.add(duplicateKey);
    try {
      const [country, courseLevel, intake, source] = await Promise.all([
        this.prisma.country.findFirst({
          where: {
            slug: dto.countrySlug,
            status: 'PUBLISHED',
            deletedAt: null,
            continent: { status: 'ACTIVE', deletedAt: null },
          },
          select: { id: true },
        }),
        this.prisma.courseLevel.findFirst({
          where: {
            code: dto.studyLevelCode,
            status: 'ACTIVE',
          },
          select: { id: true },
        }),
        this.prisma.intake.findFirst({
          where: {
            slug: dto.intakeSlug,
            status: 'ACTIVE',
          },
          select: { id: true },
        }),
        this.resolveSource(dto),
      ]);
      const invalid: Array<{
        property: string;
        code: string;
        message: string;
      }> = [];
      if (!country) {
        invalid.push({
          property: 'countrySlug',
          code: 'isAvailable',
          message: 'Interested country is not available',
        });
      }
      if (!courseLevel) {
        invalid.push({
          property: 'studyLevelCode',
          code: 'isAvailable',
          message: 'Study level is not available',
        });
      }
      if (!intake) {
        invalid.push({
          property: 'intakeSlug',
          code: 'isAvailable',
          message: 'Intended intake is not available',
        });
      }
      if (invalid.length) {
        throw new UnprocessableEntityException({
          code: 'LEAD_OPTIONS_INVALID',
          message: 'One or more counselling options are unavailable',
          details: invalid,
        });
      }

      const duplicateSince = new Date(Date.now() - LEAD_DUPLICATE_WINDOW_MS);
      const duplicate = await this.prisma.lead.findFirst({
        where: {
          email: dto.email,
          phoneNumber: dto.phoneNumber,
          createdAt: { gte: duplicateSince },
          deletedAt: null,
        },
        select: { id: true },
      });
      if (duplicate) return { received: true as const };

      const name = splitName(dto.fullName);
      await this.prisma.$transaction(async (transaction) => {
        const lead = await transaction.lead.create({
          data: {
            leadNumber: nextLeadNumber(),
            formType: 'COUNSELLING',
            sourceType: source.sourceType,
            sourceEntityId: source.sourceEntityId,
            sourcePageUrl: source.sourcePageUrl,
            firstName: name.firstName,
            lastName: name.lastName,
            email: dto.email,
            phoneNumber: dto.phoneNumber,
            preferredCountryId: country!.id,
            preferredCourseLevelId: courseLevel!.id,
            preferredIntakeId: intake!.id,
            preferredSubjectId: source.preferredSubjectId,
            preferredCourseId: source.preferredCourseId,
            message: dto.message || null,
            status: 'NEW',
            priority: 'NORMAL',
            privacyConsent: true,
            marketingConsent: false,
            utmSource: dto.utmSource || null,
            utmMedium: dto.utmMedium || null,
            utmCampaign: dto.utmCampaign || null,
            referrerUrl: dto.referringPath || null,
            landingPageUrl: dto.landingPagePath || '/counselling',
          },
        });
        await transaction.leadStatusHistory.create({
          data: { leadId: lead.id, oldStatus: null, newStatus: 'NEW' },
        });
        await transaction.auditLog.create({
          data: {
            module: 'LEADS',
            entityType: 'LEAD',
            entityId: lead.id,
            action: 'LEAD_CREATED',
            newValues: {
              formType: 'COUNSELLING',
              sourceType: source.sourceType,
              status: 'NEW',
              privacyConsent: true,
            },
            description: 'Public counselling lead received',
          },
        });
      });
      return { received: true as const };
    } finally {
      this.pendingDuplicateKeys.delete(duplicateKey);
    }
  }

  async adminOptions() {
    const [countries, courseLevels, intakes] = await Promise.all([
      this.prisma.country.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.courseLevel.findMany({
        where: {},
        select: { id: true, code: true, name: true },
        orderBy: [
          { educationOrder: 'asc' },
          { displayOrder: 'asc' },
          { id: 'asc' },
        ],
      }),
      this.prisma.intake.findMany({
        where: {},
        select: { id: true, name: true, shortLabel: true },
        orderBy: [
          { displayOrder: 'asc' },
          { startMonth: 'asc' },
          { id: 'asc' },
        ],
      }),
    ]);
    return {
      statuses: LEAD_STATUSES,
      sourceTypes: LEAD_SOURCE_TYPES,
      countries,
      courseLevels,
      intakes,
    };
  }

  async adminList(query: LeadListQueryDto) {
    const where = this.listWhere(query);
    const [total, leads] = await Promise.all([
      this.prisma.lead.count({ where }),
      this.prisma.lead.findMany({
        where,
        include: LEAD_RELATIONS,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);
    return {
      data: leads.map((lead) => adminSummary(lead)),
      meta: paginationMeta(query.page, query.limit, total),
    };
  }

  async adminDetail(id: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, deletedAt: null },
      include: LEAD_DETAIL_INCLUDE,
    });
    if (!lead) throw leadNotFound();
    const audit = await this.prisma.auditLog.findMany({
      where: { entityType: 'LEAD', entityId: id, module: 'LEADS' },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return { ...lead, audit };
  }

  async updateStatus(
    id: string,
    dto: UpdateLeadStatusDto,
    request: AuthenticatedRequest,
  ) {
    const userId = actorId(request);
    const nextStatus = dto.status as LeadStatus;
    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.lead.findFirst({
        where: { id, deletedAt: null },
        include: LEAD_RELATIONS,
      });
      if (!current) throw leadNotFound();
      if (current.updatedAt.toISOString() !== dto.expectedUpdatedAt) {
        throw new ConflictException({
          code: 'LEAD_STALE_VERSION',
          message: 'The lead changed in another session',
          details: null,
        });
      }
      if (current.status === nextStatus) return current;
      const updated = await transaction.lead.updateMany({
        where: { id, updatedAt: current.updatedAt, deletedAt: null },
        data: { status: nextStatus },
      });
      if (updated.count !== 1) {
        throw new ConflictException({
          code: 'LEAD_STALE_VERSION',
          message: 'The lead changed in another session',
          details: null,
        });
      }
      await transaction.leadStatusHistory.create({
        data: {
          leadId: id,
          oldStatus: current.status,
          newStatus: nextStatus,
          changedByUserId: userId,
          reason: dto.reason || null,
        },
      });
      await transaction.auditLog.create({
        data: {
          userId,
          module: 'LEADS',
          entityType: 'LEAD',
          entityId: id,
          action: 'LEAD_STATUS_UPDATED',
          oldValues: { status: current.status },
          newValues: { status: nextStatus },
          description: 'Lead status updated',
          requestId: request.requestId ?? null,
        },
      });
      return transaction.lead.findUniqueOrThrow({
        where: { id },
        include: LEAD_RELATIONS,
      });
    });
  }

  async createNote(
    id: string,
    dto: CreateLeadNoteDto,
    request: AuthenticatedRequest,
  ) {
    const userId = actorId(request);
    return this.prisma.$transaction(async (transaction) => {
      const lead = await transaction.lead.findFirst({
        where: { id, deletedAt: null },
        select: { id: true },
      });
      if (!lead) throw leadNotFound();
      const note = await transaction.leadNote.create({
        data: {
          leadId: id,
          userId,
          noteType: dto.noteType,
          note: dto.note,
          isPinned: dto.isPinned,
        },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });
      await transaction.auditLog.create({
        data: {
          userId,
          module: 'LEADS',
          entityType: 'LEAD',
          entityId: id,
          action: 'LEAD_NOTE_CREATED',
          newValues: {
            noteType: dto.noteType,
            isPinned: dto.isPinned,
          },
          description: 'Internal lead note added',
          requestId: request.requestId ?? null,
        },
      });
      return note;
    });
  }

  private listWhere(query: LeadListQueryDto): Prisma.LeadWhereInput {
    const createdAt: Prisma.DateTimeFilter = {};
    if (query.createdFrom)
      createdAt.gte = new Date(`${query.createdFrom}T00:00:00.000Z`);
    if (query.createdTo) {
      const end = new Date(`${query.createdTo}T00:00:00.000Z`);
      end.setUTCDate(end.getUTCDate() + 1);
      createdAt.lt = end;
    }
    const digits = query.q?.replace(/\D/g, '');
    const search: Prisma.LeadWhereInput[] = query.q
      ? [
          { firstName: { contains: query.q } },
          { lastName: { contains: query.q } },
          { email: { contains: query.q.toLowerCase() } },
          ...(digits ? [{ phoneNumber: { contains: digits } }] : []),
        ]
      : [];
    return {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.countryId ? { preferredCountryId: query.countryId } : {}),
      ...(query.courseLevelId
        ? { preferredCourseLevelId: query.courseLevelId }
        : {}),
      ...(query.intakeId ? { preferredIntakeId: query.intakeId } : {}),
      ...(query.sourceType ? { sourceType: query.sourceType } : {}),
      ...(Object.keys(createdAt).length ? { createdAt } : {}),
      ...(search.length ? { OR: search } : {}),
    };
  }

  private async resolveSource(
    dto: CreateCounsellingLeadDto,
  ): Promise<ResolvedSource> {
    const fallback: ResolvedSource = {
      sourceType: 'GENERAL',
      sourceEntityId: null,
      sourcePageUrl: dto.sourcePagePath || null,
      preferredSubjectId: null,
      preferredCourseId: null,
    };
    if (dto.sourceType === 'country' && dto.sourceCountrySlug) {
      const country = await this.prisma.country.findFirst({
        where: {
          slug: dto.sourceCountrySlug,
          status: 'PUBLISHED',
          deletedAt: null,
        },
        select: { id: true },
      });
      return country
        ? { ...fallback, sourceType: 'COUNTRY', sourceEntityId: country.id }
        : fallback;
    }
    if (dto.sourceType === 'subject' && dto.sourceSubjectSlug) {
      const subject = await this.prisma.subject.findFirst({
        where: {
          slug: dto.sourceSubjectSlug,
          status: 'PUBLISHED',
          deletedAt: null,
        },
        select: { id: true },
      });
      return subject
        ? {
            ...fallback,
            sourceType: 'SUBJECT',
            sourceEntityId: subject.id,
            preferredSubjectId: subject.id,
          }
        : fallback;
    }
    if (dto.sourceType === 'specialization' && dto.sourceSpecializationSlug) {
      const specialization = await this.prisma.subSubject.findFirst({
        where: {
          slug: dto.sourceSpecializationSlug,
          status: 'PUBLISHED',
          deletedAt: null,
          subject: { status: 'PUBLISHED', deletedAt: null },
        },
        select: { id: true, subjectId: true },
      });
      return specialization
        ? {
            ...fallback,
            sourceType: 'SPECIALIZATION',
            sourceEntityId: specialization.id,
            preferredSubjectId: specialization.subjectId,
          }
        : fallback;
    }
    if (dto.sourceType === 'course' && dto.sourceCourseSlug) {
      const course = await this.prisma.course.findFirst({
        where: {
          slug: dto.sourceCourseSlug,
          status: 'PUBLISHED',
          deletedAt: null,
          subject: { status: 'PUBLISHED', deletedAt: null },
        },
        select: { id: true, subjectId: true },
      });
      return course
        ? {
            ...fallback,
            sourceType: 'COURSE',
            sourceEntityId: course.id,
            preferredSubjectId: course.subjectId,
            preferredCourseId: course.id,
          }
        : fallback;
    }
    return fallback;
  }
}
