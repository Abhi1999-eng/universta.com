import { jest } from '@jest/globals';
import { ExpressAdapter } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/bootstrap';
import { Prisma } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordService } from '../src/auth/password.service';

/**
 * Reproduces the deployed Admin sign-in failure.
 *
 * With the database unreachable, `AuthService.login` rejected on its very
 * first statement -- `prisma.user.findUnique` -- long before any password was
 * verified. That rejection is not an HttpException, so the API answered 500
 * INTERNAL_ERROR, and the Admin BFF (which allows the API 5s) had already
 * given up by then and reported AUTH_SERVICE_UNAVAILABLE. An operator saw
 * "Authentication is temporarily unavailable" with nothing anywhere naming
 * the database.
 *
 * The three outcomes below must stay distinguishable: a good password, a bad
 * password, and a database that is not there.
 */
describe('Admin login while the database is unavailable (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let passwordService: PasswordService;
  const password = 'db-outage-test-password';
  let userId = '';
  let email = '';

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication(new ExpressAdapter());
    configureApplication(app);
    await app.init();
    prisma = app.get(PrismaService);
    passwordService = app.get(PasswordService);

    email = `db-outage-${Date.now()}@example.invalid`;
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: passwordService.hash(password),
        firstName: 'Outage',
        lastName: 'Probe',
        status: 'ACTIVE',
      },
    });
    userId = user.id;
    const role = await prisma.role.findUniqueOrThrow({
      where: { code: 'SUPER_ADMIN' },
    });
    await prisma.userRole.create({ data: { userId, roleId: role.id } });
  });

  afterAll(async () => {
    if (userId) {
      await prisma.auditLog.deleteMany({ where: { userId } });
      await prisma.loginAttempt.deleteMany({ where: { userId } });
      await prisma.refreshToken.deleteMany({ where: { userId } });
      await prisma.userRole.deleteMany({ where: { userId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    await app.close();
  });

  it('signs a valid administrator in', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/auth/login')
      .send({ email, password })
      .expect(200);
    const data = (response.body as { data: Record<string, unknown> }).data;
    expect(typeof data.accessToken).toBe('string');
    expect(data.user).toMatchObject({ id: userId, roles: ['SUPER_ADMIN'] });
  });

  it('reports a wrong password as INVALID_CREDENTIALS, not an outage', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/auth/login')
      .send({ email, password: `${password}-wrong` })
      .expect(401);
    const error = (response.body as { error: { code: string } }).error;
    expect(error.code).toBe('INVALID_CREDENTIALS');
  });

  it('reports an unreachable database as 503 DATABASE_UNAVAILABLE', async () => {
    // The exact rejection the MariaDB pool produces once it gives up:
    // Prisma code P2039 carrying mariadb errno 45028.
    const outage = new Prisma.PrismaClientKnownRequestError(
      'Invalid `prisma.user.findUnique()` invocation\nDatabase error. Code: `45028`. Message: `retrieve connection from pool timeout`',
      { code: 'P2039', clientVersion: Prisma.prismaVersion.client },
    );
    const findUnique = jest
      .spyOn(prisma.user, 'findUnique')
      .mockRejectedValue(outage);
    try {
      const response = await request(app.getHttpServer())
        .post('/api/v1/admin/auth/login')
        .send({ email, password })
        .expect(503);
      const body = response.body as {
        error: { code: string; message: string };
        requestId: string;
      };
      expect(body.error.code).toBe('DATABASE_UNAVAILABLE');
      expect(body.error.message).toBe('Database is temporarily unavailable');
      // The operator needs the id to find the matching log line.
      expect(typeof body.requestId).toBe('string');
      expect(response.headers['x-request-id']).toBe(body.requestId);
    } finally {
      findUnique.mockRestore();
    }
  });

  it('reports the database as down on the health endpoint', async () => {
    const queryRaw = jest
      .spyOn(prisma, '$queryRaw')
      .mockRejectedValue(new Error('connect ECONNREFUSED'));
    try {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(503);
      expect(response.body).toMatchObject({
        status: 'degraded',
        database: 'down',
      });
    } finally {
      queryRaw.mockRestore();
    }
  });
});
