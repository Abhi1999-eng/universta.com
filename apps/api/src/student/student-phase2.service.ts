import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailDeliveryService } from './email-delivery.service';

const PUBLISHED = 'PUBLISHED';
/** Single operational boundary for the currently configured referral reward. */
const REFERRAL_REWARD = { amount: 1000, currency: 'INR' } as const;
const REFERRAL_STAGE_ORDER: Record<string, number> = {
  REGISTERED: 0,
  APPLICATION_STARTED: 1,
  APPLICATION_SUBMITTED: 2,
  OFFER_RECEIVED: 3,
  ENROLLED: 4,
};
const APPLICATION_TRANSITIONS: Record<string, readonly string[]> = {
  APPLICATION_STARTED: ['SUBMITTED', 'WITHDRAWN'],
  SUBMITTED: ['UNDER_REVIEW', 'WITHDRAWN'],
  UNDER_REVIEW: ['OFFER_RECEIVED', 'REJECTED', 'WITHDRAWN'],
  OFFER_RECEIVED: ['ACCEPTED', 'REJECTED'],
  ACCEPTED: ['ENROLLED'],
  REJECTED: [],
  WITHDRAWN: [],
  ENROLLED: [],
};

function applicationStatusLabel(status: string) {
  return status.toLowerCase().replaceAll('_', ' ');
}

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

  /** Advances a referral through real portal and staff lifecycle events only. */
  private async advanceReferral(
    referredProfileId: string,
    nextStage: keyof typeof REFERRAL_STAGE_ORDER,
  ) {
    const referral = await this.prisma.studentReferral.findUnique({
      where: { referredProfileId },
      select: { id: true, stage: true, rewardStatus: true },
    });
    if (
      !referral ||
      (REFERRAL_STAGE_ORDER[referral.stage] ?? -1) >=
        REFERRAL_STAGE_ORDER[nextStage]
    ) {
      return;
    }
    await this.prisma.studentReferral.update({
      where: { id: referral.id },
      data:
        nextStage === 'ENROLLED'
          ? {
              stage: nextStage,
              rewardStatus:
                referral.rewardStatus === 'PAID' ? 'PAID' : 'ELIGIBLE',
              rewardAmount: REFERRAL_REWARD.amount,
              rewardCurrency: REFERRAL_REWARD.currency,
            }
          : { stage: nextStage },
    });
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
    await this.advanceReferral(profile.id, 'APPLICATION_STARTED');
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

  async application(userId: string, applicationId: string) {
    const { id } = await this.profileIdFor(userId);
    const application = await this.prisma.studentApplication.findFirst({
      where: { id: applicationId, studentProfileId: id },
      include: {
        university: { select: { name: true, slug: true } },
        offering: {
          select: {
            name: true,
            slug: true,
            university: { select: { slug: true } },
          },
        },
        targetIntake: { select: { name: true, slug: true } },
        timeline: { orderBy: { createdAt: 'asc' } },
        documents: {
          include: {
            studentDocument: {
              select: { id: true, title: true, documentType: true },
            },
          },
        },
        offerMedia: {
          select: { id: true, originalFileName: true, mimeType: true },
        },
      },
    });
    if (!application) throw notFound('Application');
    return application;
  }

  async applicationOffer(userId: string, applicationId: string) {
    const { id } = await this.profileIdFor(userId);
    const application = await this.prisma.studentApplication.findFirst({
      where: {
        id: applicationId,
        studentProfileId: id,
        offerMediaId: { not: null },
      },
      select: {
        offerMedia: {
          select: {
            storedFileName: true,
            originalFileName: true,
            mimeType: true,
            status: true,
            deletedAt: true,
          },
        },
      },
    });
    const media = application?.offerMedia;
    if (!media || media.status !== 'ACTIVE' || media.deletedAt)
      throw notFound('Offer letter');
    return media;
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
    await this.advanceReferral(profileId, 'APPLICATION_SUBMITTED');
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
      !['APPLICATION_STARTED', 'SUBMITTED', 'UNDER_REVIEW'].includes(
        application.status,
      )
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
        data: {
          status: decision,
          offerDecision: decision,
          offerDecisionAt: new Date(),
          decisionAt: new Date(),
        },
      }),
      this.prisma.studentApplicationTimeline.create({
        data: {
          applicationId,
          status: decision,
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
    return { status: decision, decision };
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

  async scholarshipApplication(userId: string, applicationId: string) {
    const { id } = await this.profileIdFor(userId);
    const application =
      await this.prisma.studentScholarshipApplication.findFirst({
        where: { id: applicationId, studentProfileId: id },
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
      });
    if (!application) throw notFound('Scholarship application');
    return application;
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

  async withdrawScholarshipApplication(
    userId: string,
    applicationId: string,
    message?: string,
  ) {
    const { profileId, application } = await this.ownScholarshipApplication(
      userId,
      applicationId,
    );
    if (
      !['STARTED', 'SUBMITTED', 'UNDER_REVIEW'].includes(application.status)
    ) {
      throw failure(
        'INVALID_STATE',
        'This scholarship application cannot be withdrawn',
      );
    }
    await this.prisma.$transaction([
      this.prisma.studentScholarshipApplication.update({
        where: { id: applicationId },
        data: { status: 'WITHDRAWN' },
      }),
      this.prisma.studentScholarshipTimeline.create({
        data: {
          scholarshipApplicationId: applicationId,
          status: 'WITHDRAWN',
          actorType: 'STUDENT',
          message: message ?? 'Scholarship application withdrawn',
        },
      }),
    ]);
    await this.notify(
      profileId,
      'SCHOLARSHIP_WITHDRAWN',
      'Scholarship application withdrawn',
      `/student/scholarship-applications/${applicationId}`,
    );
    return { status: 'WITHDRAWN' };
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
      include: {
        consultantAssignment: {
          include: {
            consultant: { select: { name: true, email: true, phone: true } },
          },
        },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    return conversation;
  }

  async sendMessage(userId: string, body: string) {
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

  async markAllNotificationsRead(userId: string) {
    const { id } = await this.profileIdFor(userId);
    const result = await this.prisma.studentNotification.updateMany({
      where: { studentProfileId: id, readAt: null },
      data: { readAt: new Date() },
    });
    return { read: result.count };
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
    const [
      applications,
      scholarships,
      unreadNotifications,
      assignment,
      nextApplication,
      nextIntake,
      nextScholarship,
    ] = await Promise.all([
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
      this.prisma.studentApplication.findFirst({
        where: {
          studentProfileId: profile.id,
          status: { in: ['OFFER_RECEIVED', 'APPLICATION_STARTED'] },
        },
        select: { id: true, status: true },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.universityCourseIntake.findFirst({
        where: {
          status: 'ACTIVE',
          deadline: { gte: new Date() },
          offering: {
            studentApplications: {
              some: {
                studentProfileId: profile.id,
                status: {
                  in: ['APPLICATION_STARTED', 'SUBMITTED', 'UNDER_REVIEW'],
                },
              },
            },
          },
        },
        select: {
          deadline: true,
          offering: {
            select: {
              name: true,
              slug: true,
              university: { select: { slug: true } },
            },
          },
        },
        orderBy: { deadline: 'asc' },
      }),
      this.prisma.studentScholarshipApplication.findFirst({
        where: {
          studentProfileId: profile.id,
          status: { in: ['STARTED', 'SUBMITTED', 'UNDER_REVIEW'] },
          scholarship: { deadline: { gte: new Date() } },
        },
        select: {
          scholarship: { select: { title: true, slug: true, deadline: true } },
        },
        orderBy: { scholarship: { deadline: 'asc' } },
      }),
    ]);
    const recommendations = await this.recommendations(userId);
    const deadlineCandidates = [
      nextIntake?.deadline
        ? {
            label: nextIntake.offering.name,
            date: iso(nextIntake.deadline),
            href: `/universities/${nextIntake.offering.university.slug}/courses/${nextIntake.offering.slug}`,
          }
        : null,
      nextScholarship?.scholarship.deadline
        ? {
            label: nextScholarship.scholarship.title,
            date: iso(nextScholarship.scholarship.deadline),
            href: `/scholarships/${nextScholarship.scholarship.slug}`,
          }
        : null,
    ].filter(
      (candidate): candidate is { label: string; date: string; href: string } =>
        Boolean(candidate),
    );
    const nearestDeadline =
      deadlineCandidates.sort((left, right) =>
        left.date.localeCompare(right.date),
      )[0] ?? null;
    return {
      applications,
      scholarshipApplications: scholarships,
      unreadNotifications,
      consultant: assignment?.consultant ?? null,
      referralCode: await this.referralCode(profile.id),
      nearestDeadline,
      recommendationPreview: recommendations.offerings.slice(0, 3),
      nextAction: nextApplication
        ? {
            label:
              nextApplication.status === 'OFFER_RECEIVED'
                ? 'Review your offer'
                : 'Continue your application',
            href: `/student/applications/${nextApplication.id}`,
          }
        : {
            label: 'Explore recommended courses',
            href: '/student/recommendations',
          },
    };
  }

  async recommendations(userId: string) {
    const { id } = await this.profileIdFor(userId);
    const profile = await this.prisma.studentProfile.findUniqueOrThrow({
      where: { id },
      include: { preferredCountries: { select: { countryId: true } } },
    });
    const countryIds = profile.preferredCountries.map((row) => row.countryId);
    const offeringCriteria: Record<string, unknown> = {
      status: PUBLISHED,
      deletedAt: null,
      ...(profile.preferredCourseLevelId
        ? { courseLevelId: profile.preferredCourseLevelId }
        : {}),
    };
    if (profile.preferredSubjectId) {
      offeringCriteria.genericCourse = {
        subjectId: profile.preferredSubjectId,
      };
    }
    if (profile.preferredIntakeId) {
      offeringCriteria.intakes = {
        some: { intakeId: profile.preferredIntakeId, status: 'ACTIVE' },
      };
    }
    if (profile.budgetCurrency) {
      offeringCriteria.currencyCode = profile.budgetCurrency;
      if (profile.budgetMax)
        offeringCriteria.tuitionMin = { lte: profile.budgetMax };
      if (profile.budgetMin)
        offeringCriteria.tuitionMax = { gte: profile.budgetMin };
    }
    const offeringWhere: Record<string, unknown> = {
      ...offeringCriteria,
      university: {
        status: PUBLISHED,
        deletedAt: null,
        ...(countryIds.length ? { countryId: { in: countryIds } } : {}),
      },
    };
    const [countries, universities, offerings] = await Promise.all([
      this.prisma.country.findMany({
        where: { id: { in: countryIds }, status: PUBLISHED, deletedAt: null },
        select: { id: true, name: true, slug: true },
        take: 6,
      }),
      this.prisma.university.findMany({
        where: {
          status: PUBLISHED,
          deletedAt: null,
          ...(countryIds.length ? { countryId: { in: countryIds } } : {}),
          offerings: { some: offeringCriteria },
        },
        select: {
          id: true,
          name: true,
          slug: true,
          country: { select: { name: true, slug: true } },
        },
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        take: 6,
      }),
      this.prisma.universityCourseOffering.findMany({
        where: {
          ...offeringWhere,
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
      }),
    ]);
    const matchReasons = [
      countryIds.length ? 'preferred destination' : null,
      profile.preferredSubjectId ? 'preferred subject' : null,
      profile.preferredCourseLevelId ? 'preferred course level' : null,
      profile.preferredIntakeId ? 'preferred intake' : null,
      profile.budgetCurrency ? 'budget currency and range' : null,
    ].filter((reason): reason is string => Boolean(reason));
    const matchReason = matchReasons.length
      ? `Matches your ${matchReasons.join(', ')}`
      : 'Published study option';
    return {
      countries: countries.map((country) => ({
        ...country,
        reason: countryIds.length
          ? 'Matches your preferred destination'
          : 'Published study destination',
      })),
      universities: universities.map((university) => ({
        ...university,
        reason: matchReason,
      })),
      offerings: offerings.map((offering) => ({
        ...offering,
        reason: matchReason,
      })),
    };
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
        updatedAt: true,
        referredProfile: {
          select: { user: { select: { firstName: true } } },
        },
      },
    });
    return {
      code,
      referrals: referrals.map((row) => ({
        id: row.id,
        stage: row.stage,
        rewardStatus: row.rewardStatus,
        rewardAmount: row.rewardAmount ? Number(row.rewardAmount) : null,
        rewardCurrency: row.rewardCurrency,
        createdAt: iso(row.createdAt),
        updatedAt: iso(row.updatedAt),
        referredStudent: row.referredProfile.user.firstName,
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
    const safeStudent = {
      select: {
        id: true,
        user: { select: { firstName: true, lastName: true } },
        consultantAssignments: {
          where: { status: 'ACTIVE' },
          orderBy: { assignedAt: 'desc' as const },
          take: 1,
          select: {
            consultant: {
              select: { id: true, name: true, email: true, phone: true },
            },
          },
        },
      },
    };
    const [
      applications,
      scholarshipApplications,
      tickets,
      conversations,
      referrals,
      consultants,
    ] = await Promise.all([
      this.prisma.studentApplication.findMany({
        include: {
          studentProfile: safeStudent,
          university: { select: { name: true } },
          offering: { select: { name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      }),
      this.prisma.studentScholarshipApplication.findMany({
        include: {
          studentProfile: safeStudent,
          scholarship: { select: { title: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      }),
      this.prisma.studentSupportTicket.findMany({
        include: {
          studentProfile: safeStudent,
          messages: {
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              senderType: true,
              body: true,
              createdAt: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      }),
      this.prisma.studentConversation.findMany({
        include: {
          studentProfile: safeStudent,
          consultantAssignment: {
            select: {
              consultant: { select: { name: true, email: true, phone: true } },
            },
          },
          messages: {
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              senderType: true,
              body: true,
              readAt: true,
              createdAt: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      }),
      this.prisma.studentReferral.findMany({
        select: {
          id: true,
          stage: true,
          rewardStatus: true,
          rewardAmount: true,
          rewardCurrency: true,
          updatedAt: true,
          referrerProfile: {
            select: { user: { select: { firstName: true, lastName: true } } },
          },
          referredProfile: {
            select: { user: { select: { firstName: true, lastName: true } } },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      }),
      this.prisma.consultant.findMany({
        where: { status: PUBLISHED, deletedAt: null },
        select: { id: true, name: true, email: true, phone: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    return {
      applications,
      scholarshipApplications,
      tickets,
      conversations,
      consultants,
      referrals: referrals.map((referral) => ({
        ...referral,
        rewardAmount: referral.rewardAmount
          ? Number(referral.rewardAmount)
          : null,
        updatedAt: iso(referral.updatedAt),
      })),
    };
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
      select: { id: true, studentProfileId: true, status: true },
    });
    if (!application) throw notFound('Application');
    if (!APPLICATION_TRANSITIONS[application.status]?.includes(status)) {
      throw failure(
        'INVALID_STATE',
        `Cannot move an application from ${applicationStatusLabel(application.status)} to ${applicationStatusLabel(status)}`,
      );
    }
    if (status === 'OFFER_RECEIVED' && !offerMediaId) {
      throw failure(
        'OFFER_LETTER_REQUIRED',
        'Upload and attach an offer letter before marking an application as offer received',
      );
    }
    if (offerMediaId) {
      const offer = await this.prisma.mediaAsset.findFirst({
        where: {
          id: offerMediaId,
          status: 'ACTIVE',
          deletedAt: null,
          folder: 'student-offers',
          uploadedByUserId: adminUserId,
        },
        select: { id: true },
      });
      if (!offer) {
        throw failure(
          'INVALID_OFFER_MEDIA',
          'Upload the offer letter through the authorised student-offers media flow before attaching it',
        );
      }
    }
    await this.prisma.$transaction([
      this.prisma.studentApplication.update({
        where: { id: applicationId },
        data: {
          status,
          decisionAt: ['OFFER_RECEIVED', 'REJECTED', 'ACCEPTED'].includes(
            status,
          )
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
    if (status === 'OFFER_RECEIVED') {
      await this.advanceReferral(
        application.studentProfileId,
        'OFFER_RECEIVED',
      );
    }
    if (status === 'ENROLLED') {
      await this.advanceReferral(application.studentProfileId, 'ENROLLED');
    }
    await this.notify(
      application.studentProfileId,
      'APPLICATION_STATUS',
      `Application status: ${status.replaceAll('_', ' ')}`,
      `/student/applications/${applicationId}`,
    );
    return { status };
  }

  async adminReplyConversation(
    adminUserId: string,
    conversationId: string,
    body: string,
  ) {
    const conversation = await this.prisma.studentConversation.findUnique({
      where: { id: conversationId },
      select: { id: true, studentProfileId: true },
    });
    if (!conversation) throw notFound('Conversation');
    const message = await this.prisma.studentMessage.create({
      data: {
        conversationId,
        senderType: 'ADMIN',
        internalSenderId: adminUserId,
        body: body.trim(),
      },
    });
    await this.prisma.studentConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
    await this.prisma.studentMessage.updateMany({
      where: { conversationId, senderType: 'STUDENT', readAt: null },
      data: { readAt: new Date() },
    });
    await this.notify(
      conversation.studentProfileId,
      'ADVISER_REPLY',
      'Your adviser replied',
      '/student/messages',
    );
    return message;
  }

  async adminReplySupportTicket(
    adminUserId: string,
    ticketId: string,
    body: string,
  ) {
    const ticket = await this.prisma.studentSupportTicket.findUnique({
      where: { id: ticketId },
      select: { id: true, studentProfileId: true, status: true },
    });
    if (!ticket) throw notFound('Support ticket');
    if (ticket.status === 'CLOSED')
      throw failure(
        'INVALID_STATE',
        'Closed support tickets cannot receive replies',
      );
    const message = await this.prisma.studentSupportMessage.create({
      data: {
        ticketId,
        senderType: 'ADMIN',
        senderUserId: adminUserId,
        body: body.trim(),
      },
    });
    await this.notify(
      ticket.studentProfileId,
      'SUPPORT_REPLY',
      'Your support request has a reply',
      '/student/support',
    );
    return message;
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

  async adminMarkReferralPaid(referralId: string, rewardStatus: 'PAID') {
    if (rewardStatus !== 'PAID') {
      throw failure('VALIDATION_ERROR', 'Reward status must be paid');
    }
    const referral = await this.prisma.studentReferral.findUnique({
      where: { id: referralId },
      select: { id: true, stage: true, rewardStatus: true },
    });
    if (!referral) throw notFound('Referral');
    if (referral.stage !== 'ENROLLED' || referral.rewardStatus !== 'ELIGIBLE') {
      throw failure(
        'INVALID_STATE',
        'Only enrolled, eligible referrals can be marked as paid',
      );
    }
    await this.prisma.studentReferral.update({
      where: { id: referralId },
      data: { rewardStatus: 'PAID' },
    });
    return { rewardStatus: 'PAID' };
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
