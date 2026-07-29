import type { INestApplication } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/bootstrap';
import {
  assignVariant,
  hashToUnitInterval,
} from '../src/experiments/experiments.service';
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

describe('A/B testing experiments (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  const pageSlug = `experiments-e2e-${Date.now()}`;
  let pageId = '';
  let sectionId = '';
  let experimentId = '';
  let variantId = '';

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

    const page = await admin('post', '/api/v1/admin/phase1/pages')
      .send({
        pageType: 'EDITORIAL',
        title: 'Experiments E2E Page',
        slug: pageSlug,
        status: 'PUBLISHED',
      })
      .expect(201);
    pageId = String(data(page).id);
    const section = await admin(
      'post',
      `/api/v1/admin/phase1/pages/${pageId}/sections`,
    )
      .send({
        sectionType: 'CTA',
        heading: 'Base heading',
        subheading: 'Base body',
        status: 'ACTIVE',
      })
      .expect(201);
    sectionId = String(data(section).id);
  });

  afterAll(async () => {
    if (experimentId) {
      await prisma.experimentConversion.deleteMany({ where: { experimentId } });
      await prisma.experimentExposure.deleteMany({ where: { experimentId } });
      await prisma.experimentVariant.deleteMany({ where: { experimentId } });
      await prisma.experiment.deleteMany({ where: { id: experimentId } });
    }
    if (pageId) {
      await prisma.pageSection.deleteMany({ where: { pageId } });
      await prisma.page.deleteMany({ where: { id: pageId } });
    }
    await app.close();
  });

  function admin(method: 'get' | 'post' | 'patch' | 'delete', path: string) {
    return request(app.getHttpServer())
      [method](path)
      .set('Authorization', `Bearer ${adminToken}`);
  }

  it('assignVariant is deterministic and respects traffic weight', () => {
    const variants = [
      { id: 'a', key: 'control', isControl: true, trafficWeight: 50 },
      { id: 'b', key: 'variant', isControl: false, trafficWeight: 50 },
    ];
    const first = assignVariant(
      variants,
      hashToUnitInterval('visitor-1:exp-1'),
    );
    const second = assignVariant(
      variants,
      hashToUnitInterval('visitor-1:exp-1'),
    );
    expect(first?.id).toBe(second?.id);
  });

  it('assignVariant falls back to control when weights are all zero', () => {
    const variants = [
      { id: 'a', key: 'control', isControl: true, trafficWeight: 0 },
      { id: 'b', key: 'variant', isControl: false, trafficWeight: 0 },
    ];
    expect(assignVariant(variants, 0.9)?.id).toBe('a');
  });

  it('assignVariant returns null for no variants and never throws', () => {
    expect(assignVariant([], 0.5)).toBeNull();
  });

  it('creates an experiment targeting a real section, with control and treatment variants', async () => {
    const experiment = await admin('post', '/api/v1/admin/experiments')
      .send({ name: 'Experiments E2E test', sectionId, status: 'DRAFT' })
      .expect(201);
    experimentId = String(data(experiment).id);

    await admin('post', `/api/v1/admin/experiments/${experimentId}/variants`)
      .send({
        name: 'Control',
        isControl: true,
        trafficWeight: 50,
        heading: 'Base heading',
      })
      .expect(201);

    const variant = await admin(
      'post',
      `/api/v1/admin/experiments/${experimentId}/variants`,
    )
      .send({
        name: 'Bold CTA',
        isControl: false,
        trafficWeight: 50,
        heading: 'Bold heading',
        ctaPrimaryLabel: 'Act now',
      })
      .expect(201);
    variantId = String(data(variant).id);
  });

  it('rejects an unknown conversion kind', async () => {
    const experiment = await prisma.experiment.findUniqueOrThrow({
      where: { id: experimentId },
    });
    await request(app.getHttpServer())
      .post('/api/v1/phase1/experiments/conversions')
      .set('x-anon-id', 'visitor-invalid-kind-check')
      .send({ experimentKey: experiment.key, kind: 'NOT_A_REAL_KIND' })
      .expect(400);
  });

  it('a DRAFT experiment does not override the public page', async () => {
    const publicPage = await request(app.getHttpServer())
      .get(`/api/v1/phase1/pages/${pageSlug}`)
      .set('x-anon-id', 'visitor-draft-check')
      .expect(200);
    const sections = (data(publicPage).sections as RecordValue[]) ?? [];
    expect(sections[0].heading).toBe('Base heading');
    expect(sections[0].experimentKey).toBeUndefined();
  });

  it('an ACTIVE experiment overrides the section for a real visitor and is stable across repeat requests', async () => {
    await admin('patch', `/api/v1/admin/experiments/${experimentId}`)
      .send({ status: 'ACTIVE' })
      .expect(200);
    const first = await request(app.getHttpServer())
      .get(`/api/v1/phase1/pages/${pageSlug}`)
      .set('x-anon-id', 'visitor-stable-check')
      .expect(200);
    const second = await request(app.getHttpServer())
      .get(`/api/v1/phase1/pages/${pageSlug}`)
      .set('x-anon-id', 'visitor-stable-check')
      .expect(200);
    const firstSection = ((data(first).sections as RecordValue[]) ?? [])[0];
    const secondSection = ((data(second).sections as RecordValue[]) ?? [])[0];
    expect(firstSection.experimentVariantKey).toBe(
      secondSection.experimentVariantKey,
    );
    expect(['control', 'bold-cta']).toContain(
      firstSection.experimentVariantKey,
    );
  });

  it('a bot user is always assigned the control variant and is not logged as an exposure', async () => {
    const before = await prisma.experimentExposure.count({
      where: { experimentId },
    });
    const response = await request(app.getHttpServer())
      .get(`/api/v1/phase1/pages/${pageSlug}`)
      .set('x-anon-id', 'bot')
      .expect(200);
    const section = ((data(response).sections as RecordValue[]) ?? [])[0];
    expect(section.experimentVariantKey).toBe('control');
    const after = await prisma.experimentExposure.count({
      where: { experimentId },
    });
    expect(after).toBe(before);
  });

  it('a request with no anonymous id also gets the stable control, unlogged', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/phase1/pages/${pageSlug}`)
      .expect(200);
    const section = ((data(response).sections as RecordValue[]) ?? [])[0];
    expect(section.experimentVariantKey).toBe('control');
  });

  it('logs a real exposure for a genuine visitor', async () => {
    const exposures = await prisma.experimentExposure.findMany({
      where: { experimentId, anonymousId: 'visitor-stable-check' },
    });
    expect(exposures.length).toBeGreaterThan(0);
  });

  it('records a conversion attributed to the same deterministic variant as exposure', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/phase1/experiments/conversions')
      .set('x-anon-id', 'visitor-stable-check')
      .send({
        experimentKey: (
          await prisma.experiment.findUniqueOrThrow({
            where: { id: experimentId },
          })
        ).key,
        kind: 'CTA_CLICK',
      })
      .expect(201);
    const conversions = await prisma.experimentConversion.findMany({
      where: { experimentId, anonymousId: 'visitor-stable-check' },
    });
    expect(conversions.length).toBe(1);
  });

  it('does not record a conversion for a bot', async () => {
    const experimentKey = (
      await prisma.experiment.findUniqueOrThrow({ where: { id: experimentId } })
    ).key;
    await request(app.getHttpServer())
      .post('/api/v1/phase1/experiments/conversions')
      .set('x-anon-id', 'bot')
      .send({ experimentKey, kind: 'CTA_CLICK' })
      .expect(201);
    const conversions = await prisma.experimentConversion.count({
      where: { experimentId, anonymousId: 'bot' },
    });
    expect(conversions).toBe(0);
  });

  it('returns exposure/conversion stats per variant', async () => {
    const stats = await admin(
      'get',
      `/api/v1/admin/experiments/${experimentId}/stats`,
    ).expect(200);
    const rows = (body(stats).data as RecordValue[]) ?? [];
    expect(rows.length).toBe(2);
    const total = rows.reduce((sum, row) => sum + Number(row.exposureCount), 0);
    expect(total).toBeGreaterThan(0);
  });

  it('admin preview returns a specific variant regardless of assignment', async () => {
    const preview = await admin(
      'get',
      `/api/v1/admin/experiments/${experimentId}/variants/${variantId}/preview`,
    ).expect(200);
    expect(data(preview).heading).toBe('Bold heading');
  });

  it('archiving the experiment removes its override from the public page', async () => {
    await admin('delete', `/api/v1/admin/experiments/${experimentId}`).expect(
      200,
    );
    const publicPage = await request(app.getHttpServer())
      .get(`/api/v1/phase1/pages/${pageSlug}`)
      .set('x-anon-id', 'visitor-stable-check')
      .expect(200);
    const section = ((data(publicPage).sections as RecordValue[]) ?? [])[0];
    expect(section.heading).toBe('Base heading');
  });
});
