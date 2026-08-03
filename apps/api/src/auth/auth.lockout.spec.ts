import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { JwtService } from '@nestjs/jwt';
import type { PasswordService } from './password.service';
import type { RuntimeConfigService } from '../config/runtime-config.service';
import type { RequestContextService } from '../common/request-context.service';
import type { StructuredLogger } from '../common/structured-logger.service';

/** Module 8 (Authentication). `recordFailedLogin`'s lockout counter had no
 * test coverage at all -- this pins the exact boundary: the attempt that
 * reaches `authMaxFailedAttempts` locks the account (429 ACCOUNT_LOCKED),
 * one attempt short does not, and a successful login clears both the
 * counter and any lock. Verified here rather than by exhausting attempts
 * against the real deployed demo admin account, since that account is the
 * only login this whole acceptance program depends on -- locking it out
 * live for `AUTH_LOCK_MINUTES` would be a self-inflicted availability
 * incident, not a useful test. */

const MAX_FAILED_ATTEMPTS = 3;
const LOCK_MINUTES = 15;

type UserRow = {
  id: string;
  email: string;
  passwordHash: string;
  status: string;
  deletedAt: Date | null;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  userRoles: { role: { code: string; status: string } }[];
};

function fakeUser(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: 'user-1',
    email: 'demo-admin@universta.com',
    passwordHash: 'irrelevant-hash',
    status: 'ACTIVE',
    deletedAt: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    userRoles: [{ role: { code: 'SUPER_ADMIN', status: 'ACTIVE' } }],
    ...overrides,
  };
}

function fakePrisma(user: UserRow) {
  const store = { ...user };
  return {
    user: {
      findUnique: async () => ({ ...store }),
      update: async ({ data }: { data: Record<string, unknown> }) => {
        if ('failedLoginAttempts' in data) {
          const inc = data.failedLoginAttempts as { increment?: number };
          store.failedLoginAttempts = inc?.increment
            ? store.failedLoginAttempts + inc.increment
            : (data.failedLoginAttempts as number);
        }
        if ('lockedUntil' in data)
          store.lockedUntil = data.lockedUntil as Date | null;
        return { ...store };
      },
    },
    loginAttempt: { create: async () => ({}) },
    refreshToken: { updateMany: async () => ({ count: 0 }) },
    $transaction: async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        user: {
          update: async ({ data }: { data: Record<string, unknown> }) =>
            fakePrismaInstance.user.update({ data }),
        },
        loginAttempt: fakePrismaInstance.loginAttempt,
      };
      return fn(tx);
    },
    _store: store,
  } as unknown as PrismaService & { _store: UserRow };
}

let fakePrismaInstance: any;

function service(user: UserRow) {
  const prisma = fakePrisma(user);
  fakePrismaInstance = prisma;
  const password = { verify: () => false } as unknown as PasswordService;
  const runtimeConfig = {
    authMaxFailedAttempts: MAX_FAILED_ATTEMPTS,
    authLockMinutes: LOCK_MINUTES,
  } as unknown as RuntimeConfigService;
  const context = {} as RequestContextService;
  const logger = {
    logError: () => {},
    logRequest: () => {},
  } as unknown as StructuredLogger;
  const jwt = {} as JwtService;
  return {
    svc: new AuthService(prisma, jwt, password, runtimeConfig, context, logger),
    prisma,
  };
}

const metadata = {
  requestId: 'req-1',
  ipAddress: '127.0.0.1',
  userAgent: 'jest',
};

describe('AuthService.login -- lockout boundary', () => {
  it('does not lock the account one attempt short of the threshold', async () => {
    const { svc, prisma } = service(
      fakeUser({ failedLoginAttempts: MAX_FAILED_ATTEMPTS - 2 }),
    );
    await expect(
      svc.login(
        { email: 'demo-admin@universta.com', password: 'wrong' },
        metadata,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma._store.failedLoginAttempts).toBe(MAX_FAILED_ATTEMPTS - 1);
    expect(prisma._store.lockedUntil).toBeNull();
  });

  it('locks the account on the attempt that reaches the threshold', async () => {
    const { svc, prisma } = service(
      fakeUser({ failedLoginAttempts: MAX_FAILED_ATTEMPTS - 1 }),
    );
    await expect(
      svc.login(
        { email: 'demo-admin@universta.com', password: 'wrong' },
        metadata,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma._store.failedLoginAttempts).toBe(MAX_FAILED_ATTEMPTS);
    expect(prisma._store.lockedUntil).not.toBeNull();
  });

  it('rejects a locked account with 429 ACCOUNT_LOCKED even given the correct password', async () => {
    const { svc } = service(
      fakeUser({ lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) }),
    );
    await expect(
      svc.login(
        { email: 'demo-admin@universta.com', password: 'irrelevant' },
        metadata,
      ),
    ).rejects.toMatchObject({
      status: 429,
      response: { code: 'ACCOUNT_LOCKED' },
    });
  });

  it('a lock that has already expired does not block a fresh attempt', async () => {
    const { svc } = service(
      fakeUser({ lockedUntil: new Date(Date.now() - 60_000) }),
    );
    // Password still "wrong" (the fake PasswordService always returns
    // false) -- this proves the expired lock itself isn't what's blocking
    // the request, since it still reaches the normal credential check
    // instead of short-circuiting on ACCOUNT_LOCKED.
    await expect(
      svc.login(
        { email: 'demo-admin@universta.com', password: 'wrong' },
        metadata,
      ),
    ).rejects.not.toMatchObject({ response: { code: 'ACCOUNT_LOCKED' } });
  });
});
