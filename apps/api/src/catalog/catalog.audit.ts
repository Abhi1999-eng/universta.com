import type { Prisma } from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedRequest } from '../auth/auth.types';

export type SafeAuditValues = Record<string, string | number | boolean | null>;

export function auditData(
  request: AuthenticatedRequest,
  actorId: string,
  module: string,
  entityType: string,
  entityId: string,
  action: string,
  oldValues: SafeAuditValues | null,
  newValues: SafeAuditValues | null,
  description: string,
): Prisma.AuditLogCreateInput {
  return {
    user: { connect: { id: actorId } },
    module,
    entityType,
    entityId,
    action,
    ...(oldValues ? { oldValues: oldValues } : {}),
    ...(newValues ? { newValues: newValues } : {}),
    description,
    ipAddress: request.ip?.slice(0, 45) ?? null,
    userAgent: request.get('user-agent')?.slice(0, 1000) ?? null,
    requestId: request.requestId ?? null,
  };
}

export async function writeAudit(
  prisma: PrismaService,
  request: AuthenticatedRequest,
  actorId: string,
  module: string,
  entityType: string,
  entityId: string,
  action: string,
  oldValues: SafeAuditValues | null,
  newValues: SafeAuditValues | null,
  description: string,
): Promise<void> {
  await prisma.auditLog.create({
    data: auditData(
      request,
      actorId,
      module,
      entityType,
      entityId,
      action,
      oldValues,
      newValues,
      description,
    ),
  });
}
