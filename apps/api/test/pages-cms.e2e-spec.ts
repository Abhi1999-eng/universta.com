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

describe('Phase 1 Page CMS (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  const slug = `pages-cms-e2e-${Date.now()}`;
  let pageId = '';

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

  it('creates a page with no admin editor required beyond field forms', async () => {
    const created = await admin('post', '/api/v1/admin/phase1/pages')
      .send({
        pageType: 'EDITORIAL',
        title: 'CMS E2E Page',
        slug,
        shortDescription: 'A fictional page created by the CMS e2e test.',
        status: 'DRAFT',
      })
      .expect(201);
    pageId = String(data(created).id);
    expect(pageId).toBeTruthy();
  });

  it('is not publicly visible while Draft', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/phase1/pages/${slug}`)
      .expect(404);
  });

  it('adds sections with no raw JSON required, and reorders them', async () => {
    const first = await admin(
      'post',
      `/api/v1/admin/phase1/pages/${pageId}/sections`,
    )
      .send({ sectionType: 'HERO', heading: 'First section', status: 'ACTIVE' })
      .expect(201);
    const second = await admin(
      'post',
      `/api/v1/admin/phase1/pages/${pageId}/sections`,
    )
      .send({
        sectionType: 'RICH_TEXT',
        heading: 'Second section',
        subheading: 'Body copy.',
        status: 'ACTIVE',
      })
      .expect(201);
    const firstId = String(data(first).id);
    const secondId = String(data(second).id);
    expect(data(first).displayOrder).toBe(0);
    expect(data(second).displayOrder).toBe(1);

    const reordered = await admin(
      'post',
      `/api/v1/admin/phase1/pages/${pageId}/sections/reorder`,
    )
      .send({ order: [secondId, firstId] })
      .expect(201);
    const rows = (body(reordered).data as RecordValue[]) ?? [];
    expect(rows[0].id).toBe(secondId);
    expect(rows[1].id).toBe(firstId);
  });

  it('rejects an incomplete reorder payload', async () => {
    await admin('post', `/api/v1/admin/phase1/pages/${pageId}/sections/reorder`)
      .send({ order: ['not-a-real-id'] })
      .expect(400);
  });

  it('duplicates a section as a new Draft copy', async () => {
    const detail = await admin(
      'get',
      `/api/v1/admin/phase1/pages/${pageId}`,
    ).expect(200);
    const sections = (data(detail).sections as RecordValue[]) ?? [];
    const source = sections[0];
    const duplicated = await admin(
      'post',
      `/api/v1/admin/phase1/pages/${pageId}/sections/${String(source.id)}/duplicate`,
    ).expect(201);
    expect(data(duplicated).status).toBe('DRAFT');
    expect(data(duplicated).heading).toBe(`${String(source.heading)} (copy)`);
    expect(data(duplicated).id).not.toBe(source.id);
  });

  it('archives (soft-deletes) a section and it disappears from admin detail', async () => {
    const detail = await admin(
      'get',
      `/api/v1/admin/phase1/pages/${pageId}`,
    ).expect(200);
    const sections = (data(detail).sections as RecordValue[]) ?? [];
    const toDelete = sections[sections.length - 1];
    await admin(
      'delete',
      `/api/v1/admin/phase1/pages/${pageId}/sections/${String(toDelete.id)}`,
    ).expect(200);
    const after = await admin(
      'get',
      `/api/v1/admin/phase1/pages/${pageId}`,
    ).expect(200);
    const remaining = (data(after).sections as RecordValue[]) ?? [];
    expect(remaining.some((section) => section.id === toDelete.id)).toBe(false);
  });

  it('publishes and becomes publicly visible with its active sections', async () => {
    await admin('post', `/api/v1/admin/phase1/pages/${pageId}/publish`).expect(
      201,
    );
    const publicPage = await request(app.getHttpServer())
      .get(`/api/v1/phase1/pages/${slug}`)
      .expect(200);
    expect(data(publicPage).title).toBe('CMS E2E Page');
    const sections = (data(publicPage).sections as RecordValue[]) ?? [];
    expect(sections.length).toBeGreaterThan(0);
  });

  it('respects SEO metadata round-trip through the generic seo field, including OG/Twitter/robots/schema', async () => {
    await admin('patch', `/api/v1/admin/phase1/pages/${pageId}`)
      .send({
        seo: {
          seoTitle: 'CMS E2E Page | Universta',
          metaDescription: 'A fictional meta description for the CMS e2e test.',
          ogTitle: 'CMS E2E Page — Open Graph title',
          ogDescription: 'Fictional OG description for the CMS e2e test.',
          twitterTitle: 'CMS E2E Page — Twitter title',
          twitterDescription:
            'Fictional Twitter description for the CMS e2e test.',
          robotsIndex: false,
          robotsFollow: true,
          schemaJson: { '@type': 'WebPage', name: 'CMS E2E Page' },
        },
      })
      .expect(200);
    const detail = await admin(
      'get',
      `/api/v1/admin/phase1/pages/${pageId}`,
    ).expect(200);
    const seo = record(data(detail).seo);
    expect(seo).toMatchObject({
      seoTitle: 'CMS E2E Page | Universta',
      ogTitle: 'CMS E2E Page — Open Graph title',
      twitterTitle: 'CMS E2E Page — Twitter title',
      robotsIndex: false,
      robotsFollow: true,
    });
    expect(seo.schemaJson).toMatchObject({ '@type': 'WebPage' });
  });

  it('a Scheduled page with a future startsAt is not yet publicly visible', async () => {
    const future = new Date(Date.now() + 60 * 60 * 1000);
    await admin('patch', `/api/v1/admin/phase1/pages/${pageId}`)
      .send({ status: 'SCHEDULED', startsAt: future.toISOString() })
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/phase1/pages/${slug}`)
      .expect(404);
  });

  it('a Scheduled page whose startsAt has already passed is publicly visible', async () => {
    const past = new Date(Date.now() - 60 * 60 * 1000);
    await admin('patch', `/api/v1/admin/phase1/pages/${pageId}`)
      .send({ status: 'SCHEDULED', startsAt: past.toISOString(), endsAt: null })
      .expect(200);
    const publicPage = await request(app.getHttpServer())
      .get(`/api/v1/phase1/pages/${slug}`)
      .expect(200);
    expect(data(publicPage).title).toBe('CMS E2E Page');
  });

  it('stops appearing once its endsAt has passed, with no scheduler running', async () => {
    const past = new Date(Date.now() - 1000);
    await admin('patch', `/api/v1/admin/phase1/pages/${pageId}`)
      .send({ status: 'PUBLISHED', startsAt: null, endsAt: past.toISOString() })
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/phase1/pages/${slug}`)
      .expect(404);
  });

  it('admin preview shows the page regardless of publish state', async () => {
    const preview = await admin(
      'get',
      `/api/v1/admin/phase1/pages/${pageId}/preview`,
    ).expect(200);
    expect(data(preview).title).toBe('CMS E2E Page');
  });

  it('rejects an invalid section type', async () => {
    await admin('post', `/api/v1/admin/phase1/pages/${pageId}/sections`)
      .send({ sectionType: 'NOT_A_REAL_TYPE', heading: 'Bad section' })
      .expect(400);
  });

  it('accepts every documented section type and round-trips a structured bodyJson', async () => {
    const created = await admin(
      'post',
      `/api/v1/admin/phase1/pages/${pageId}/sections`,
    )
      .send({
        sectionType: 'FAQ_GROUP',
        heading: 'Frequently asked',
        status: 'ACTIVE',
        bodyJson: {
          items: [
            { label: 'Is this fictional?', value: 'Yes, entirely.' },
            { label: 'Another question?', value: 'Another answer.' },
          ],
        },
      })
      .expect(201);
    const id = String(data(created).id);
    expect((data(created).bodyJson as RecordValue).items).toHaveLength(2);

    const detail = await admin(
      'get',
      `/api/v1/admin/phase1/pages/${pageId}`,
    ).expect(200);
    const sections = (data(detail).sections as RecordValue[]) ?? [];
    const stored = sections.find((section) => section.id === id);
    expect((stored?.bodyJson as RecordValue).items).toHaveLength(2);

    for (const sectionType of [
      'HERO',
      'CTA',
      'IMAGE',
      'IMAGE_TEXT',
      'CARD_GRID',
      'STATS',
      'RELATED_LINKS',
      'COUNTRY_DIRECTORY',
      'UNIVERSITY_DIRECTORY',
      'COURSE_DIRECTORY',
      'SCHOLARSHIP_DIRECTORY',
      'CONSULTANT_DIRECTORY',
      'TESTIMONIALS',
      'SUCCESS_STORIES',
      'LEAD_GENERATION',
    ]) {
      await admin('post', `/api/v1/admin/phase1/pages/${pageId}/sections`)
        .send({ sectionType, heading: `Block for ${sectionType}` })
        .expect(201);
    }
  });

  it('strips a stray html key from bodyJson so no raw markup can ever be persisted', async () => {
    const created = await admin(
      'post',
      `/api/v1/admin/phase1/pages/${pageId}/sections`,
    )
      .send({
        sectionType: 'RICH_TEXT',
        heading: 'Sanitization check',
        bodyJson: {
          paragraphs: ['Safe text.'],
          html: '<script>alert(1)</script>',
        },
      })
      .expect(201);
    const body = data(created).bodyJson as RecordValue;
    expect(body.paragraphs).toEqual(['Safe text.']);
    expect(body.html).toBeUndefined();
  });
});
