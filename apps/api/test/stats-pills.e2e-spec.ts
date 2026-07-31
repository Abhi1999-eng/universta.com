import type { INestApplication } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  STATS_PILL_DEFAULTS,
  statsPillEnvelope,
} from '../src/stats-pills/stats-pill.contract';

type RecordValue = Record<string, unknown>;
const record = (value: unknown) =>
  value && typeof value === 'object' ? (value as RecordValue) : {};
const data = (response: { body: unknown }) =>
  record(record(response.body).data);

describe('CMS statistics pills (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken = '';
  let pageId = '';
  let sectionId = '';
  const slug = `stats-pill-e2e-${Date.now()}`;

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = fixture.createNestApplication(new ExpressAdapter());
    configureApplication(app);
    await app.init();
    prisma = app.get(PrismaService);
    const page = await prisma.page.create({
      data: {
        pageType: 'STATIC_PAGE',
        title: 'Stats pill E2E',
        slug,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
    pageId = page.id;
    const config = structuredClone(STATS_PILL_DEFAULTS.home);
    config.items = [
      {
        ...config.items[0],
        sourceMode: 'MANUAL',
        manualValue: 7,
        label: 'published places',
      },
    ];
    const section = await prisma.pageSection.create({
      data: {
        pageId,
        sectionKey: 'stats-pill',
        sectionType: 'STATS',
        status: 'ACTIVE',
        bodyJson: statsPillEnvelope(config) as never,
      },
    });
    sectionId = section.id;
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
    if (sectionId)
      await prisma.contentVersion.deleteMany({
        where: { resourceType: 'PAGE_SECTION', resourceId: sectionId },
      });
    if (pageId) {
      await prisma.pageSection.deleteMany({ where: { pageId } });
      await prisma.page.deleteMany({ where: { id: pageId } });
    }
    await app.close();
  });

  const admin = (method: 'get' | 'post' | 'put', path: string) =>
    request(app.getHttpServer())
      [method](path)
      .set('Authorization', `Bearer ${adminToken}`);

  it('keeps saved draft values out of the canonical public endpoint', async () => {
    const before = await request(app.getHttpServer())
      .get(`/api/v1/phase1/stats-pills/${slug}`)
      .expect(200);
    expect((data(before).items as RecordValue[])[0]).toMatchObject({
      value: 7,
      label: 'published places',
    });

    const editor = await admin(
      'get',
      `/api/v1/admin/stats-pills/${pageId}`,
    ).expect(200);
    const draft = structuredClone(data(editor).draft) as RecordValue;
    const items = draft.items as RecordValue[];
    items[0] = {
      ...items[0],
      sourceMode: 'MANUAL',
      manualValue: 99,
      label: 'draft places',
    };
    await admin('put', `/api/v1/admin/stats-pills/${pageId}/draft`)
      .send({ config: draft })
      .expect(200);

    const unchanged = await request(app.getHttpServer())
      .get(`/api/v1/phase1/stats-pills/${slug}`)
      .expect(200);
    expect((data(unchanged).items as RecordValue[])[0]).toMatchObject({
      value: 7,
      label: 'published places',
    });
  });

  it('shows the saved draft only through the scoped secure preview', async () => {
    const issued = await admin('post', '/api/v1/admin/preview-tokens')
      .send({ target: 'page', ref: slug })
      .expect(201);
    const preview = await request(app.getHttpServer())
      .get('/api/v1/phase1/preview/page')
      .query({ slug, token: data(issued).token })
      .expect(200);
    const pill = record(data(preview).statsPill);
    expect((pill.items as RecordValue[])[0]).toMatchObject({
      value: 99,
      label: 'draft places',
    });
  });

  it('publishes explicitly and rejects an invalid manual override', async () => {
    await admin('post', `/api/v1/admin/stats-pills/${pageId}/publish`).expect(
      201,
    );
    const published = await request(app.getHttpServer())
      .get(`/api/v1/phase1/stats-pills/${slug}`)
      .expect(200);
    expect((data(published).items as RecordValue[])[0]).toMatchObject({
      value: 99,
      label: 'draft places',
    });

    const editor = await admin(
      'get',
      `/api/v1/admin/stats-pills/${pageId}`,
    ).expect(200);
    const invalid = structuredClone(data(editor).draft) as RecordValue;
    (invalid.items as RecordValue[])[0].manualValue = -1;
    const rejected = await admin(
      'put',
      `/api/v1/admin/stats-pills/${pageId}/draft`,
    )
      .send({ config: invalid })
      .expect(400);
    expect(record(record(rejected.body).error).code).toBe('VALIDATION_ERROR');
  });
});
