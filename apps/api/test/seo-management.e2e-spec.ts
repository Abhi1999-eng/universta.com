import type { INestApplication } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}
function data(response: { body: unknown }) {
  return record(record(response.body).data);
}
function code(response: { body: unknown }) {
  const value = record(record(response.body).error).code;
  return typeof value === 'string' ? value : '';
}

describe('SEO Management V1 (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken = '';
  let jobId = '';
  let originalJobTemplate: {
    seoTitleTemplate: string | null;
    metaDescriptionTemplate: string | null;
    ogTitleTemplate: string | null;
    ogDescriptionTemplate: string | null;
    canonicalTemplate: string | null;
    robotsIndex: boolean | null;
    robotsFollow: boolean | null;
  } | null = null;
  let originalVerification: {
    settingGroup: string;
    valueType: string;
    valueJson: unknown;
    description: string | null;
    isPublic: boolean;
    updatedByUserId: string | null;
  } | null = null;
  const suffix = randomUUID().slice(0, 8);
  const jobSlug = `seo-management-job-${suffix}`;
  const admin = (method: 'get' | 'post' | 'put', path: string) =>
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
    originalJobTemplate = await prisma.seoBulkTemplate.findUnique({
      where: { entityType: 'job' },
      select: {
        seoTitleTemplate: true,
        metaDescriptionTemplate: true,
        ogTitleTemplate: true,
        ogDescriptionTemplate: true,
        canonicalTemplate: true,
        robotsIndex: true,
        robotsFollow: true,
      },
    });
    originalVerification = await prisma.siteSetting.findUnique({
      where: { settingKey: 'seo-site-verification' },
      select: {
        settingGroup: true,
        valueType: true,
        valueJson: true,
        description: true,
        isPublic: true,
        updatedByUserId: true,
      },
    });
    const job = await prisma.job.create({
      data: {
        title: `SEO Management Job ${suffix}`,
        slug: jobSlug,
        summary: 'Fictional record for SEO Management API coverage.',
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
    jobId = job.id;
  });

  afterAll(async () => {
    if (jobId) await prisma.job.deleteMany({ where: { id: jobId } });
    if (originalJobTemplate)
      await prisma.seoBulkTemplate.upsert({
        where: { entityType: 'job' },
        create: { entityType: 'job', ...originalJobTemplate },
        update: originalJobTemplate,
      });
    else
      await prisma.seoBulkTemplate.deleteMany({ where: { entityType: 'job' } });
    if (originalVerification)
      await prisma.siteSetting.upsert({
        where: { settingKey: 'seo-site-verification' },
        create: {
          settingKey: 'seo-site-verification',
          ...originalVerification,
        } as any,
        update: originalVerification as any,
      });
    else
      await prisma.siteSetting.deleteMany({
        where: { settingKey: 'seo-site-verification' },
      });
    await app.close();
  });

  it('requires an authenticated Super Admin for configuration', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/seo-management/templates')
      .expect(401);
  });

  it('lists supported entities, rejects invalid variables, saves a template and resolves it publicly', async () => {
    const templates = await admin(
      'get',
      '/api/v1/admin/seo-management/templates',
    ).expect(200);
    expect(record(templates.body).data).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: 'job' })]),
    );
    const invalid = await admin(
      'put',
      '/api/v1/admin/seo-management/templates/job',
    )
      .send({ seoTitleTemplate: '{notAllowed}' })
      .expect(400);
    expect(code(invalid)).toBe('INVALID_SEO_TEMPLATE');
    await admin('put', '/api/v1/admin/seo-management/templates/job')
      .send({
        seoTitleTemplate: 'Apply for {jobTitle}',
        metaDescriptionTemplate:
          'Find {jobTitle} opportunities with Universta.',
        canonicalTemplate: '/careers/{jobSlug}',
        robotsIndex: true,
        robotsFollow: true,
      })
      .expect(200);
    const publicResponse = await request(app.getHttpServer())
      .get(`/api/v1/phase1/jobs/${jobSlug}`)
      .expect(200);
    expect(record(data(publicResponse).seo)).toMatchObject({
      seoTitle: `Apply for SEO Management Job ${suffix}`,
      canonicalUrl: `/careers/${jobSlug}`,
      source: { title: 'bulk', description: 'bulk' },
    });
  });

  it('stores a token-only Google verification value and renders the public configuration', async () => {
    const token = `google_verify_${suffix}`;
    await admin('put', '/api/v1/admin/seo-management/site-verification')
      .send({ google: token })
      .expect(200);
    const publicResponse = await request(app.getHttpServer())
      .get('/api/v1/phase1/seo-management/site-verification')
      .expect(200);
    expect(data(publicResponse)).toEqual({ google: token });
    const invalid = await admin(
      'put',
      '/api/v1/admin/seo-management/site-verification',
    )
      .send({ google: '<meta name="google-site-verification">' })
      .expect(400);
    expect(code(invalid)).toBe('INVALID_SITE_VERIFICATION_TOKEN');
  });
});
