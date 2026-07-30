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

describe('Location hierarchy — states and cities (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  const suffix = randomUUID().slice(0, 8);
  const countrySlug = `locations-e2e-${suffix}`;
  let countryId = '';
  let stateId = '';
  let cityId = '';

  const admin = (method: 'get' | 'post' | 'patch' | 'delete', path: string) =>
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

    const continent = await prisma.continent.findFirst({
      where: { deletedAt: null },
    });
    if (!continent) throw new Error('A continent fixture is required');
    const country = await prisma.country.create({
      data: {
        continentId: continent.id,
        name: `Locations E2E Country ${suffix}`,
        pageHeading: `Study in Locations E2E Country ${suffix}`,
        slug: countrySlug,
        shortDescription:
          'Fictional country used only for location hierarchy e2e coverage.',
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
    countryId = country.id;
  });

  afterAll(async () => {
    if (cityId) await prisma.city.deleteMany({ where: { id: cityId } });
    if (stateId) await prisma.state.deleteMany({ where: { id: stateId } });
    if (countryId)
      await prisma.country.deleteMany({ where: { id: countryId } });
    await app.close();
  });

  it('rejects a state targeting a nonexistent country', async () => {
    await admin('post', '/api/v1/admin/states')
      .send({ countryId: randomUUID(), name: 'Ghost State' })
      .expect(400);
  });

  it('creates a state under the fictional country', async () => {
    const response = await admin('post', '/api/v1/admin/states')
      .send({ countryId, name: 'Test Province', status: 'PUBLISHED' })
      .expect(201);
    stateId = String(data(response).id);
    expect(data(response).slug).toBe('test-province');
  });

  it('rejects a duplicate state slug within the same country', async () => {
    await admin('post', '/api/v1/admin/states')
      .send({ countryId, name: 'Test Province' })
      .expect(409);
  });

  it('creates a city under the state', async () => {
    const response = await admin('post', '/api/v1/admin/cities')
      .send({
        countryId,
        stateId,
        name: 'Test City',
        shortDescription: 'A fictional city used only for e2e coverage.',
        status: 'PUBLISHED',
      })
      .expect(201);
    cityId = String(data(response).id);
    expect(data(response).slug).toBe('test-city');
  });

  it('rejects a city whose state does not belong to its country', async () => {
    const otherContinent = await prisma.continent.findFirst({
      where: { deletedAt: null },
    });
    const otherCountry = await prisma.country.create({
      data: {
        continentId: otherContinent!.id,
        name: `Locations E2E Other ${suffix}`,
        pageHeading: `Other ${suffix}`,
        slug: `locations-e2e-other-${suffix}`,
        shortDescription:
          'Second fictional country for cross-country validation.',
        status: 'PUBLISHED',
      },
    });
    await admin('post', '/api/v1/admin/cities')
      .send({ countryId: otherCountry.id, stateId, name: 'Mismatched City' })
      .expect(400);
    await prisma.country.deleteMany({ where: { id: otherCountry.id } });
  });

  it('is not publicly visible while DRAFT', async () => {
    const draft = await admin('post', '/api/v1/admin/cities')
      .send({ countryId, name: 'Draft City' })
      .expect(201);
    const response = await request(app.getHttpServer()).get(
      `/api/v1/phase1/countries/${countrySlug}/cities/draft-city`,
    );
    expect(data(response)).toEqual({});
    await prisma.city.deleteMany({ where: { id: String(data(draft).id) } });
  });

  it('lists the published city under its country', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/phase1/countries/${countrySlug}/cities`)
      .expect(200);
    const rows = arrayData(response);
    expect(rows.some((row) => row.slug === 'test-city')).toBe(true);
  });

  it('filters the city list by state slug', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/phase1/countries/${countrySlug}/cities?state=test-province`)
      .expect(200);
    const rows = arrayData(response);
    expect(rows.length).toBeGreaterThan(0);
    expect(
      rows.every((row) => (row.state as RecordValue)?.slug === 'test-province'),
    ).toBe(true);
  });

  it('returns the published city detail with its country and state', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/phase1/countries/${countrySlug}/cities/test-city`)
      .expect(200);
    const city = data(response);
    expect(city.name).toBe('Test City');
    expect((city.state as RecordValue)?.name).toBe('Test Province');
    expect((city.country as RecordValue)?.slug).toBe(countrySlug);
  });

  it('saves City SEO metadata and surfaces it on both the admin detail and the public city payload', async () => {
    const saved = await admin('put', `/api/v1/admin/cities/${cityId}/seo`)
      .send({
        seoTitle: 'Test City | Universta',
        metaDescription: 'Fictional city SEO metadata for e2e coverage.',
        canonicalUrl: `/study-in-${countrySlug}/test-city`,
        ogTitle: 'Discover Test City',
        ogDescription: 'Fictional OG description for e2e coverage.',
        robotsIndex: true,
        robotsFollow: true,
      })
      .expect(200);
    expect(data(saved)).toMatchObject({
      seoTitle: 'Test City | Universta',
      ogTitle: 'Discover Test City',
    });

    const adminDetail = await admin('get', `/api/v1/admin/cities/${cityId}`).expect(
      200,
    );
    expect((data(adminDetail).seo as RecordValue)?.seoTitle).toBe(
      'Test City | Universta',
    );

    const publicDetail = await request(app.getHttpServer())
      .get(`/api/v1/phase1/countries/${countrySlug}/cities/test-city`)
      .expect(200);
    expect((data(publicDetail).seo as RecordValue)?.ogDescription).toBe(
      'Fictional OG description for e2e coverage.',
    );
  });

  it('rejects City SEO without the required fields', async () => {
    const res = await admin('put', `/api/v1/admin/cities/${cityId}/seo`).send({
      seoTitle: 'Missing description',
    });
    expect(res.status).toBe(400);
    expect(code(res)).toBe('SEO_FIELDS_REQUIRED');
  });

  it('lists published states for the country', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/phase1/countries/${countrySlug}/states`)
      .expect(200);
    const rows = arrayData(response);
    expect(rows.some((row) => row.slug === 'test-province')).toBe(true);
  });

  it('blocks archiving a state while a city still references it', async () => {
    await admin('delete', `/api/v1/admin/states/${stateId}`).expect(409);
  });

  it('archives the city, then the now-unused state', async () => {
    await admin('delete', `/api/v1/admin/cities/${cityId}`).expect(200);
    const detail = await admin('get', `/api/v1/admin/cities/${cityId}`).expect(
      404,
    );
    expect(code(detail)).toBe('CITY_NOT_FOUND');
    await admin('delete', `/api/v1/admin/states/${stateId}`).expect(200);
  });

  function code(response: { body: unknown }): string {
    const error = body(response).error;
    return record(error).code as string;
  }
});
