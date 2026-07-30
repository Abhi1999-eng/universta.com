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
function arrayData(response: { body: unknown }): RecordValue[] {
  const value = body(response).data;
  return Array.isArray(value) ? (value as RecordValue[]) : [];
}

describe('Structured internal link picker (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  const suffix = randomUUID().slice(0, 8);
  let draftCountryId = '';
  let publishedCountryId = '';
  let publishedCountrySlug = '';

  const admin = (path: string) =>
    request(app.getHttpServer())
      .get(path)
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

    const published = await prisma.country.findFirst({
      where: { status: 'PUBLISHED', deletedAt: null },
    });
    if (!published) throw new Error('A published country is required');
    publishedCountryId = published.id;
    publishedCountrySlug = published.slug;

    const continent = await prisma.continent.findFirst({
      where: { status: 'ACTIVE', deletedAt: null },
    });
    if (!continent) throw new Error('An active continent is required');
    const draft = await prisma.country.create({
      data: {
        continentId: continent.id,
        name: `Internal Link E2E Draft ${suffix}`,
        slug: `internal-link-e2e-draft-${suffix}`,
        iso2Code: 'ZZ',
        iso3Code: 'ZZZ',
        pageHeading: 'Draft',
        shortDescription: 'Draft country for internal-link e2e coverage.',
        status: 'DRAFT',
      },
    });
    draftCountryId = draft.id;
  });

  afterAll(async () => {
    if (draftCountryId)
      await prisma.country.deleteMany({ where: { id: draftCountryId } });
    await app.close();
  });

  it('rejects unauthenticated search and resolve', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/internal-links/search?q=x')
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/admin/internal-links/resolve?entityType=country&entityId=x')
      .expect(401);
  });

  it('searches across entity types and returns a canonical path', async () => {
    const res = await admin(
      `/api/v1/admin/internal-links/search?q=${encodeURIComponent(publishedCountrySlug)}&entityType=country`,
    ).expect(200);
    const rows = arrayData(res);
    const match = rows.find((row) => row.entityId === publishedCountryId);
    expect(match).toMatchObject({
      entityType: 'country',
      path: `/countries/${publishedCountrySlug}`,
    });
  });

  it('resolves a published entity with isPublished true', async () => {
    const res = await admin(
      `/api/v1/admin/internal-links/resolve?entityType=country&entityId=${publishedCountryId}`,
    ).expect(200);
    expect(data(res)).toMatchObject({
      missing: false,
      isPublished: true,
      path: `/countries/${publishedCountrySlug}`,
    });
  });

  it('resolves a draft entity with isPublished false and a warning-worthy status', async () => {
    const res = await admin(
      `/api/v1/admin/internal-links/resolve?entityType=country&entityId=${draftCountryId}`,
    ).expect(200);
    expect(data(res)).toMatchObject({
      missing: false,
      isPublished: false,
      status: 'DRAFT',
    });
  });

  it('reports a deleted/unknown entity as missing', async () => {
    const res = await admin(
      `/api/v1/admin/internal-links/resolve?entityType=country&entityId=${randomUUID()}`,
    ).expect(200);
    expect(data(res).missing).toBe(true);
  });

  it('auto-corrects the resolved path after the target is renamed', async () => {
    const before = await admin(
      `/api/v1/admin/internal-links/resolve?entityType=country&entityId=${publishedCountryId}`,
    ).expect(200);
    expect(data(before).path).toBe(`/countries/${publishedCountrySlug}`);

    const renamedSlug = `${publishedCountrySlug}-renamed-${suffix}`;
    await prisma.country.update({
      where: { id: publishedCountryId },
      data: { slug: renamedSlug },
    });
    try {
      const after = await admin(
        `/api/v1/admin/internal-links/resolve?entityType=country&entityId=${publishedCountryId}`,
      ).expect(200);
      expect(data(after).path).toBe(`/countries/${renamedSlug}`);
    } finally {
      await prisma.country.update({
        where: { id: publishedCountryId },
        data: { slug: publishedCountrySlug },
      });
    }
  });

  it('the public resolver only ever returns a path for a published target', async () => {
    const published = await request(app.getHttpServer())
      .get(
        `/api/v1/phase1/internal-links/resolve?entityType=country&entityId=${publishedCountryId}`,
      )
      .expect(200);
    expect(data(published).path).toBe(`/countries/${publishedCountrySlug}`);

    const draft = await request(app.getHttpServer())
      .get(
        `/api/v1/phase1/internal-links/resolve?entityType=country&entityId=${draftCountryId}`,
      )
      .expect(200);
    expect(data(draft).path).toBeNull();
  });
});
