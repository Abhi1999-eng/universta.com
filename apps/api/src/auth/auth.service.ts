import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RequestContextService } from '../common/request-context.service';
import { StructuredLogger } from '../common/structured-logger.service';
import { RuntimeConfigService } from '../config/runtime-config.service';
import { PasswordService } from './password.service';
import {
  ACCESS_TOKEN_TYPE,
  AUTH_AUDIENCE,
  AUTH_ISSUER,
  REFRESH_TOKEN_TYPE,
  SUPER_ADMIN_ROLE,
  type AccessTokenPayload,
  type AuthenticatedAdmin,
  type AuthRequestMetadata,
  type AuthResponseData,
  type RefreshTokenPayload,
} from './auth.types';
import type { LoginDto } from './dto/login.dto';

const USER_ROLES_INCLUDE = { include: { role: true } } as const;
const USER_INCLUDE = { userRoles: USER_ROLES_INCLUDE } as const;

function invalidCredentials(): UnauthorizedException {
  return new UnauthorizedException({
    code: 'INVALID_CREDENTIALS',
    message: 'Invalid email or password',
    details: null,
  });
}

function invalidRefreshToken(): UnauthorizedException {
  return new UnauthorizedException({
    code: 'INVALID_REFRESH_TOKEN',
    message: 'Invalid refresh token',
    details: null,
  });
}

function invalidAuthenticatedAdmin(): UnauthorizedException {
  return new UnauthorizedException({
    code: 'INVALID_ACCESS_TOKEN',
    message: 'Invalid access token',
    details: null,
  });
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function hashesMatch(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly password: PasswordService,
    private readonly runtimeConfig: RuntimeConfigService,
    private readonly context: RequestContextService,
    private readonly logger: StructuredLogger,
  ) {}

  async login(
    dto: LoginDto,
    metadata: AuthRequestMetadata,
  ): Promise<AuthResponseData & { refreshToken: string }> {
    const email = normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: USER_INCLUDE,
    });
    const now = new Date();

    if (!user) {
      await this.prisma.loginAttempt.create({
        data: {
          attemptedEmail: email,
          wasSuccessful: false,
          failureReason: 'UNKNOWN_EMAIL',
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          requestId: metadata.requestId,
        },
      });
      throw invalidCredentials();
    }

    if (user.lockedUntil && user.lockedUntil > now) {
      await this.recordLoginAttempt(
        user.id,
        email,
        false,
        'ACCOUNT_LOCKED',
        metadata,
      );
      throw new HttpException(
        {
          code: 'ACCOUNT_LOCKED',
          message: 'Account temporarily locked',
          details: null,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const hasSuperAdminRole = user.userRoles.some(
      (userRole) =>
        userRole.role.code === SUPER_ADMIN_ROLE &&
        userRole.role.status === 'ACTIVE',
    );
    const eligible =
      user.status === 'ACTIVE' && !user.deletedAt && hasSuperAdminRole;
    const passwordMatches = this.password.verify(
      dto.password,
      user.passwordHash,
    );

    if (!eligible || !passwordMatches) {
      await this.recordFailedLogin(user.id, email, metadata);
      throw invalidCredentials();
    }

    const admin = this.toAdmin(user);
    return this.createAuthenticatedSession(admin, metadata, user.id);
  }

  async refresh(
    rawRefreshToken: string | undefined,
    metadata: AuthRequestMetadata,
  ): Promise<AuthResponseData & { refreshToken: string }> {
    if (!rawRefreshToken) {
      throw invalidRefreshToken();
    }

    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(
        rawRefreshToken,
        {
          secret: this.runtimeConfig.jwtRefreshSecret,
          issuer: AUTH_ISSUER,
          audience: AUTH_AUDIENCE,
        },
      );
    } catch {
      throw invalidRefreshToken();
    }

    if (
      payload.type !== REFRESH_TOKEN_TYPE ||
      typeof payload.sub !== 'string' ||
      typeof payload.jti !== 'string'
    ) {
      throw invalidRefreshToken();
    }

    const stored = await this.prisma.refreshToken.findUnique({
      where: { id: payload.jti },
      include: { user: { include: USER_INCLUDE } },
    });
    if (
      !stored ||
      stored.userId !== payload.sub ||
      stored.revokedAt ||
      stored.expiresAt <= new Date()
    ) {
      throw invalidRefreshToken();
    }
    if (!hashesMatch(stored.tokenHash, tokenHash(rawRefreshToken))) {
      throw invalidRefreshToken();
    }

    const hasSuperAdminRole = stored.user.userRoles.some(
      (userRole) =>
        userRole.role.code === SUPER_ADMIN_ROLE &&
        userRole.role.status === 'ACTIVE',
    );
    if (
      stored.user.status !== 'ACTIVE' ||
      stored.user.deletedAt ||
      !hasSuperAdminRole
    ) {
      throw invalidRefreshToken();
    }

    const admin = this.toAdmin(stored.user);
    const next = await this.issueTokens(admin);
    await this.prisma.$transaction(async (transaction) => {
      await transaction.refreshToken.create({
        data: {
          id: next.refreshTokenId,
          userId: admin.id,
          tokenHash: tokenHash(next.refreshToken),
          expiresAt: next.refreshExpiresAt,
          createdIp: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
      });
      await transaction.refreshToken.update({
        where: { id: stored.id },
        data: {
          revokedAt: new Date(),
          revocationReason: 'ROTATED',
          replacedByTokenId: next.refreshTokenId,
        },
      });
    });
    return next.response;
  }

  async logout(
    rawRefreshToken: string | undefined,
    metadata: AuthRequestMetadata,
  ): Promise<void> {
    if (!rawRefreshToken) {
      return;
    }

    try {
      const payload = await this.jwt.verifyAsync<RefreshTokenPayload>(
        rawRefreshToken,
        {
          secret: this.runtimeConfig.jwtRefreshSecret,
          issuer: AUTH_ISSUER,
          audience: AUTH_AUDIENCE,
        },
      );
      if (
        payload.type !== REFRESH_TOKEN_TYPE ||
        typeof payload.jti !== 'string'
      ) {
        return;
      }
      const stored = await this.prisma.refreshToken.findUnique({
        where: { id: payload.jti },
      });
      if (
        !stored ||
        stored.revokedAt ||
        !hashesMatch(stored.tokenHash, tokenHash(rawRefreshToken))
      ) {
        return;
      }

      await this.prisma.$transaction([
        this.prisma.refreshToken.update({
          where: { id: stored.id },
          data: { revokedAt: new Date(), revocationReason: 'LOGOUT' },
        }),
        this.prisma.auditLog.create({
          data: {
            userId: stored.userId,
            module: 'AUTH',
            entityType: 'REFRESH_TOKEN',
            entityId: stored.id,
            action: 'LOGOUT',
            description: 'Super Admin logout',
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
            requestId: metadata.requestId,
          },
        }),
      ]);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        return;
      }
      this.logger.logError('logout persistence failed', {
        requestId: this.context.getRequestId(),
        reason: 'LOGOUT_PERSISTENCE_FAILURE',
      });
    }
  }

  async getCurrentAdmin(userId: string): Promise<AuthenticatedAdmin> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: USER_INCLUDE,
    });
    const hasSuperAdminRole = user?.userRoles.some(
      (userRole) =>
        userRole.role.code === SUPER_ADMIN_ROLE &&
        userRole.role.status === 'ACTIVE',
    );
    if (
      !user ||
      user.status !== 'ACTIVE' ||
      user.deletedAt ||
      !hasSuperAdminRole
    ) {
      throw invalidAuthenticatedAdmin();
    }
    return this.toAdmin(user);
  }

  private async createAuthenticatedSession(
    admin: AuthenticatedAdmin,
    metadata: AuthRequestMetadata,
    userId: string,
  ): Promise<AuthResponseData & { refreshToken: string }> {
    const issued = await this.issueTokens(admin);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: new Date(),
          lastLoginIp: metadata.ipAddress,
        },
      }),
      this.prisma.loginAttempt.create({
        data: {
          userId,
          attemptedEmail: admin.email,
          wasSuccessful: true,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          requestId: metadata.requestId,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          userId,
          module: 'AUTH',
          entityType: 'USER',
          entityId: userId,
          action: 'LOGIN',
          description: 'Super Admin login',
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          requestId: metadata.requestId,
        },
      }),
      this.prisma.refreshToken.create({
        data: {
          id: issued.refreshTokenId,
          userId,
          tokenHash: tokenHash(issued.refreshToken),
          expiresAt: issued.refreshExpiresAt,
          createdIp: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
      }),
    ]);
    return issued.response;
  }

  private async issueTokens(admin: AuthenticatedAdmin): Promise<{
    response: AuthResponseData & { refreshToken: string };
    refreshToken: string;
    refreshTokenId: string;
    refreshExpiresAt: Date;
  }> {
    const refreshTokenId = randomUUID();
    const accessToken = await this.jwt.signAsync<AccessTokenPayload>(
      {
        sub: admin.id,
        email: admin.email,
        roles: admin.roles,
        type: ACCESS_TOKEN_TYPE,
        jti: randomUUID(),
      },
      {
        secret: this.runtimeConfig.jwtAccessSecret,
        expiresIn: this.runtimeConfig.jwtAccessTtl as never,
        issuer: AUTH_ISSUER,
        audience: AUTH_AUDIENCE,
      },
    );
    const refreshToken = await this.jwt.signAsync<RefreshTokenPayload>(
      {
        sub: admin.id,
        jti: refreshTokenId,
        type: REFRESH_TOKEN_TYPE,
      },
      {
        secret: this.runtimeConfig.jwtRefreshSecret,
        expiresIn: this.runtimeConfig.jwtRefreshTtl as never,
        issuer: AUTH_ISSUER,
        audience: AUTH_AUDIENCE,
      },
    );
    const refreshExpiresAt = new Date(
      Date.now() + this.refreshTtlSeconds() * 1000,
    );
    return {
      response: {
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
        expiresIn: this.accessTtlSeconds(),
        user: admin,
      },
      refreshToken,
      refreshTokenId,
      refreshExpiresAt,
    };
  }

  private async recordFailedLogin(
    userId: string,
    email: string,
    metadata: AuthRequestMetadata,
  ): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction(async (transaction) => {
      const user = await transaction.user.update({
        where: { id: userId },
        data: { failedLoginAttempts: { increment: 1 } },
        select: { failedLoginAttempts: true },
      });
      const locked =
        user.failedLoginAttempts >= this.runtimeConfig.authMaxFailedAttempts;
      await transaction.user.update({
        where: { id: userId },
        data: locked
          ? {
              lockedUntil: new Date(
                now.getTime() + this.runtimeConfig.authLockMinutes * 60_000,
              ),
            }
          : { lockedUntil: null },
      });
      await transaction.loginAttempt.create({
        data: {
          userId,
          attemptedEmail: email,
          wasSuccessful: false,
          failureReason: locked
            ? 'LOCKED_AFTER_FAILURES'
            : 'INVALID_CREDENTIALS',
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          requestId: metadata.requestId,
        },
      });
    });
  }

  private async recordLoginAttempt(
    userId: string,
    email: string,
    wasSuccessful: boolean,
    failureReason: string,
    metadata: AuthRequestMetadata,
  ): Promise<void> {
    await this.prisma.loginAttempt.create({
      data: {
        userId,
        attemptedEmail: email,
        wasSuccessful,
        failureReason,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        requestId: metadata.requestId,
      },
    });
  }

  private toAdmin(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string | null;
    userRoles: Array<{ role: { code: string; status: string } }>;
  }): AuthenticatedAdmin {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.userRoles
        .filter((userRole) => userRole.role.status === 'ACTIVE')
        .map((userRole) => userRole.role.code),
    };
  }

  private accessTtlSeconds(): number {
    return this.ttlSeconds(this.runtimeConfig.jwtAccessTtl);
  }

  private refreshTtlSeconds(): number {
    return this.ttlSeconds(this.runtimeConfig.jwtRefreshTtl);
  }

  private ttlSeconds(value: string): number {
    const amount = Number(value.slice(0, -1));
    const unit = value.at(-1);
    return (
      amount *
      (unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86400)
    );
  }
}
