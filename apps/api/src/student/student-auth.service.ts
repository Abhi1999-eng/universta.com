import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { PasswordService } from '../auth/password.service';
import { StructuredLogger } from '../common/structured-logger.service';
import {
  STUDENT_ROLE,
  type AuthRequestMetadata,
  type AuthResponseData,
} from '../auth/auth.types';

/** Verification and reset links live for a day; long enough to survive a slow
 * inbox, short enough that a forwarded mail stops working. */
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
/** A student may ask for a fresh verification mail this often. */
const RESEND_INTERVAL_MS = 60 * 1000;

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function safeEquals(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface StudentIdentity {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
  emailVerified: boolean;
}

@Injectable()
export class StudentAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly password: PasswordService,
    private readonly logger: StructuredLogger,
  ) {}

  /**
   * Creates a student account.
   *
   * The role is assigned here from a constant. Nothing about the request body
   * can influence it: the DTO carries no role, roleId or permission field, so
   * there is no value for a caller to smuggle in.
   */
  async register(
    input: {
      firstName: string;
      lastName?: string;
      email: string;
      phoneCountryCode?: string;
      phoneNumber?: string;
      password: string;
    },
    metadata: AuthRequestMetadata,
  ): Promise<{ verificationRequired: boolean }> {
    const email = normalizeEmail(input.email);
    const role = await this.prisma.role.findUnique({
      where: { code: STUDENT_ROLE },
    });
    if (!role || role.status !== 'ACTIVE') {
      throw new HttpException(
        {
          code: 'REGISTRATION_UNAVAILABLE',
          message: 'Registration is temporarily unavailable',
          details: null,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      // A duplicate is reported plainly: this address is typed by its owner on
      // a form they are looking at, so "already registered" is the useful
      // answer. Enumeration is guarded on the flows a stranger can probe —
      // forgot-password and resend — not here.
      throw new HttpException(
        {
          code: 'EMAIL_ALREADY_REGISTERED',
          message: 'An account already exists for this email address',
          details: null,
        },
        HttpStatus.CONFLICT,
      );
    }

    const passwordHash = this.password.hash(input.password);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: input.firstName.trim(),
        lastName: input.lastName?.trim() || null,
        phoneCountryCode: input.phoneCountryCode?.trim() || null,
        phoneNumber: input.phoneNumber?.trim() || null,
        status: 'ACTIVE',
        passwordChangedAt: new Date(),
        userRoles: { create: { roleId: role.id } },
        studentProfile: { create: {} },
      },
    });

    await this.issueVerificationToken(user.id, email, metadata.ipAddress);
    return { verificationRequired: true };
  }

  async login(
    dto: { email: string; password: string },
    metadata: AuthRequestMetadata,
  ): Promise<AuthResponseData & { refreshToken: string }> {
    return this.auth.login(dto, metadata, 'STUDENT');
  }

  async refresh(
    rawRefreshToken: string | undefined,
    metadata: AuthRequestMetadata,
  ): Promise<AuthResponseData & { refreshToken: string }> {
    return this.auth.refresh(rawRefreshToken, metadata, 'STUDENT');
  }

  async logout(
    rawRefreshToken: string | undefined,
    metadata: AuthRequestMetadata,
  ): Promise<void> {
    return this.auth.logout(rawRefreshToken, metadata, 'STUDENT');
  }

  async me(userId: string): Promise<StudentIdentity> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        emailVerifiedAt: true,
      },
    });
    if (!user) {
      throw new HttpException(
        { code: 'NOT_FOUND', message: 'Account not found', details: null },
        HttpStatus.NOT_FOUND,
      );
    }
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      emailVerified: user.emailVerifiedAt !== null,
    };
  }

  // -- email verification -------------------------------------------------

  private async issueVerificationToken(
    userId: string,
    email: string,
    ipAddress: string | null,
  ): Promise<string> {
    const raw = randomBytes(32).toString('hex');
    await this.prisma.emailVerificationToken.create({
      data: {
        userId,
        email,
        tokenHash: hashToken(raw),
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
        requestedIp: ipAddress,
      },
    });
    // No mail transport is configured in this repository yet, so the delivery
    // point is recorded rather than silently dropped. The token itself is
    // never logged.
    this.logger.logEvent('student email verification token issued', {
      module: 'STUDENT_AUTH',
      userId,
    });
    return raw;
  }

  /**
   * Always answers the same way. A stranger probing addresses learns nothing
   * about which ones exist, and neither does a rate-limit sniffer.
   */
  async resendVerification(
    email: string,
    metadata: AuthRequestMetadata,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
      select: { id: true, email: true, emailVerifiedAt: true, deletedAt: true },
    });
    if (!user || user.deletedAt || user.emailVerifiedAt) {
      return;
    }

    const recent = await this.prisma.emailVerificationToken.findFirst({
      where: {
        userId: user.id,
        createdAt: { gt: new Date(Date.now() - RESEND_INTERVAL_MS) },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (recent) {
      return;
    }

    await this.issueVerificationToken(user.id, user.email, metadata.ipAddress);
  }

  async verifyEmail(rawToken: string): Promise<void> {
    const stored = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
      include: { user: { select: { id: true, deletedAt: true } } },
    });

    const invalid = new HttpException(
      {
        code: 'INVALID_VERIFICATION_TOKEN',
        message: 'This verification link is invalid or has expired',
        details: null,
      },
      HttpStatus.BAD_REQUEST,
    );

    if (
      !stored ||
      stored.usedAt ||
      stored.expiresAt <= new Date() ||
      stored.user.deletedAt
    ) {
      throw invalid;
    }
    // Belt and braces against a hash collision or a tampered row.
    if (!safeEquals(stored.tokenHash, hashToken(rawToken))) {
      throw invalid;
    }

    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.update({
        where: { id: stored.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: stored.userId },
        data: { emailVerifiedAt: new Date() },
      }),
      // Every other outstanding link for this account stops working.
      this.prisma.emailVerificationToken.updateMany({
        where: { userId: stored.userId, usedAt: null },
        data: { usedAt: new Date() },
      }),
    ]);
  }

  // -- password reset -----------------------------------------------------

  /** Same response whether or not the address is known. */
  async forgotPassword(
    email: string,
    metadata: AuthRequestMetadata,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
      include: { userRoles: { include: { role: true } } },
    });
    const isStudent = user?.userRoles.some(
      (userRole) =>
        userRole.role.code === STUDENT_ROLE && userRole.role.status === 'ACTIVE',
    );
    if (!user || user.deletedAt || user.status !== 'ACTIVE' || !isStudent) {
      return;
    }

    const raw = randomBytes(32).toString('hex');
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(raw),
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
        requestedIp: metadata.ipAddress,
      },
    });
    this.logger.logEvent('student password reset token issued', {
      module: 'STUDENT_AUTH',
      userId: user.id,
    });
  }

  /**
   * Consumes the token, sets the new password and revokes every existing
   * session — a reset is what someone does when they fear their account is
   * compromised, so old sessions must not survive it.
   */
  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const stored = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
      include: { user: { select: { id: true, deletedAt: true } } },
    });

    if (
      !stored ||
      stored.usedAt ||
      stored.expiresAt <= new Date() ||
      stored.user.deletedAt
    ) {
      throw new HttpException(
        {
          code: 'INVALID_RESET_TOKEN',
          message: 'This reset link is invalid or has expired',
          details: null,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const passwordHash = this.password.hash(newPassword);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({
        where: { id: stored.id },
        data: { usedAt: now },
      }),
      this.prisma.passwordResetToken.updateMany({
        where: { userId: stored.userId, usedAt: null },
        data: { usedAt: now },
      }),
      this.prisma.user.update({
        where: { id: stored.userId },
        data: {
          passwordHash,
          passwordChangedAt: now,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: now, revocationReason: 'PASSWORD_RESET' },
      }),
    ]);
  }
}
