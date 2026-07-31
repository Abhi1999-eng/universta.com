import { ExpressAdapter } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordService } from '../src/auth/password.service';
import {
  ROTATION_GRACE_MAX_USES,
  ROTATION_GRACE_MS,
} from '../src/auth/auth.service';

/** The login bounce this covers was not a flake.
 *
 * Rotation revokes the old refresh token the instant the new one is issued. A
 * protected navigation already in flight then validated a token that had been
 * dead for microseconds, the Admin middleware took that as "session over", and
 * the user was thrown out while their browser held a perfectly good new cookie.
 *
 * The fix is a bounded grace: a token superseded moments ago may still answer
 * "is this session alive?", a limited number of times, for a short window, and
 * never for anything else. These tests pin both halves -- that the race no
 * longer logs anyone out, and that the grace cannot be turned into a way to
 * keep a revoked token working. */

type TestUser = { id: string; email: string; password: string };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function cookieValue(response: { headers: unknown }): string {
  const cookies = asRecord(response.headers)['set-cookie'];
  const list = Array.isArray(cookies)
    ? cookies.filter((value): value is string => typeof value === 'string')
    : [];
  const cookie = list.find((value) =>
    value.startsWith('universta_admin_refresh='),
  );
  if (!cookie) throw new Error('Refresh cookie was not returned');
  return cookie.split(';', 1)[0];
}

describe('Admin refresh-token rotation race (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let user: TestUser;
  const password = 'rotation-race-test-password';

  const login = () =>
    request(app.getHttpServer())
      .post('/api/v1/admin/auth/login')
      .send({ email: user.email, password })
      .expect(200);

  const validate = (cookie: string) =>
    request(app.getHttpServer())
      .post('/api/v1/admin/auth/session/validate')
      .set('cookie', cookie);

  const refresh = (cookie: string) =>
    request(app.getHttpServer())
      .post('/api/v1/admin/auth/refresh')
      .set('cookie', cookie);

  const logout = (cookie: string) =>
    request(app.getHttpServer())
      .post('/api/v1/admin/auth/logout')
      .set('cookie', cookie);

  /** Logs in and rotates once, returning both sides of the rotation. */
  async function rotatedPair() {
    const original = cookieValue(await login());
    const rotated = cookieValue(await refresh(original).expect(200));
    return { original, rotated };
  }

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication(new ExpressAdapter());
    configureApplication(app);
    await app.init();
    prisma = app.get(PrismaService);
    const passwordService = app.get(PasswordService);
    const email = `rotation-race-${Date.now()}@example.invalid`;
    const created = await prisma.user.create({
      data: {
        email,
        passwordHash: passwordService.hash(password),
        firstName: 'Rotation',
        lastName: 'Race',
        status: 'ACTIVE',
      },
    });
    const role = await prisma.role.findUniqueOrThrow({
      where: { code: 'SUPER_ADMIN' },
    });
    await prisma.userRole.create({
      data: { userId: created.id, roleId: role.id },
    });
    user = { id: created.id, email, password };
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { userId: user.id } });
    await prisma.loginAttempt.deleteMany({ where: { userId: user.id } });
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
    await prisma.userRole.deleteMany({ where: { userId: user.id } });
    await prisma.user.deleteMany({ where: { id: user.id } });
    await app.close();
  });

  // 1
  it('keeps a navigation alive when it validates a token that was rotated mid-flight', async () => {
    const original = cookieValue(await login());
    // The exact interleaving from the bug report: the navigation reads the
    // cookie, a parallel authFetch rotates it, and only then does the
    // navigation's validation reach the API.
    const rotation = refresh(original).expect(200);
    const rotated = cookieValue(await rotation);

    await validate(original).expect(200);
    await validate(rotated).expect(200);
  });

  // 2
  it('survives several protected navigations racing one rotation', async () => {
    const { original, rotated } = await rotatedPair();
    const results = await Promise.all(
      Array.from({ length: ROTATION_GRACE_MAX_USES }, () => validate(original)),
    );
    expect(results.map((response) => response.status)).toEqual(
      Array(ROTATION_GRACE_MAX_USES).fill(200),
    );
    await validate(rotated).expect(200);
  });

  // 3
  it('bounds concurrent grace claims to the cap rather than letting each read the same count', async () => {
    // A read-then-write implementation passes the previous test and fails this
    // one: every request would see a count below the cap and proceed.
    const { original } = await rotatedPair();
    const responses = await Promise.all(
      Array.from({ length: ROTATION_GRACE_MAX_USES + 5 }, () =>
        validate(original),
      ),
    );
    const accepted = responses.filter((r) => r.status === 200).length;
    expect(accepted).toBeLessThanOrEqual(ROTATION_GRACE_MAX_USES);
    expect(accepted).toBeGreaterThan(0);
  });

  // 4
  it('holds up when validation and rotation are separated by real latency', async () => {
    const original = cookieValue(await login());
    const rotated = cookieValue(await refresh(original).expect(200));
    await new Promise((resolve) => setTimeout(resolve, 250));
    await validate(original).expect(200);
    await validate(rotated).expect(200);
  });

  // 5
  it('accepts the superseded token for validation but never for rotation', async () => {
    // The security line. Validation says "your session is alive"; rotation
    // mints credentials. Allowing the latter would let a superseded token fork
    // the session and defeat replay detection entirely.
    const { original } = await rotatedPair();
    await validate(original).expect(200);
    await refresh(original).expect(401);
  });

  // 6
  it('rejects the superseded token once the grace window has passed', async () => {
    const { original } = await rotatedPair();
    const token = await prisma.refreshToken.findFirstOrThrow({
      where: { userId: user.id, revocationReason: 'ROTATED' },
      orderBy: { revokedAt: 'desc' },
    });
    // Ages the rotation past the window rather than sleeping for it.
    await prisma.refreshToken.update({
      where: { id: token.id },
      data: {
        revokedAt: new Date(Date.now() - ROTATION_GRACE_MS - 1_000),
        graceUseCount: 0,
      },
    });
    await validate(original).expect(401);
  });

  // 7
  it('ends the session on explicit logout, with no grace', async () => {
    const cookie = cookieValue(await login());
    await logout(cookie).expect(200);
    await validate(cookie).expect(401);
    await refresh(cookie).expect(401);
  });

  // 8
  it('refuses a token revoked for any reason other than rotation', async () => {
    const cookie = cookieValue(await login());
    await validate(cookie).expect(200);
    await prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date(), revocationReason: 'ADMIN_REVOKED' },
    });
    // Freshly revoked, so inside the window -- only the reason keeps it out.
    await validate(cookie).expect(401);
  });

  // 9
  it('refuses an expired session even within the grace window', async () => {
    const cookie = cookieValue(await login());
    await prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: {
        expiresAt: new Date(Date.now() - 1_000),
        revokedAt: new Date(),
        revocationReason: 'ROTATED',
      },
    });
    await validate(cookie).expect(401);
  });

  // 10
  it('lets a reload land on either side of a rotation', async () => {
    const { original, rotated } = await rotatedPair();
    // A reload issued before the rotation completes carries the old cookie;
    // one issued after carries the new. Both must render.
    await validate(original).expect(200);
    await validate(rotated).expect(200);
    await validate(rotated).expect(200);
  });

  // 11
  it('keeps every tab signed in when one of them triggers the rotation', async () => {
    const { original, rotated } = await rotatedPair();
    const tabs = await Promise.all([
      validate(original),
      validate(rotated),
      validate(rotated),
    ]);
    expect(tabs.map((response) => response.status)).toEqual([200, 200, 200]);
  });

  // 12
  it('records each grace use for review', async () => {
    const before = new Date(Date.now() - 1_000);
    const { original } = await rotatedPair();
    await validate(original).expect(200);
    const audits = await prisma.auditLog.findMany({
      where: {
        userId: user.id,
        action: 'ROTATION_GRACE_VALIDATE',
        createdAt: { gte: before },
      },
    });
    expect(audits.length).toBeGreaterThan(0);
    expect(audits[0]).toMatchObject({
      module: 'AUTH',
      entityType: 'REFRESH_TOKEN',
    });
  });

  it('never returns the refresh token in a validation body', async () => {
    const cookie = cookieValue(await login());
    const response = await validate(cookie).expect(200);
    const raw = cookie.split('=').slice(1).join('=');
    expect(JSON.stringify(response.body)).not.toContain(raw);
  });

  it('keeps the refresh cookie HttpOnly on every issuing response', async () => {
    const response = await login();
    const cookies = asRecord(response.headers)['set-cookie'] as string[];
    const refreshCookie = cookies.find((value) =>
      value.startsWith('universta_admin_refresh='),
    )!;
    expect(refreshCookie).toContain('HttpOnly');
  });
});
