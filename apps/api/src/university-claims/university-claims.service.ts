import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

/** Statuses a claim can transition through. WITHDRAWN is reachable only via
 * the public withdraw-your-own-request path (not modeled yet in Phase 1 —
 * no student accounts exist to authenticate a withdrawal request against),
 * but is a valid admin-settable status for parity with the brief. */
export const CLAIM_STATUSES = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'MORE_INFORMATION_REQUIRED',
  'APPROVED',
  'REJECTED',
  'WITHDRAWN',
];
const OPEN_STATUSES = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'MORE_INFORMATION_REQUIRED',
];

function claimNumber() {
  return `UC-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`;
}

function optionalText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
function requiredText(value: unknown, name: string) {
  const text = optionalText(value);
  if (!text)
    throw new UnprocessableEntityException({
      code: 'VALIDATION_ERROR',
      message: `${name} is required`,
      details: null,
    });
  return text;
}
function requiredEmail(value: unknown) {
  const email = requiredText(value, 'workEmail').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new UnprocessableEntityException({
      code: 'VALIDATION_ERROR',
      message: 'A valid work email is required',
      details: null,
    });
  return email;
}

@Injectable()
export class UniversityClaimsService {
  private readonly submitAttempts = new Map<string, number>();

  constructor(private readonly prisma: PrismaService) {}

  /** Public claim submission. `honeypot` is a hidden form field real users
   * never fill in; a non-empty value pretends success without writing
   * anything, matching the existing ContactInquiry honeypot convention. */
  async submitClaim(body: {
    universitySlug: string;
    claimantName?: string;
    workEmail?: string;
    jobTitle?: string;
    organization?: string;
    phoneNumber?: string;
    officialWebsite?: string;
    message?: string;
    consent?: boolean;
    honeypot?: string;
  }) {
    if (body.honeypot) return { received: true };
    const university = await this.prisma.university.findFirst({
      where: {
        slug: body.universitySlug,
        status: 'PUBLISHED',
        deletedAt: null,
      },
    });
    if (!university)
      throw new BadRequestException({
        code: 'UNIVERSITY_NOT_FOUND',
        message: 'The selected university is not available',
        details: null,
      });
    const claimantName = requiredText(body.claimantName, 'claimantName');
    const workEmail = requiredEmail(body.workEmail);
    const message = requiredText(body.message, 'message');
    if (body.consent !== true)
      throw new UnprocessableEntityException({
        code: 'CLAIM_CONSENT_REQUIRED',
        message:
          'Confirmation that you are authorized to claim this listing is required',
        details: null,
      });

    const rateKey = `${workEmail}:${university.id}`;
    const previous = this.submitAttempts.get(rateKey) ?? 0;
    if (Date.now() - previous < 10_000) return { received: true };
    this.submitAttempts.set(rateKey, Date.now());

    const existingOpen = await this.prisma.universityClaimRequest.findFirst({
      where: {
        universityId: university.id,
        workEmail,
        status: { in: OPEN_STATUSES },
        deletedAt: null,
      },
    });
    if (existingOpen)
      return {
        received: true,
        claimNumber: existingOpen.claimNumber,
        duplicate: true,
      };

    const row = await this.prisma.universityClaimRequest.create({
      data: {
        universityId: university.id,
        claimNumber: claimNumber(),
        claimantName,
        workEmail,
        jobTitle: optionalText(body.jobTitle),
        organization: optionalText(body.organization),
        phoneNumber: optionalText(body.phoneNumber),
        officialWebsite: optionalText(body.officialWebsite),
        message,
      },
    });
    return { received: true, claimNumber: row.claimNumber, duplicate: false };
  }

  async adminList(query: { status?: string; q?: string }) {
    return this.prisma.universityClaimRequest.findMany({
      where: {
        deletedAt: null,
        ...(query.status ? { status: query.status } : {}),
        ...(query.q?.trim()
          ? {
              OR: [
                { claimantName: { contains: query.q.trim() } },
                { workEmail: { contains: query.q.trim() } },
                { claimNumber: { contains: query.q.trim() } },
              ],
            }
          : {}),
      },
      include: { university: { select: { id: true, name: true, slug: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async adminDetail(id: string) {
    const claim = await this.prisma.universityClaimRequest.findFirst({
      where: { id, deletedAt: null },
      include: {
        university: { select: { id: true, name: true, slug: true } },
        reviewedBy: { select: { id: true, firstName: true, lastName: true } },
        notes: {
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { firstName: true, lastName: true } } },
        },
        statusHistory: {
          orderBy: { createdAt: 'desc' },
          include: {
            changedBy: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });
    if (!claim)
      throw new NotFoundException({
        code: 'CLAIM_NOT_FOUND',
        message: 'Claim request not found',
        details: null,
      });
    return claim;
  }

  async updateStatus(
    id: string,
    status: string,
    reason: string | undefined,
    actorUserId: string,
  ) {
    const claim = await this.adminDetail(id);
    if (!CLAIM_STATUSES.includes(status))
      throw new BadRequestException({
        code: 'INVALID_STATUS',
        message: `status must be one of ${CLAIM_STATUSES.join(', ')}`,
        details: null,
      });
    if (claim.status === status) return claim;
    const [updated] = await this.prisma.$transaction([
      this.prisma.universityClaimRequest.update({
        where: { id },
        data: {
          status,
          reviewedByUserId: actorUserId,
          reviewedAt: new Date(),
        },
      }),
      this.prisma.universityClaimStatusHistory.create({
        data: {
          claimId: id,
          oldStatus: claim.status,
          newStatus: status,
          changedByUserId: actorUserId,
          reason: optionalText(reason),
        },
      }),
    ]);
    return updated;
  }

  async addNote(id: string, note: string, actorUserId: string) {
    await this.adminDetail(id);
    const text = requiredText(note, 'note');
    return this.prisma.universityClaimNote.create({
      data: { claimId: id, userId: actorUserId, note: text },
    });
  }

  async archive(id: string) {
    await this.adminDetail(id);
    return this.prisma.universityClaimRequest.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
