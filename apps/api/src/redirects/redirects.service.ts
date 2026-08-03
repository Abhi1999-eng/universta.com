import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  isUniqueConstraintError,
  paginationMeta,
} from '../catalog/catalog.constants';
import { writeAudit } from '../catalog/catalog.audit';
import type { AuthenticatedRequest } from '../auth/auth.types';

export interface RedirectListQuery {
  q?: string;
  isActive?: string;
  page?: string;
  limit?: string;
}

export interface RedirectWriteInput {
  sourcePath?: unknown;
  targetPath?: unknown;
  httpStatusCode?: unknown;
}

const ALLOWED_STATUS_CODES = new Set([301, 302, 307, 308]);
/** A single leading slash, no protocol, no scheme-relative `//host` prefix
 * and no whitespace -- this is the whole open-redirect defense: every path
 * this feature will ever issue an HTTP redirect to must be internal to this
 * site, never an absolute or protocol-relative URL an admin (or an admin
 * account compromise) could point at an external phishing destination. */
const INTERNAL_PATH = /^\/(?!\/)\S*$/;

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

function conflict(code: string, message: string): ConflictException {
  return new ConflictException({ code, message, details: null });
}

function badRequest(code: string, message: string): BadRequestException {
  return new BadRequestException({ code, message, details: null });
}

function notFound(): NotFoundException {
  return new NotFoundException({
    code: 'REDIRECT_NOT_FOUND',
    message: 'Redirect not found',
    details: null,
  });
}

function normalizePath(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw badRequest('REDIRECT_PATH_REQUIRED', `${field} is required`);
  const trimmed = value.trim();
  if (!INTERNAL_PATH.test(trimmed))
    throw badRequest(
      'REDIRECT_PATH_NOT_INTERNAL',
      `${field} must be an internal path starting with a single "/" (no external URLs are allowed, to prevent open redirects)`,
    );
  return trimmed;
}

function normalizeStatusCode(value: unknown): number {
  if (value === undefined) return 301;
  const code = Number(value);
  if (!ALLOWED_STATUS_CODES.has(code))
    throw badRequest(
      'REDIRECT_STATUS_CODE_INVALID',
      'httpStatusCode must be one of 301, 302, 307, 308',
    );
  return code;
}

@Injectable()
export class RedirectsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: RedirectListQuery) {
    const page = Math.max(1, Number(query.page ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 25) || 25));
    const where = {
      ...(query.q
        ? {
            OR: [
              { sourcePath: { contains: query.q } },
              { targetPath: { contains: query.q } },
            ],
          }
        : {}),
      ...(query.isActive === 'true'
        ? { isActive: true }
        : query.isActive === 'false'
          ? { isActive: false }
          : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.redirect.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.redirect.count({ where }),
    ]);
    return {
      data: rows.map((row) => this.toDto(row)),
      meta: paginationMeta(page, limit, total),
    };
  }

  async detail(id: string) {
    const row = await this.prisma.redirect.findUnique({ where: { id } });
    if (!row) throw notFound();
    return this.toDto(row);
  }

  /** Refuses a self-loop (source === target) and refuses chaining onto
   * another active redirect's source -- the target must be a real
   * destination, not another hop, so redirect chains cannot silently grow
   * and cannot loop back on themselves. `excludeId` lets an update ignore
   * the row being edited when checking whether the target collides with an
   * existing source. */
  private async assertNoLoopOrChain(
    sourcePath: string,
    targetPath: string,
    excludeId?: string,
  ) {
    if (sourcePath === targetPath)
      throw badRequest(
        'REDIRECT_SELF_LOOP',
        'A redirect cannot point to itself',
      );
    const outgoing = await this.prisma.redirect.findFirst({
      where: {
        sourcePath: targetPath,
        isActive: true,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    if (outgoing) {
      if (outgoing.targetPath === sourcePath)
        throw badRequest(
          'REDIRECT_LOOP_DETECTED',
          `${targetPath} already redirects back to ${sourcePath}, which would create a loop`,
        );
      throw badRequest(
        'REDIRECT_CHAIN_NOT_ALLOWED',
        `${targetPath} is itself the source of another active redirect (to ${outgoing.targetPath}). Point this redirect straight at the final destination instead of chaining redirects.`,
      );
    }
    const incoming = await this.prisma.redirect.findFirst({
      where: {
        targetPath: sourcePath,
        isActive: true,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    if (incoming)
      throw badRequest(
        'REDIRECT_CHAIN_NOT_ALLOWED',
        `${sourcePath} is already the target of another active redirect (from ${incoming.sourcePath}). Update that redirect to point straight at ${targetPath} instead of chaining redirects.`,
      );
  }

  async create(body: RedirectWriteInput, request: AuthenticatedRequest) {
    const userId = actorId(request);
    const sourcePath = normalizePath(body.sourcePath, 'sourcePath');
    const targetPath = normalizePath(body.targetPath, 'targetPath');
    const httpStatusCode = normalizeStatusCode(body.httpStatusCode);
    await this.assertNoLoopOrChain(sourcePath, targetPath);
    try {
      const created = await this.prisma.redirect.create({
        data: {
          sourcePath,
          targetPath,
          httpStatusCode,
          createdByUserId: userId,
        },
      });
      await writeAudit(
        this.prisma,
        request,
        userId,
        'REDIRECTS',
        'REDIRECT',
        created.id,
        'REDIRECT_CREATED',
        null,
        { sourcePath, targetPath, httpStatusCode },
        `Redirect created: ${sourcePath} -> ${targetPath}`,
      );
      return this.toDto(created);
    } catch (error) {
      if (isUniqueConstraintError(error))
        throw conflict(
          'REDIRECT_SOURCE_CONFLICT',
          `A redirect from ${sourcePath} already exists`,
        );
      throw error;
    }
  }

  async update(
    id: string,
    body: RedirectWriteInput,
    request: AuthenticatedRequest,
  ) {
    const userId = actorId(request);
    const current = await this.prisma.redirect.findUnique({ where: { id } });
    if (!current) throw notFound();
    const sourcePath =
      body.sourcePath !== undefined
        ? normalizePath(body.sourcePath, 'sourcePath')
        : current.sourcePath;
    const targetPath =
      body.targetPath !== undefined
        ? normalizePath(body.targetPath, 'targetPath')
        : current.targetPath;
    const httpStatusCode =
      body.httpStatusCode !== undefined
        ? normalizeStatusCode(body.httpStatusCode)
        : current.httpStatusCode;
    await this.assertNoLoopOrChain(sourcePath, targetPath, id);
    try {
      const updated = await this.prisma.redirect.update({
        where: { id },
        data: { sourcePath, targetPath, httpStatusCode },
      });
      await writeAudit(
        this.prisma,
        request,
        userId,
        'REDIRECTS',
        'REDIRECT',
        id,
        'REDIRECT_UPDATED',
        {
          sourcePath: current.sourcePath,
          targetPath: current.targetPath,
          httpStatusCode: current.httpStatusCode,
        },
        { sourcePath, targetPath, httpStatusCode },
        `Redirect updated: ${sourcePath} -> ${targetPath}`,
      );
      return this.toDto(updated);
    } catch (error) {
      if (isUniqueConstraintError(error))
        throw conflict(
          'REDIRECT_SOURCE_CONFLICT',
          `A redirect from ${sourcePath} already exists`,
        );
      throw error;
    }
  }

  async setActive(
    id: string,
    isActive: boolean,
    request: AuthenticatedRequest,
  ) {
    const userId = actorId(request);
    const current = await this.prisma.redirect.findUnique({ where: { id } });
    if (!current) throw notFound();
    const updated = await this.prisma.redirect.update({
      where: { id },
      data: { isActive },
    });
    await writeAudit(
      this.prisma,
      request,
      userId,
      'REDIRECTS',
      'REDIRECT',
      id,
      isActive ? 'REDIRECT_ENABLED' : 'REDIRECT_DISABLED',
      { isActive: current.isActive },
      { isActive },
      `Redirect ${isActive ? 'enabled' : 'disabled'}: ${current.sourcePath}`,
    );
    return this.toDto(updated);
  }

  /** The Redirect model has no soft-delete column -- unlike catalog
   * content, a stale redirect row has no ongoing publication value, so
   * "archive" here is a real delete rather than a status flip. Disabling
   * (setActive(false)) is the reversible action; this is the permanent
   * one. */
  async archive(id: string, request: AuthenticatedRequest) {
    const userId = actorId(request);
    const current = await this.prisma.redirect.findUnique({ where: { id } });
    if (!current) throw notFound();
    await this.prisma.redirect.delete({ where: { id } });
    await writeAudit(
      this.prisma,
      request,
      userId,
      'REDIRECTS',
      'REDIRECT',
      id,
      'REDIRECT_ARCHIVED',
      { sourcePath: current.sourcePath, targetPath: current.targetPath },
      null,
      `Redirect archived: ${current.sourcePath} -> ${current.targetPath}`,
    );
    return { archived: true };
  }

  private toDto(row: {
    id: string;
    sourcePath: string;
    targetPath: string;
    httpStatusCode: number;
    isActive: boolean;
    hitCount: bigint;
    lastHitAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      sourcePath: row.sourcePath,
      targetPath: row.targetPath,
      httpStatusCode: row.httpStatusCode,
      isActive: row.isActive,
      hitCount: Number(row.hitCount),
      lastHitAt: row.lastHitAt ? row.lastHitAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
