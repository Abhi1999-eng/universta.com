import { ExpressAdapter } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordService } from '../src/auth/password.service';
import { RuntimeConfigService } from '../src/config/runtime-config.service';
import {
  ACCESS_TOKEN_TYPE,
  AUTH_AUDIENCE,
  AUTH_ISSUER,
  REFRESH_TOKEN_TYPE,
} from '../src/auth/auth.types';

type TestUser = { id: string; email: string; password: string };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function setCookieHeaders(response: { headers: unknown }): string[] {
  const cookies = asRecord(response.headers)['set-cookie'];
  if (!Array.isArray(cookies)) {
    return [];
  }
  return cookies.filter((value): value is string => typeof value === 'string');
}

function cookieValue(response: { headers: unknown }): string {
  const cookies = setCookieHeaders(response);
  if (!cookies.length) {
    throw new Error('Refresh cookie was not returned');
  }
  const cookie = cookies.find((value) =>
    value.startsWith('universta_admin_refresh='),
  );
  if (!cookie) {
    throw new Error('Refresh cookie was not returned');
  }
  return cookie.split(';', 1)[0];
}

function bodyOf(response: { body: unknown }): Record<string, unknown> {
  return asRecord(response.body);
}

function dataOf(body: Record<string, unknown>): Record<string, unknown> {
  return asRecord(body.data);
}

function errorOf(body: Record<string, unknown>): Record<string, unknown> {
  return asRecord(body.error);
}

describe('Super Admin authentication (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let passwordService: PasswordService;
  const testUsers: TestUser[] = [];
  const password = 'task-002-test-password';

  async function createUser(
    suffix: string,
    options: { role?: boolean; status?: string; deleted?: boolean } = {},
  ): Promise<TestUser> {
    const email = `task002-${suffix}-${Date.now()}-${testUsers.length}@example.invalid`;
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: passwordService.hash(password),
        firstName: 'Task',
        lastName: 'Two',
        status: options.status ?? 'ACTIVE',
        deletedAt: options.deleted ? new Date() : null,
      },
    });
    if (options.role !== false) {
      const role = await prisma.role.findUniqueOrThrow({
        where: { code: 'SUPER_ADMIN' },
      });
      await prisma.userRole.create({
        data: { userId: user.id, roleId: role.id },
      });
    }
    const result = { id: user.id, email, password };
    testUsers.push(result);
    return result;
  }

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication(new ExpressAdapter());
    configureApplication(app);
    await app.init();
    prisma = app.get(PrismaService);
    passwordService = app.get(PasswordService);
    await createUser('primary');
    await createUser('no-role', { role: false });
    await createUser('inactive', { status: 'INACTIVE' });
    await createUser('deleted', { deleted: true });
    await createUser('lockout');
  });

  afterAll(async () => {
    const ids = testUsers.map((user) => user.id);
    if (ids.length) {
      await prisma.auditLog.deleteMany({ where: { userId: { in: ids } } });
      await prisma.loginAttempt.deleteMany({ where: { userId: { in: ids } } });
      await prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } });
      await prisma.userRole.deleteMany({ where: { userId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
    await app.close();
  });

  it('logs in, returns the standard envelope, sets an Admin-route HttpOnly cookie, and does not return the refresh token', async () => {
    const user = testUsers[0];
    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/auth/login')
      .set('user-agent', 'task-002-test')
      .send({ email: ` ${user.email.toUpperCase()} `, password })
      .expect(200);
    const body = bodyOf(response);
    const data = dataOf(body);
    expect(data.tokenType).toBe('Bearer');
    expect(typeof data.expiresIn).toBe('number');
    expect(data.user).toMatchObject({
      id: user.id,
      email: user.email,
      roles: ['SUPER_ADMIN'],
    });
    expect(typeof data.accessToken).toBe('string');
    expect(body.meta).toBeNull();
    expect(body.error).toBeNull();
    expect(typeof body.requestId).toBe('string');
    const cookie = cookieValue(response);
    expect(cookie).toContain('universta_admin_refresh=');
    expect(setCookieHeaders(response)[0]).toContain('HttpOnly');
    expect(setCookieHeaders(response)[0]).toContain('Path=/');
    expect(JSON.stringify(body)).not.toContain(cookie.split('=')[1]);
    expect(response.headers['x-request-id']).toBe(body.requestId);
  });

  it('records the login attempt and LOGIN audit event', async () => {
    const user = testUsers[0];
    const before = new Date(Date.now() - 1000);
    await request(app.getHttpServer())
      .post('/api/v1/admin/auth/login')
      .send({ email: user.email, password })
      .expect(200);
    const attempt = await prisma.loginAttempt.findFirst({
      where: {
        userId: user.id,
        wasSuccessful: true,
        createdAt: { gte: before },
      },
      orderBy: { createdAt: 'desc' },
    });
    const audit = await prisma.auditLog.findFirst({
      where: { userId: user.id, action: 'LOGIN', createdAt: { gte: before } },
      orderBy: { createdAt: 'desc' },
    });
    expect(attempt).toMatchObject({
      attemptedEmail: user.email,
      wasSuccessful: true,
    });
    expect(audit).toMatchObject({
      module: 'AUTH',
      entityType: 'USER',
      action: 'LOGIN',
    });
  });

  it('accepts a valid bearer token at /me and rejects missing and malformed credentials', async () => {
    const user = testUsers[0];
    const login = await request(app.getHttpServer())
      .post('/api/v1/admin/auth/login')
      .send({ email: user.email, password })
      .expect(200);
    const accessToken = dataOf(bodyOf(login)).accessToken as string;
    const me = await request(app.getHttpServer())
      .get('/api/v1/admin/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(dataOf(bodyOf(me)).user).toMatchObject({
      id: user.id,
      roles: ['SUPER_ADMIN'],
    });
    await request(app.getHttpServer())
      .get('/api/v1/admin/auth/me')
      .expect(401)
      .expect((response) =>
        expect(errorOf(bodyOf(response)).code).toBe('INVALID_ACCESS_TOKEN'),
      );
    await request(app.getHttpServer())
      .get('/api/v1/admin/auth/me')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);
  });

  it('rotates refresh tokens, rejects replay, and never exposes raw refresh values in JSON', async () => {
    const user = testUsers[0];
    const login = await request(app.getHttpServer())
      .post('/api/v1/admin/auth/login')
      .send({ email: user.email, password })
      .expect(200);
    const oldCookie = cookieValue(login);
    const refresh = await request(app.getHttpServer())
      .post('/api/v1/admin/auth/refresh')
      .set('Cookie', oldCookie)
      .expect(200);
    const newCookie = cookieValue(refresh);
    expect(newCookie).not.toBe(oldCookie);
    expect(dataOf(bodyOf(refresh)).accessToken).toEqual(expect.any(String));
    expect(JSON.stringify(bodyOf(refresh))).not.toContain(
      newCookie.split('=')[1],
    );
    await request(app.getHttpServer())
      .post('/api/v1/admin/auth/refresh')
      .set('Cookie', oldCookie)
      .expect(401)
      .expect((response) =>
        expect(errorOf(bodyOf(response)).code).toBe('INVALID_REFRESH_TOKEN'),
      );
    const stored = await prisma.refreshToken.findFirst({
      where: { userId: user.id, revocationReason: 'ROTATED' },
      orderBy: { createdAt: 'desc' },
    });
    expect(stored?.revokedAt).toBeInstanceOf(Date);
    expect(typeof stored?.replacedByTokenId).toBe('string');
    expect(stored?.tokenHash).not.toContain(newCookie.split('=')[1]);
  });

  it('logs out idempotently, clears the cookie, and records LOGOUT', async () => {
    const user = testUsers[0];
    const login = await request(app.getHttpServer())
      .post('/api/v1/admin/auth/login')
      .send({ email: user.email, password })
      .expect(200);
    const cookie = cookieValue(login);
    const logout = await request(app.getHttpServer())
      .post('/api/v1/admin/auth/logout')
      .set('Cookie', cookie)
      .expect(200);
    expect(dataOf(bodyOf(logout))).toEqual({ loggedOut: true });
    expect(setCookieHeaders(logout)[0]).toContain(
      'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    );
    await request(app.getHttpServer())
      .post('/api/v1/admin/auth/logout')
      .expect(200);
    const stored = await prisma.refreshToken.findFirst({
      where: { userId: user.id, revocationReason: 'LOGOUT' },
      orderBy: { createdAt: 'desc' },
    });
    const audit = await prisma.auditLog.findFirst({
      where: { userId: user.id, action: 'LOGOUT' },
      orderBy: { createdAt: 'desc' },
    });
    expect(stored?.revokedAt).toEqual(expect.any(Date));
    expect(audit).toMatchObject({ module: 'AUTH', action: 'LOGOUT' });
  });

  it(
    'uses one generic login failure for unknown, invalid, inactive, deleted, and non-admin users',
    async () => {
      const cases = [
        { email: 'missing-task002@example.invalid', password },
        { email: testUsers[0].email, password: 'wrong-password' },
        { email: testUsers[1].email, password },
        { email: testUsers[2].email, password },
        { email: testUsers[3].email, password },
      ];
      for (const testCase of cases) {
        const response = await request(app.getHttpServer())
          .post('/api/v1/admin/auth/login')
          .send(testCase)
          .expect(401);
        expect(errorOf(bodyOf(response))).toMatchObject({
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        });
      }
    },
    // Five real bcrypt comparisons in sequence, deliberately CPU-heavy (that
    // is what makes the generic-failure timing actually constant against
    // user enumeration). The default 5s budget is fine in isolation but
    // gets tight once the full e2e suite's parallel Jest workers are all
    // doing their own bcrypt/NestJS-bootstrap work at the same time --
    // widen the budget rather than weaken what the test checks.
    15000,
  );

  it('increments failed attempts, locks after the threshold, and resets after an expired lock', async () => {
    const user = testUsers[4];
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app.getHttpServer())
        .post('/api/v1/admin/auth/login')
        .send({ email: user.email, password: 'wrong-password' })
        .expect(401);
    }
    const locked = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(locked.failedLoginAttempts).toBe(5);
    expect(locked.lockedUntil).toEqual(expect.any(Date));
    await request(app.getHttpServer())
      .post('/api/v1/admin/auth/login')
      .send({ email: user.email, password })
      .expect(429);
    await prisma.user.update({
      where: { id: user.id },
      data: { lockedUntil: new Date(Date.now() - 1000) },
    });
    await request(app.getHttpServer())
      .post('/api/v1/admin/auth/login')
      .send({ email: user.email, password })
      .expect(200);
    const reset = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(reset.failedLoginAttempts).toBe(0);
    expect(reset.lockedUntil).toBeNull();
    expect(reset.lastLoginAt).toEqual(expect.any(Date));
  });

  it('rejects expired and wrong-type access tokens and rejects an inactive user at /me', async () => {
    const jwt = app.get(JwtService);
    const config = app.get(RuntimeConfigService);
    const user = testUsers[0];
    const base = {
      sub: user.id,
      email: user.email,
      roles: ['SUPER_ADMIN'],
      jti: 'task002-test',
    };
    const expired = await jwt.signAsync(
      { ...base, type: ACCESS_TOKEN_TYPE },
      {
        secret: config.jwtAccessSecret,
        expiresIn: -1,
        issuer: AUTH_ISSUER,
        audience: AUTH_AUDIENCE,
      },
    );
    const wrongType = await jwt.signAsync(
      { ...base, type: REFRESH_TOKEN_TYPE },
      {
        secret: config.jwtAccessSecret,
        expiresIn: '15m',
        issuer: AUTH_ISSUER,
        audience: AUTH_AUDIENCE,
      },
    );
    await request(app.getHttpServer())
      .get('/api/v1/admin/auth/me')
      .set('Authorization', `Bearer ${expired}`)
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/admin/auth/me')
      .set('Authorization', `Bearer ${wrongType}`)
      .expect(401);
    const inactive = await createUser('me-inactive');
    const login = await request(app.getHttpServer())
      .post('/api/v1/admin/auth/login')
      .send({ email: inactive.email, password })
      .expect(200);
    await prisma.user.update({
      where: { id: inactive.id },
      data: { status: 'INACTIVE' },
    });
    await request(app.getHttpServer())
      .get('/api/v1/admin/auth/me')
      .set(
        'Authorization',
        `Bearer ${dataOf(bodyOf(login)).accessToken as string}`,
      )
      .expect(401);
  });

  it('rejects missing, expired, revoked, and replayed refresh cookies', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/auth/refresh')
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/admin/auth/refresh')
      .set('Cookie', 'universta_admin_refresh=invalid')
      .expect(401);
  });

  it('validates only active persisted refresh sessions without rotating them', async () => {
    const user = testUsers[0];
    const login = await request(app.getHttpServer())
      .post('/api/v1/admin/auth/login')
      .send({ email: user.email, password })
      .expect(200);
    const cookie = cookieValue(login);

    await request(app.getHttpServer())
      .post('/api/v1/admin/auth/session/validate')
      .set('Cookie', cookie)
      .expect(200)
      .expect((response) =>
        expect(dataOf(bodyOf(response)).user).toMatchObject({ id: user.id }),
      );
    await request(app.getHttpServer())
      .post('/api/v1/admin/auth/session/validate')
      .set('Cookie', 'universta_admin_refresh=malformed')
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/v1/admin/auth/logout')
      .set('Cookie', cookie)
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/v1/admin/auth/session/validate')
      .set('Cookie', cookie)
      .expect(401);
  });

  it('rejects expired and wrong-signature refresh tokens during server-session validation', async () => {
    const jwt = app.get(JwtService);
    const config = app.get(RuntimeConfigService);
    const expired = await jwt.signAsync(
      {
        sub: testUsers[0].id,
        jti: 'expired-session',
        type: REFRESH_TOKEN_TYPE,
      },
      {
        secret: config.jwtRefreshSecret,
        expiresIn: -1,
        issuer: AUTH_ISSUER,
        audience: AUTH_AUDIENCE,
      },
    );
    await request(app.getHttpServer())
      .post('/api/v1/admin/auth/session/validate')
      .set('Cookie', `universta_admin_refresh=${expired}`)
      .expect(401);
    const wrongSignature = await jwt.signAsync(
      {
        sub: testUsers[0].id,
        jti: 'wrong-signature',
        type: REFRESH_TOKEN_TYPE,
      },
      {
        secret: 'not-the-authoritative-refresh-secret',
        expiresIn: '15m',
        issuer: AUTH_ISSUER,
        audience: AUTH_AUDIENCE,
      },
    );
    await request(app.getHttpServer())
      .post('/api/v1/admin/auth/session/validate')
      .set('Cookie', `universta_admin_refresh=${wrongSignature}`)
      .expect(401);
  });
});
