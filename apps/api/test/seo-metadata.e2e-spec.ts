import type { INestApplication } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
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

describe('Public detail endpoints surface admin-configured SeoMetadata (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  const suffix = randomUUID().slice(0, 8);
  let jobId = '';
  const jobSlug = `seo-e2e-job-${suffix}`;

  const admin = (
    method: 'get' | 'post' | 'patch' | 'put' | 'delete',
    path: string,
  ) =>
    request(app.getHttpServer())
      [method](path)
      .set('Authorization', `Bearer ${adminToken}`);

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

    const created = await admin('post', '/api/v1/admin/phase1/jobs')
      .send({
        title: `SEO E2E Job ${suffix}`,
        slug: jobSlug,
        summary: 'Fictional demo job used only for SEO metadata e2e coverage.',
        status: 'PUBLISHED',
      })
      .expect(201);
    jobId = String(data(created).id);
  });

  afterAll(async () => {
    if (jobId) await prisma.job.deleteMany({ where: { id: jobId } });
    await app.close();
  });

  it('returns the admin-configured seo fields on the public detail response', async () => {
    await admin('patch', `/api/v1/admin/phase1/jobs/${jobId}`)
      .send({
        seo: {
          seoTitle: 'Custom SEO title for e2e job',
          metaDescription: 'Custom SEO description for e2e job.',
          canonicalUrl: `/careers/${jobSlug}-canonical`,
          robotsIndex: false,
          robotsFollow: false,
        },
      })
      .expect(200);

    const publicResponse = await request(app.getHttpServer())
      .get(`/api/v1/phase1/jobs/${jobSlug}`)
      .expect(200);
    const seo = record(data(publicResponse).seo);
    expect(seo.seoTitle).toBe('Custom SEO title for e2e job');
    expect(seo.metaDescription).toBe('Custom SEO description for e2e job.');
    expect(seo.canonicalUrl).toBe(`/careers/${jobSlug}-canonical`);
    expect(seo.robotsIndex).toBe(false);
    expect(seo.robotsFollow).toBe(false);
  });

  it('returns the safe default resolver output when no manual SEO is configured', async () => {
    const other = await admin('post', '/api/v1/admin/phase1/jobs')
      .send({
        title: `SEO E2E Job No Seo ${suffix}`,
        slug: `seo-e2e-job-no-seo-${suffix}`,
        summary: 'Fictional demo job used only for SEO metadata e2e coverage.',
        status: 'PUBLISHED',
      })
      .expect(201);
    const otherId = String(data(other).id);
    const publicResponse = await request(app.getHttpServer())
      .get(`/api/v1/phase1/jobs/seo-e2e-job-no-seo-${suffix}`)
      .expect(200);
    const seo = record(data(publicResponse).seo);
    expect(seo.seoTitle).toBe(`SEO E2E Job No Seo ${suffix}`);
    expect(seo.metaDescription).toBeTruthy();
    expect(record(seo.source).title).toBe('fallback');
    await prisma.job.deleteMany({ where: { id: otherId } });
  });
});
