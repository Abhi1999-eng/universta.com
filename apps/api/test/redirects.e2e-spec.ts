import type { INestApplication } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';

type RecordValue = Record<string, unknown>;
function record(value: unknown): RecordValue {
  return value && typeof value === 'object' ? (value as RecordValue) : {};
}
function body(response: { body: unknown }): RecordValue {
  return record(response.body);
}
function data(response: { body: unknown }): RecordValue {
  return record(body(response).data);
}

describe('Slug-change redirects (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  const oldSlug = `redirect-e2e-old-${Date.now()}`;
  const newSlug = `redirect-e2e-new-${Date.now()}`;
  let jobId = '';

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = fixture.createNestApplication(new ExpressAdapter());
    configureApplication(app);
    await app.init();
    prisma = app.get(PrismaService);
    const login = await request(app.getHttpServer())
      .post('/api/v1/admin/auth/login')
      .send({
        email: process.env.SEED_ADMIN_EMAIL,
        password: process.env.SEED_ADMIN_PASSWORD,
      })
      .expect(200);
    adminToken = String(data(login).accessToken);
  });

  afterAll(async () => {
    if (jobId) await prisma.job.deleteMany({ where: { id: jobId } });
    await prisma.redirect.deleteMany({
      where: {
        sourcePath: { in: [`/careers/${oldSlug}`, `/careers/${newSlug}`] },
      },
    });
    await app.close();
  });

  function admin(method: 'get' | 'post' | 'patch' | 'delete', path: string) {
    return request(app.getHttpServer())
      [method](path)
      .set('Authorization', `Bearer ${adminToken}`);
  }

  it('creates a redirect row automatically when a resource slug changes', async () => {
    const created = await admin('post', '/api/v1/admin/phase1/jobs')
      .send({ title: 'Redirect E2E Job', slug: oldSlug, status: 'DRAFT' })
      .expect(201);
    jobId = String(data(created).id);

    await admin('patch', `/api/v1/admin/phase1/jobs/${jobId}`)
      .send({ slug: newSlug })
      .expect(200);

    const lookup = await request(app.getHttpServer())
      .get(
        `/api/v1/phase1/redirects?path=${encodeURIComponent(`/careers/${oldSlug}`)}`,
      )
      .expect(200);
    expect(data(lookup).targetPath).toBe(`/careers/${newSlug}`);
    expect(data(lookup).httpStatusCode).toBe(301);
  });

  it('returns no redirect for a path that was never renamed', async () => {
    const lookup = await request(app.getHttpServer())
      .get('/api/v1/phase1/redirects?path=/careers/never-existed-anywhere')
      .expect(200);
    expect(data(lookup)).toEqual({});
  });

  it('does not create a redirect when the slug is unchanged', async () => {
    await admin('patch', `/api/v1/admin/phase1/jobs/${jobId}`)
      .send({ slug: newSlug, summary: 'Unrelated update' })
      .expect(200);
    const count = await prisma.redirect.count({
      where: { sourcePath: `/careers/${newSlug}` },
    });
    expect(count).toBe(0);
  });
});
