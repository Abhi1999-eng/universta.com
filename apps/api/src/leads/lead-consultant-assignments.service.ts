import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import type { UpdateLeadConsultantAssignmentDto } from './dto/lead-consultant-assignment.dto';

type AssignmentRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  assignedAt: Date;
  assignmentUpdatedAt: Date;
};

type ExistingAssignmentRow = {
  consultantId: string;
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

@Injectable()
export class LeadConsultantAssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async options() {
    return this.prisma.consultant.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, slug: true, status: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }

  async current(leadId: string) {
    const rows = await this.prisma.$queryRaw<AssignmentRow[]>`
      SELECT
        c.id,
        c.name,
        c.slug,
        c.status,
        a.assigned_at AS assignedAt,
        a.updated_at AS assignmentUpdatedAt
      FROM lead_consultant_assignments a
      INNER JOIN consultants c ON c.id = a.consultant_id
      WHERE a.lead_id = ${leadId}
        AND c.deleted_at IS NULL
      LIMIT 1
    `;
    return rows[0] ?? null;
  }

  async update(
    leadId: string,
    dto: UpdateLeadConsultantAssignmentDto,
    request: AuthenticatedRequest,
  ) {
    const userId = actorId(request);
    const targetConsultantId = dto.consultantId ?? null;

    const result = await this.prisma.$transaction(async (transaction) => {
      const lead = await transaction.lead.findFirst({
        where: { id: leadId, deletedAt: null },
        select: { id: true, updatedAt: true },
      });
      if (!lead) throw leadNotFound();
      if (lead.updatedAt.toISOString() !== dto.expectedUpdatedAt) {
        throw new ConflictException({
          code: 'LEAD_STALE_VERSION',
          message: 'The lead changed in another session',
          details: null,
        });
      }

      if (targetConsultantId) {
        const consultant = await transaction.consultant.findFirst({
          where: { id: targetConsultantId, deletedAt: null },
          select: { id: true },
        });
        if (!consultant) {
          throw new UnprocessableEntityException({
            code: 'CONSULTANT_NOT_AVAILABLE',
            message: 'The selected consultant is not available',
            details: null,
          });
        }
      }

      const existingRows = await transaction.$queryRaw<ExistingAssignmentRow[]>`
        SELECT consultant_id AS consultantId
        FROM lead_consultant_assignments
        WHERE lead_id = ${leadId}
        LIMIT 1
      `;
      const existingConsultantId = existingRows[0]?.consultantId ?? null;
      if (existingConsultantId === targetConsultantId) {
        return { changed: false, updatedAt: lead.updatedAt };
      }

      if (targetConsultantId) {
        await transaction.$executeRaw`
          INSERT INTO lead_consultant_assignments (
            lead_id,
            consultant_id,
            assigned_by_user_id,
            assigned_at,
            updated_at
          ) VALUES (
            ${leadId},
            ${targetConsultantId},
            ${userId},
            CURRENT_TIMESTAMP(3),
            CURRENT_TIMESTAMP(3)
          )
          ON DUPLICATE KEY UPDATE
            consultant_id = ${targetConsultantId},
            assigned_by_user_id = ${userId},
            assigned_at = CURRENT_TIMESTAMP(3),
            updated_at = CURRENT_TIMESTAMP(3)
        `;
      } else {
        await transaction.$executeRaw`
          DELETE FROM lead_consultant_assignments
          WHERE lead_id = ${leadId}
        `;
      }

      const touchedAt = new Date();
      const touched = await transaction.lead.updateMany({
        where: { id: leadId, updatedAt: lead.updatedAt, deletedAt: null },
        data: { updatedAt: touchedAt },
      });
      if (touched.count !== 1) {
        throw new ConflictException({
          code: 'LEAD_STALE_VERSION',
          message: 'The lead changed in another session',
          details: null,
        });
      }

      const action = !targetConsultantId
        ? 'LEAD_CONSULTANT_UNASSIGNED'
        : existingConsultantId
          ? 'LEAD_CONSULTANT_REASSIGNED'
          : 'LEAD_CONSULTANT_ASSIGNED';
      await transaction.auditLog.create({
        data: {
          userId,
          module: 'LEADS',
          entityType: 'LEAD',
          entityId: leadId,
          action,
          oldValues: { consultantId: existingConsultantId },
          newValues: { consultantId: targetConsultantId },
          description: !targetConsultantId
            ? 'Consultant unassigned from lead'
            : existingConsultantId
              ? 'Lead reassigned to consultant'
              : 'Lead assigned to consultant',
          requestId: request.requestId ?? null,
        },
      });

      return { changed: true, updatedAt: touchedAt };
    });

    return {
      assignment: await this.current(leadId),
      updatedAt: result.updatedAt,
      changed: result.changed,
    };
  }
}
