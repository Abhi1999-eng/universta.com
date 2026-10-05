import { ExpressAdapter } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * The admin's university and course editors open on the values the SEO
 * resolver fills in -- the record's name, the site's default description --
 * and saving the form stored them as though an editor had written them.
 * The public course page then kept a bare "MSc Computer Science" tab title
 * and the site-wide description.
 *
 * Checked through the public endpoints the pages read, against a real
 * database: a stored value that only repeats a default is reported as the
 * default it repeats, and one an editor wrote is still reported as theirs.
 */
function record(response: { body: unknown }): Record<string, unknown> {
  const value = (response.body as { data?: unknown } | null)?.data;
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

describe('stored SEO that only repeats the defaults (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token = '';
  const stamp = `${Date.now()}-${randomUUID().slice(0, 6)}`;
  const slug = (label: string) => `use-${label}-${stamp}`;
  const universityName = `USE University ${stamp}`;
  const offeringName = `USE Offering ${stamp}`;
  let universityId = '';
  let offeringId = '';
  let siteDescription = '';

  const admin = (
    method: 'get' | 'post',
    path: string,
    payload?: Record<string, unknown>,
  ) => {
    const call = request(app.getHttpServer())
      [method](path)
      .set('Authorization', `Bearer ${token}`)
      .set('x-request-id', 'university-seo-echo-e2e');
    return payload ? call.send(payload) : call;
  };

  async function created(call: request.Test) {
    const response = await call;
    if (response.status !== 201)
      throw new Error(
        `Expected 201, got ${response.status}: ${JSON.stringify(response.body)}`,
      );
    return String(record(response).id);
  }

  async function store(
    ownerType: 'universities' | 'offerings',
    ownerId: string,
    values: { seoTitle: string; metaDescription: string },
  ) {
    await prisma.seoMetadata.upsert({
      where: { ownerType_ownerId: { ownerType, ownerId } },
      create: { ownerType, ownerId, ...values },
      update: values,
    });
  }

  const universitySeo = async () =>
    record(
      await request(app.getHttpServer())
        .get(`/api/v1/phase1/universities/${slug('university')}`)
        .expect(200),
    ).seo as Record<string, unknown>;
  const offeringSeo = async () =>
    record(
      await request(app.getHttpServer())
        .get(
          `/api/v1/phase1/universities/${slug('university')}/courses/${slug('offering')}`,
        )
        .expect(200),
    ).seo as Record<string, unknown>;

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = fixture.createNestApplication(new ExpressAdapter());
    configureApplication(app);
    await app.init();
    prisma = app.get(PrismaService);

    const password =
      process.env.SEED_ADMIN_PASSWORD ?? process.env.SUPER_ADMIN_PASSWORD;
    if (!password) throw new Error('A local Super Admin password is required');
    const login = await request(app.getHttpServer())
      .post('/api/v1/admin/auth/login')
      .send({
        email: process.env.SEED_ADMIN_EMAIL ?? 'admin@universta.local',
        password,
      })
      .expect(200);
    token = String(record(login).accessToken);

    const defaults = record(
      await request(app.getHttpServer())
        .get('/api/v1/phase1/seo-management/defaults')
        .expect(200),
    );
    siteDescription =
      typeof defaults.defaultDescription === 'string'
        ? defaults.defaultDescription
        : '';

    const continentId = (
      await prisma.continent.findFirstOrThrow({
        where: { status: 'ACTIVE', deletedAt: null },
      })
    ).id;
    const courseLevelId = (
      await prisma.courseLevel.findFirstOrThrow({ where: { status: 'ACTIVE' } })
    ).id;
    const countryId = await created(
      admin('post', '/api/v1/admin/countries', {
        continentId,
        name: `USE ${stamp}`,
        slug: slug('country'),
        pageHeading: 'Study in USE',
        shortDescription: 'SEO echo fixture',
      }),
    );
    await admin('post', `/api/v1/admin/countries/${countryId}/publish`, {});
    const subjectId = await created(
      admin('post', '/api/v1/admin/subjects', {
        name: `USE Subject ${stamp}`,
        slug: slug('subject'),
        shortDescription: 'SEO echo fixture subject',
      }),
    );
    const courseId = await created(
      admin('post', '/api/v1/admin/courses', {
        subjectId,
        courseLevelId,
        name: `USE Course ${stamp}`,
        slug: slug('course'),
        shortDescription: 'SEO echo fixture course',
      }),
    );
    universityId = await created(
      admin('post', '/api/v1/admin/phase1/universities', {
        countryId,
        name: universityName,
        slug: slug('university'),
        shortDescription: 'SEO echo fixture university',
      }),
    );
    await admin(
      'post',
      `/api/v1/admin/phase1/universities/${universityId}/publish`,
      {},
    ).expect(201);
    offeringId = await created(
      admin('post', '/api/v1/admin/phase1/offerings', {
        universityId,
        genericCourseId: courseId,
        name: offeringName,
        slug: slug('offering'),
      }),
    );
    await admin(
      'post',
      `/api/v1/admin/phase1/offerings/${offeringId}/publish`,
      {},
    ).expect(201);
  });

  afterAll(async () => {
    if (prisma)
      await prisma.seoMetadata.deleteMany({
        where: { ownerId: { in: [universityId, offeringId].filter(Boolean) } },
      });
    await app?.close();
  });

  it('reports a course’s saved-back defaults as the defaults they are', async () => {
    expect(siteDescription).not.toBe('');
    await store('offerings', offeringId, {
      seoTitle: offeringName,
      metaDescription: siteDescription,
    });
    expect(await offeringSeo()).toMatchObject({
      seoTitle: offeringName,
      metaDescription: siteDescription,
      source: { title: 'fallback', description: 'default' },
    });
  });

  it('reports a university’s saved-back defaults the same way', async () => {
    await store('universities', universityId, {
      seoTitle: universityName,
      metaDescription: siteDescription,
    });
    expect(await universitySeo()).toMatchObject({
      source: { title: 'fallback', description: 'default' },
    });
  });

  it('keeps what an editor wrote as written', async () => {
    await store('offerings', offeringId, {
      seoTitle: `${offeringName}, taught in English`,
      metaDescription: 'An editor’s own description.',
    });
    expect(await offeringSeo()).toMatchObject({
      seoTitle: `${offeringName}, taught in English`,
      metaDescription: 'An editor’s own description.',
      source: { title: 'manual', description: 'manual' },
    });
  });
});
