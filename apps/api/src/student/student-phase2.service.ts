import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailDeliveryService } from './email-delivery.service';

const PUBLISHED = 'PUBLISHED';

function failure(
  code: string,
  message: string,
  status = HttpStatus.BAD_REQUEST,
) {
  return new HttpException({ code, message, details: null }, status);
}

function notFound(message: string) {
  return failure('NOT_FOUND', message, HttpStatus.NOT_FOUND);
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

@Injectable()
export class StudentPhase2Service {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailDeliveryService,
  ) {}

  private async profileIdFor(userId: string) {
    const profile = await this.prisma.studentProfile.upsert({
      where: { userId },
      create: { userId },
      update: {},
      select: { id: true, referralCode: true },
    });
    return profile;
  }

  private async assertOwnDocuments(profileId: string, documentIds: string[]) {
    const ids = [...new Set(documentIds)];
    if (!ids.length) return ids;
    const count = await this.prisma.studentDocument.count({
      where: { id: { in: ids }, studentProfileId: profileId },
    });
    if (count !== ids.length) throw notFound('One or more student documents');
    return ids;
  }

  private async notify(
    profileId: string,
    type: string,
    title: string,
    href?: string,
  ) {
    await this.prisma.studentNotification.create({
      data: { studentProfileId: profileId, type, title, href: href ?? null },
    });
    const recipient = await this.prisma.studentProfile.findUnique({
      where: { id: profileId },
      select: { user: { select: { id: true, email: true } } },
    });
    if (recipient?.user) {
      this.email.sendPortalNotification({
        userId: recipient.user.id,
        email: recipient.user.email,
        subject: title,
      });
    }
  }

  // -- saved catalogue ---------------------------------------------------

  async listSaved(userId: string) {
    const { id } = await this.profileIdFor(userId);
    const [universities, offerings, scholarships] = await Promise.all([
      this.prisma.studentSavedUniversity.findMany({
        where: { studentProfileId: id },
        include: {
          university: {
            select: {
              id: true,
              name: true,
              slug: true,
              status: true,
              country: { select: { name: true, slug: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.studentSavedOffering.findMany({
        where: { studentProfileId: id },
        include: {
          offering: {
            select: {
              id: true,
              name: true,
              slug: true,
              status: true,
              university: { select: { name: true, slug: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.studentSavedScholarship.findMany({
        where: { studentProfileId: id },
        include: {
          scholarship: {
            select: {
              id: true,
              title: true,
              slug: true,
              status: true,
              deadline: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return { universities, offerings, scholarships };
  }

  async saveUniversity(userId: string, universityId: string) {
    const [{ id }, university] = await Promise.all([
      this.profileIdFor(userId),
      this.prisma.university.findFirst({
        where: { id: universityId, status: PUBLISHED, deletedAt: null },
        select: { id: true },
      }),
    ]);
    if (!university) throw notFound('Published university');
    await this.prisma.studentSavedUniversity.upsert({
      where: {
        studentProfileId_universityId: { studentProfileId: id, universityId },
      },
      create: { studentProfileId: id, universityId },
      update: {},
    });
    return { saved: true };
  }

  async removeUniversity(userId: string, universityId: string) {
    const { id } = await this.profileIdFor(userId);
    await this.prisma.studentSavedUniversity.deleteMany({
      where: { studentProfileId: id, universityId },
    });
    return { saved: false };
  }

  async saveOffering(userId: string, offeringId: string) {
    const [{ id }, offering] = await Promise.all([
      this.profileIdFor(userId),
      this.prisma.universityCourseOffering.findFirst({
        where: {
          id: offeringId,
          status: PUBLISHED,
          deletedAt: null,
          university: { status: PUBLISHED, deletedAt: null },
        },
        select: { id: true },
      }),
    ]);
    if (!offering) throw notFound('Published university course offering');
    await this.prisma.studentSavedOffering.upsert({
      where: {
        studentProfileId_offeringId: { studentProfileId: id, offeringId },
      },
      create: { studentProfileId: id, offeringId },
      update: {},
    });
    return { saved: true };
  }

  async removeOffering(userId: string, offeringId: string) {
    const { id } = await this.profileIdFor(userId);
    await this.prisma.studentSavedOffering.deleteMany({
      where: { studentProfileId: id, offeringId },
    });
    return { saved: false };
  }

  async saveScholarship(userId: string, scholarshipId: string) {
    const [{ id }, scholarship] = await Promise.all([
      this.profileIdFor(userId),
      this.prisma.scholarship.findFirst({
        where: { id: scholarshipId, status: PUBLISHED, deletedAt: null },
        select: { id: true },
      }),
    ]);
    if (!scholarship) throw notFound('Published scholarship');
    await this.prisma.studentSavedScholarship.upsert({
      where: {
        studentProfileId_scholarshipId: { studentProfileId: id, scholarshipId },
      },
      create: { studentProfileId: id, scholarshipId },
      update: {},
    });
    return { saved: true };
  }

  async removeScholarship(userId: string, scholarshipId: string) {
    const { id } = await this.profileIdFor(userId);
    await this.prisma.studentSavedScholarship.deleteMany({
      where: { studentProfileId: id, scholarshipId },
    });
    return { saved: false };
  }

  // -- university applications -----------------------------------------

  async startApplication(
    userId: string,
    dto: { offeringId: string; intakeId?: string; documentIds?: string[] },
  ) {
    const profile = await this.profileIdFor(userId);
    const offering = await this.prisma.universityCourseOffering.findFirst({
      where: {
        id: dto.offeringId,
        status: PUBLISHED,
        deletedAt: null,
        university: { status: PUBLISHED, deletedAt: null },
      },
      include: {
        university: { select: { id: true, name: true } },
        intakes: { where: { status: 'ACTIVE' }, select: { intakeId: true } },
      },
    });
    if (!offering) throw notFound('Published university course offering');
    if (
      dto.intakeId &&
      !offering.intakes.some((entry) => entry.intakeId === dto.intakeId)
    ) {
      throw failure(
        'VALIDATION_ERROR',
        'The selected intake is not available for this offering',
      );
    }
    const documentIds = await this.assertOwnDocuments(
      profile.id,
      dto.documentIds ?? [],
    );
    const existing = await this.prisma.studentApplication.findFirst({
      where: {
        studentProfileId: profile.id,
        offeringId: offering.id,
        status: { notIn: ['WITHDRAWN', 'REJECTED'] },
      },
      select: { id: true },
    });
    if (existing) return { id: existing.id, existing: true };
    const created = await this.prisma.$transaction(async (tx) => {
      const application = await tx.studentApplication.create({
        data: {
          studentProfileId: profile.id,
          universityId: offering.university.id,
          offeringId: offering.id,
          targetIntakeId: dto.intakeId ?? null,
          universityNameSnapshot: offering.university.name,
          offeringNameSnapshot: offering.name,
          timeline: {
            create: {
              status: 'APPLICATION_STARTED',
              actorType: 'STUDENT',
              message: 'Application started',
            },
          },
          documents: documentIds.length
            ? {
                createMany: {
                  data: documentIds.map((studentDocumentId) => ({
                    studentDocumentId,
                  })),
                },
              }
            : undefined,
        },
        select: { id: true },
      });
      await tx.studentNotification.create({
        data: {
          studentProfileId: profile.id,
          type: 'APPLICATION_STARTED',
          title: 'Application started',
          href: `/student/applications/${application.id}`,
        },
      });
      return application;
    });
    return { id: created.id, existing: false };
  }

  async listApplications(userId: string) {
    const { id } = await this.profileIdFor(userId);
    return this.prisma.studentApplication.findMany({
      where: { studentProfileId: id },
      include: {
        university: { select: { name: true, slug: true } },
        offering: { select: { name: true, slug: true } },
        targetIntake: { select: { name: true, slug: true } },
        timeline: { orderBy: { createdAt: 'asc' } },
        documents: {
          include: {
            studentDocument: {
              select: { id: true, title: true, documentType: true },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  private async ownApplication(userId: string, applicationId: string) {
    const { id } = await this.profileIdFor(userId);
    const application = await this.prisma.studentApplication.findFirst({
      where: { id: applicationId, studentProfileId: id },
    });
    if (!application) throw notFound('Application');
    return { profileId: id, application };
  }

  async submitApplication(
    userId: string,
    applicationId: string,
    message?: string,
  ) {
    const { profileId, application } = await this.ownApplication(
      userId,
      applicationId,
    );
    if (application.status !== 'APPLICATION_STARTED')
      throw failure(
        'INVALID_STATE',
        'Only started applications can be submitted',
      );
    await this.prisma.$transaction([
      this.prisma.studentApplication.update({
        where: { id: applicationId },
        data: { status: 'SUBMITTED', submittedAt: new Date() },
      }),
      this.prisma.studentApplicationTimeline.create({
        data: {
          applicationId,
          status: 'SUBMITTED',
          actorType: 'STUDENT',
          message: message ?? 'Application submitted',
        },
      }),
    ]);
    await this.notify(
      profileId,
      'APPLICATION_SUBMITTED',
      'Application submitted',
      `/student/applications/${applicationId}`,
    );
    return { status: 'SUBMITTED' };
  }

  async withdrawApplication(
    userId: string,
    applicationId: string,
    message?: string,
  ) {
    const { profileId, application } = await this.ownApplication(
      userId,
      applicationId,
    );
    if (
      ['WITHDRAWN', 'REJECTED', 'OFFER_RECEIVED'].includes(application.status)
    )
      throw failure('INVALID_STATE', 'This application cannot be withdrawn');
    await this.prisma.$transaction([
      this.prisma.studentApplication.update({
        where: { id: applicationId },
        data: { status: 'WITHDRAWN' },
      }),
      this.prisma.studentApplicationTimeline.create({
        data: {
          applicationId,
          status: 'WITHDRAWN',
          actorType: 'STUDENT',
          message: message ?? 'Application withdrawn',
        },
      }),
    ]);
    await this.notify(
      profileId,
      'APPLICATION_WITHDRAWN',
      'Application withdrawn',
      `/student/applications/${applicationId}`,
    );
    return { status: 'WITHDRAWN' };
  }

  async decideOffer(
    userId: string,
    applicationId: string,
    decision: 'ACCEPTED' | 'REJECTED',
    message?: string,
  ) {
    const { profileId, application } = await this.ownApplication(
      userId,
      applicationId,
    );
    if (application.status !== 'OFFER_RECEIVED' || application.offerDecision)
      throw failure('INVALID_STATE', 'There is no pending offer to decide');
    await this.prisma.$transaction([
      this.prisma.studentApplication.update({
        where: { id: applicationId },
        data: { offerDecision: decision, offerDecisionAt: new Date() },
      }),
      this.prisma.studentApplicationTimeline.create({
        data: {
          applicationId,
          status: `OFFER_${decision}`,
          actorType: 'STUDENT',
          message: message ?? `Offer ${decision.toLowerCase()}`,
        },
      }),
    ]);
    await this.notify(
      profileId,
      'OFFER_DECISION',
      `Offer ${decision.toLowerCase()}`,
      `/student/applications/${applicationId}`,
    );
    return { decision };
  }

  async attachApplicationDocuments(
    userId: string,
    applicationId: string,
    documentIds: string[],
  ) {
    const { profileId } = await this.ownApplication(userId, applicationId);
    const ids = await this.assertOwnDocuments(profileId, documentIds);
    if (ids.length)
      await this.prisma.studentApplicationDocument.createMany({
        data: ids.map((studentDocumentId) => ({
          applicationId,
          studentDocumentId,
        })),
        skipDuplicates: true,
      });
    return { attached: ids.length };
  }

  // -- scholarship applications ----------------------------------------

  async startScholarshipApplication(
    userId: string,
    dto: { scholarshipId: string; documentIds?: string[] },
  ) {
    const profile = await this.profileIdFor(userId);
    const scholarship = await this.prisma.scholarship.findFirst({
      where: { id: dto.scholarshipId, status: PUBLISHED, deletedAt: null },
      select: { id: true, title: true },
    });
    if (!scholarship) throw notFound('Published scholarship');
    const documentIds = await this.assertOwnDocuments(
      profile.id,
      dto.documentIds ?? [],
    );
    const existing = await this.prisma.studentScholarshipApplication.findUnique(
      {
        where: {
          studentProfileId_scholarshipId: {
            studentProfileId: profile.id,
            scholarshipId: scholarship.id,
          },
        },
        select: { id: true },
      },
    );
    if (existing) return { id: existing.id, existing: true };
    const application = await this.prisma.studentScholarshipApplication.create({
      data: {
        studentProfileId: profile.id,
        scholarshipId: scholarship.id,
        scholarshipTitleSnapshot: scholarship.title,
        timeline: {
          create: {
            status: 'STARTED',
            actorType: 'STUDENT',
            message: 'Scholarship application started',
          },
        },
        documents: documentIds.length
          ? {
              createMany: {
                data: documentIds.map((studentDocumentId) => ({
                  studentDocumentId,
                })),
              },
            }
          : undefined,
      },
      select: { id: true },
    });
    await this.notify(
      profile.id,
      'SCHOLARSHIP_STARTED',
      'Scholarship application started',
      `/student/scholarship-applications/${application.id}`,
    );
    return { id: application.id, existing: false };
  }

  async listScholarshipApplications(userId: string) {
    const { id } = await this.profileIdFor(userId);
    return this.prisma.studentScholarshipApplication.findMany({
      where: { studentProfileId: id },
      include: {
        scholarship: { select: { title: true, slug: true, deadline: true } },
        timeline: { orderBy: { createdAt: 'asc' } },
        documents: {
          include: {
            studentDocument: {
              select: { id: true, title: true, documentType: true },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  private async ownScholarshipApplication(
    userId: string,
    applicationId: string,
  ) {
    const { id } = await this.profileIdFor(userId);
    const application =
      await this.prisma.studentScholarshipApplication.findFirst({
        where: { id: applicationId, studentProfileId: id },
      });
    if (!application) throw notFound('Scholarship application');
    return { profileId: id, application };
  }

  async submitScholarshipApplication(
    userId: string,
    applicationId: string,
    message?: string,
  ) {
    const { profileId, application } = await this.ownScholarshipApplication(
      userId,
      applicationId,
    );
    if (application.status !== 'STARTED')
      throw failure(
        'INVALID_STATE',
        'Only started scholarship applications can be submitted',
      );
    await this.prisma.$transaction([
      this.prisma.studentScholarshipApplication.update({
        where: { id: applicationId },
        data: { status: 'SUBMITTED', submittedAt: new Date() },
      }),
      this.prisma.studentScholarshipTimeline.create({
        data: {
          scholarshipApplicationId: applicationId,
          status: 'SUBMITTED',
          actorType: 'STUDENT',
          message: message ?? 'Scholarship application submitted',
        },
      }),
    ]);
    await this.notify(
      profileId,
      'SCHOLARSHIP_SUBMITTED',
      'Scholarship application submitted',
      `/student/scholarship-applications/${applicationId}`,
    );
    return { status: 'SUBMITTED' };
  }

  async attachScholarshipDocuments(
    userId: string,
    applicationId: string,
    documentIds: string[],
  ) {
    const { profileId } = await this.ownScholarshipApplication(
      userId,
      applicationId,
    );
    const ids = await this.assertOwnDocuments(profileId, documentIds);
    if (ids.length)
      await this.prisma.studentScholarshipDocument.createMany({
        data: ids.map((studentDocumentId) => ({
          scholarshipApplicationId: applicationId,
          studentDocumentId,
        })),
        skipDuplicates: true,
      });
    return { attached: ids.length };
  }

  // -- conversations, notifications, support ---------------------------

  async conversation(userId: string) {
    const { id } = await this.profileIdFor(userId);
    const assignment = await this.prisma.studentConsultantAssignment.findFirst({
      where: { studentProfileId: id, status: 'ACTIVE' },
      orderBy: { assignedAt: 'desc' },
    });
    const conversation = await this.prisma.studentConversation.upsert({
      where: {
        id:
          (
            await this.prisma.studentConversation.findFirst({
              where: {
                studentProfileId: id,
                consultantAssignmentId: assignment?.id ?? null,
              },
              select: { id: true },
            })
          )?.id ?? '00000000-0000-0000-0000-000000000000',
      },
      create: {
        studentProfileId: id,
        consultantAssignmentId: assignment?.id ?? null,
      },
      update: {},
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    return conversation;
  }

  async sendMessage(userId: string, body: string) {
    const { id } = await this.profileIdFor(userId);
    const conversation = await this.conversation(userId);
    const message = await this.prisma.studentMessage.create({
      data: {
        conversationId: conversation.id,
        senderType: 'STUDENT',
        studentSenderId: userId,
        body: body.trim(),
      },
    });
    await this.prisma.studentConversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });
    await this.notify(id, 'MESSAGE_SENT', 'Message sent', '/student/messages');
    return message;
  }

  async notifications(userId: string) {
    const { id } = await this.profileIdFor(userId);
    return this.prisma.studentNotification.findMany({
      where: { studentProfileId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async markNotificationRead(userId: string, notificationId: string) {
    const { id } = await this.profileIdFor(userId);
    const result = await this.prisma.studentNotification.updateMany({
      where: { id: notificationId, studentProfileId: id },
      data: { readAt: new Date() },
    });
    if (!result.count) throw notFound('Notification');
    return { read: true };
  }

  async listSupportTickets(userId: string) {
    const { id } = await this.profileIdFor(userId);
    return this.prisma.studentSupportTicket.findMany({
      where: { studentProfileId: id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createSupportTicket(
    userId: string,
    dto: { category: string; subject: string; body: string },
  ) {
    const { id } = await this.profileIdFor(userId);
    return this.prisma.studentSupportTicket.create({
      data: {
        studentProfileId: id,
        category: dto.category,
        subject: dto.subject.trim(),
        messages: {
          create: {
            senderType: 'STUDENT',
            senderUserId: userId,
            body: dto.body.trim(),
          },
        },
      },
      include: { messages: true },
    });
  }

  async replySupportTicket(userId: string, ticketId: string, body: string) {
    const { id } = await this.profileIdFor(userId);
    const ticket = await this.prisma.studentSupportTicket.findFirst({
      where: { id: ticketId, studentProfileId: id },
      select: { id: true, status: true },
    });
    if (!ticket) throw notFound('Support ticket');
    if (ticket.status === 'CLOSED')
      throw failure(
        'INVALID_STATE',
        'Closed support tickets cannot receive replies',
      );
    return this.prisma.studentSupportMessage.create({
      data: {
        ticketId,
        senderType: 'STUDENT',
        senderUserId: userId,
        body: body.trim(),
      },
    });
  }

  // -- dashboard, recommendations, referrals ---------------------------

  async dashboard(userId: string) {
    const profile = await this.profileIdFor(userId);
    const [applications, scholarships, unreadNotifications, assignment] =
      await Promise.all([
        this.prisma.studentApplication.count({
          where: { studentProfileId: profile.id, status: { not: 'WITHDRAWN' } },
        }),
        this.prisma.studentScholarshipApplication.count({
          where: { studentProfileId: profile.id, status: { not: 'WITHDRAWN' } },
        }),
        this.prisma.studentNotification.count({
          where: { studentProfileId: profile.id, readAt: null },
        }),
        this.prisma.studentConsultantAssignment.findFirst({
          where: { studentProfileId: profile.id, status: 'ACTIVE' },
          include: {
            consultant: {
              select: { name: true, slug: true, email: true, phone: true },
            },
          },
        }),
      ]);
    return {
      applications,
      scholarshipApplications: scholarships,
      unreadNotifications,
      consultant: assignment?.consultant ?? null,
      referralCode: await this.referralCode(profile.id),
    };
  }

  async recommendations(userId: string) {
    const { id } = await this.profileIdFor(userId);
    const profile = await this.prisma.studentProfile.findUniqueOrThrow({
      where: { id },
      include: { preferredCountries: { select: { countryId: true } } },
    });
    const countryIds = profile.preferredCountries.map((row) => row.countryId);
    return this.prisma.universityCourseOffering.findMany({
      where: {
        status: PUBLISHED,
        deletedAt: null,
        university: {
          status: PUBLISHED,
          deletedAt: null,
          ...(countryIds.length ? { countryId: { in: countryIds } } : {}),
        },
        ...(profile.preferredCourseLevelId
          ? { courseLevelId: profile.preferredCourseLevelId }
          : {}),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        university: {
          select: {
            name: true,
            slug: true,
            country: { select: { name: true, slug: true } },
          },
        },
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      take: 12,
    });
  }

  async deadlines(userId: string) {
    const { id } = await this.profileIdFor(userId);
    const [courseIntakes, scholarships] = await Promise.all([
      this.prisma.universityCourseIntake.findMany({
        where: {
          status: 'ACTIVE',
          deadline: { not: null },
          offering: {
            studentApplications: {
              some: {
                studentProfileId: id,
                status: {
                  in: ['APPLICATION_STARTED', 'SUBMITTED', 'UNDER_REVIEW'],
                },
              },
            },
          },
        },
        include: {
          offering: {
            select: {
              name: true,
              slug: true,
              university: { select: { name: true } },
            },
          },
          intake: { select: { name: true, slug: true } },
        },
        orderBy: { deadline: 'asc' },
      }),
      this.prisma.studentScholarshipApplication.findMany({
        where: {
          studentProfileId: id,
          status: { in: ['STARTED', 'SUBMITTED', 'UNDER_REVIEW'] },
        },
        include: {
          scholarship: { select: { title: true, slug: true, deadline: true } },
        },
        orderBy: { scholarship: { deadline: 'asc' } },
      }),
    ]);
    return { courseIntakes, scholarships };
  }

  private async referralCode(profileId: string) {
    const existing = await this.prisma.studentProfile.findUniqueOrThrow({
      where: { id: profileId },
      select: { referralCode: true },
    });
    if (existing.referralCode) return existing.referralCode;
    const code = `UNI-${profileId.replace(/-/g, '').slice(0, 10).toUpperCase()}`;
    await this.prisma.studentProfile.update({
      where: { id: profileId },
      data: { referralCode: code },
    });
    return code;
  }

  async referral(userId: string) {
    const { id } = await this.profileIdFor(userId);
    const code = await this.referralCode(id);
    const referrals = await this.prisma.studentReferral.findMany({
      where: { referrerProfileId: id },
      select: {
        id: true,
        stage: true,
        rewardStatus: true,
        rewardAmount: true,
        rewardCurrency: true,
        createdAt: true,
      },
    });
    return {
      code,
      referrals: referrals.map((row) => ({
        ...row,
        rewardAmount: row.rewardAmount ? Number(row.rewardAmount) : null,
        createdAt: iso(row.createdAt),
      })),
    };
  }

  async applyReferral(userId: string, code: string) {
    const profile = await this.profileIdFor(userId);
    const referrer = await this.prisma.studentProfile.findFirst({
      where: {
        referralCode: code.trim().toUpperCase(),
        id: { not: profile.id },
      },
      select: { id: true },
    });
    if (!referrer)
      throw failure('INVALID_REFERRAL_CODE', 'Referral code is invalid');
    await this.prisma.studentReferral
      .create({
        data: {
          referrerProfileId: referrer.id,
          referredProfileId: profile.id,
          referralCode: code.trim().toUpperCase(),
        },
      })
      .catch(() => {
        throw failure(
          'REFERRAL_ALREADY_APPLIED',
          'A referral has already been applied',
        );
      });
    return { applied: true };
  }

  // -- restricted Admin operations --------------------------------------

  async adminOverview() {
    const [applications, scholarshipApplications, tickets] = await Promise.all([
      this.prisma.studentApplication.findMany({
        include: {
          studentProfile: {
            select: {
              id: true,
              user: {
                select: { email: true, firstName: true, lastName: true },
              },
            },
          },
          university: { select: { name: true } },
          offering: { select: { name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      }),
      this.prisma.studentScholarshipApplication.findMany({
        include: {
          studentProfile: {
            select: {
              id: true,
              user: {
                select: { email: true, firstName: true, lastName: true },
              },
            },
          },
          scholarship: { select: { title: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      }),
      this.prisma.studentSupportTicket.findMany({
        include: {
          studentProfile: {
            select: {
              id: true,
              user: {
                select: { email: true, firstName: true, lastName: true },
              },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      }),
    ]);
    return { applications, scholarshipApplications, tickets };
  }

  async adminSetApplicationStatus(
    adminUserId: string,
    applicationId: string,
    status: string,
    message?: string,
    offerMediaId?: string,
  ) {
    const application = await this.prisma.studentApplication.findUnique({
      where: { id: applicationId },
      select: { id: true, studentProfileId: true },
    });
    if (!application) throw notFound('Application');
    await this.prisma.$transaction([
      this.prisma.studentApplication.update({
        where: { id: applicationId },
        data: {
          status,
          decisionAt: ['OFFER_RECEIVED', 'REJECTED'].includes(status)
            ? new Date()
            : undefined,
          offerMediaId: offerMediaId ?? undefined,
        },
      }),
      this.prisma.studentApplicationTimeline.create({
        data: {
          applicationId,
          status,
          actorType: 'ADMIN',
          changedByUserId: adminUserId,
          message: message ?? null,
        },
      }),
    ]);
    await this.notify(
      application.studentProfileId,
      'APPLICATION_STATUS',
      `Application status: ${status.replaceAll('_', ' ')}`,
      `/student/applications/${applicationId}`,
    );
    return { status };
  }

  async adminSetScholarshipStatus(
    adminUserId: string,
    applicationId: string,
    status: string,
    message?: string,
  ) {
    const application =
      await this.prisma.studentScholarshipApplication.findUnique({
        where: { id: applicationId },
        select: { id: true, studentProfileId: true },
      });
    if (!application) throw notFound('Scholarship application');
    await this.prisma.$transaction([
      this.prisma.studentScholarshipApplication.update({
        where: { id: applicationId },
        data: {
          status,
          decisionAt: ['AWARDED', 'REJECTED'].includes(status)
            ? new Date()
            : undefined,
        },
      }),
      this.prisma.studentScholarshipTimeline.create({
        data: {
          scholarshipApplicationId: applicationId,
          status,
          actorType: 'ADMIN',
          changedByUserId: adminUserId,
          message: message ?? null,
        },
      }),
    ]);
    await this.notify(
      application.studentProfileId,
      'SCHOLARSHIP_STATUS',
      `Scholarship status: ${status.replaceAll('_', ' ')}`,
      `/student/scholarship-applications/${applicationId}`,
    );
    return { status };
  }

  async adminAssignConsultant(profileId: string, consultantId: string) {
    const consultant = await this.prisma.consultant.findFirst({
      where: { id: consultantId, status: PUBLISHED, deletedAt: null },
      select: { id: true },
    });
    if (!consultant) throw notFound('Published consultant');
    await this.prisma.$transaction([
      this.prisma.studentConsultantAssignment.updateMany({
        where: { studentProfileId: profileId, status: 'ACTIVE' },
        data: { status: 'ENDED', endedAt: new Date() },
      }),
      this.prisma.studentConsultantAssignment.create({
        data: { studentProfileId: profileId, consultantId },
      }),
    ]);
    await this.notify(
      profileId,
      'CONSULTANT_ASSIGNED',
      'A consultant has been assigned',
      '/student/messages',
    );
    return { assigned: true };
  }

  async adminSetSupportStatus(
    adminUserId: string,
    ticketId: string,
    status: string,
  ) {
    const ticket = await this.prisma.studentSupportTicket.findUnique({
      where: { id: ticketId },
      select: { studentProfileId: true },
    });
    if (!ticket) throw notFound('Support ticket');
    await this.prisma.studentSupportTicket.update({
      where: { id: ticketId },
      data: { status, lastChangedByUserId: adminUserId },
    });
    await this.notify(
      ticket.studentProfileId,
      'SUPPORT_STATUS',
      `Support ticket status: ${status.replaceAll('_', ' ')}`,
      '/student/support',
    );
    return { status };
  }
}
