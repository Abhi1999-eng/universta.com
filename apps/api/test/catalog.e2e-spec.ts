import { ExpressAdapter } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';

type Json = Record<string, unknown>;
const suffix = `task004-${Date.now()}`;
const codeSeed = randomUUID()
  .replace(/[^a-f]/gi, '')
  .toUpperCase()
  .padEnd(6, 'A');
const iso2 = codeSeed.slice(0, 2);
const iso3 = codeSeed.slice(0, 3);
const duplicateIso2 = codeSeed.slice(2, 4);
const duplicateIso3 = codeSeed.slice(3, 6);

function body(response: { body: unknown }): Json {
  return response.body && typeof response.body === 'object'
    ? (response.body as Json)
    : {};
}
function data(response: { body: unknown }): Json {
  const value = body(response).data;
  return value && typeof value === 'object' ? (value as Json) : {};
}
function errorCode(response: { body: unknown }): string {
  const value = body(response).error;
  return value &&
    typeof value === 'object' &&
    typeof (value as Json).code === 'string'
    ? ((value as Json).code as string)
    : '';
}

describe('catalog core (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token = '';
  let continentId = '';
  const countryIds: string[] = [];

  function admin(
    method: 'get' | 'post' | 'patch' | 'delete',
    path: string,
    payload?: Json,
  ) {
    const call = request(app.getHttpServer())
      [method](path)
      .set('Authorization', `Bearer ${token}`)
      .set('x-request-id', 'task004-e2e');
    return payload ? call.send(payload) : call;
  }

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = fixture.createNestApplication(new ExpressAdapter());
    configureApplication(app);
    await app.init();
    prisma = app.get(PrismaService);
    const email =
      process.env.SEED_ADMIN_EMAIL ??
      process.env.SUPER_ADMIN_EMAIL ??
      'admin@universta.local';
    const password =
      process.env.SEED_ADMIN_PASSWORD ?? process.env.SUPER_ADMIN_PASSWORD;
    if (!password)
      throw new Error(
        'A local Super Admin password is required for catalog E2E',
      );
    const login = await request(app.getHttpServer())
      .post('/api/v1/admin/auth/login')
      .send({ email, password })
      .expect(200);
    token = String(data(login).accessToken);
  });

  afterAll(async () => {
    for (const id of countryIds) {
      await admin('delete', `/api/v1/admin/countries/${id}`, {}).catch(
        () => undefined,
      );
    }
    if (continentId)
      await admin(
        'delete',
        `/api/v1/admin/continents/${continentId}`,
        {},
      ).catch(() => undefined);
    await app.close();
  });

  it('returns public active continents and request IDs', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/continents')
      .expect(200);
    expect(Array.isArray(data(response))).toBe(true);
    expect(response.headers['x-request-id']).toBe(body(response).requestId);
    expect(body(response).error).toBeNull();
  });

  it('protects both admin catalog lists and rejects invalid sort input', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/continents')
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/admin/countries')
      .expect(401);
    const response = await admin(
      'get',
      '/api/v1/admin/countries?sort=createdAt%20desc',
    );
    expect(response.status).toBe(400);
    expect(errorCode(response)).toBe('VALIDATION_ERROR');
  });

  it('creates a continent, rejects its name conflict, and lists it for admins', async () => {
    const create = await admin('post', '/api/v1/admin/continents', {
      name: `Task Region ${suffix}`,
      code: `T${String(Date.now()).slice(-3)}`,
      displayOrder: 99,
    }).expect(201);
    continentId = String(data(create).id);
    expect(data(create)).toMatchObject({
      name: `Task Region ${suffix}`,
      status: 'ACTIVE',
      countriesCount: 0,
    });
    const conflict = await admin('post', '/api/v1/admin/continents', {
      name: `Task Region ${suffix}`,
    });
    expect(conflict.status).toBe(409);
    expect(errorCode(conflict)).toBe('CONTINENT_NAME_CONFLICT');
    const list = await admin(
      'get',
      `/api/v1/admin/continents?q=${encodeURIComponent(suffix)}`,
    ).expect(200);
    expect((data(list) as unknown[]).length).toBeGreaterThan(0);
  });

  it('updates a continent and rejects a stale timestamp', async () => {
    const current = await admin(
      'get',
      `/api/v1/admin/continents/${continentId}`,
    ).expect(200);
    const record = data(current);
    const update = await admin(
      'patch',
      `/api/v1/admin/continents/${continentId}`,
      { name: `Updated Region ${suffix}`, expectedUpdatedAt: record.updatedAt },
    ).expect(200);
    expect(data(update).name).toBe(`Updated Region ${suffix}`);
    const stale = await admin(
      'patch',
      `/api/v1/admin/continents/${continentId}`,
      { name: `Stale Region ${suffix}`, expectedUpdatedAt: record.updatedAt },
    );
    expect(stale.status).toBe(409);
    expect(errorCode(stale)).toBe('CONTINENT_STALE_VERSION');
  });

  it('rejects an invalid continent and creates a draft country with safe core fields', async () => {
    const invalid = await admin('post', '/api/v1/admin/countries', {
      continentId: '00000000-0000-0000-0000-000000000000',
      name: `Invalid ${suffix}`,
      pageHeading: 'Invalid',
      shortDescription: 'Invalid',
    });
    expect(invalid.status).toBe(409);
    expect(errorCode(invalid)).toBe('COUNTRY_CONTINENT_INVALID');
    const create = await admin('post', '/api/v1/admin/countries', {
      continentId,
      name: `Country ${suffix}`,
      slug: `country-${suffix}`,
      iso2Code: iso2,
      iso3Code: iso3,
      pageHeading: `Study in ${suffix}`,
      shortDescription: 'A test-only core country record.',
      displayOrder: 1,
    }).expect(201);
    const country = data(create);
    countryIds.push(String(country.id));
    expect(country).toMatchObject({
      status: 'DRAFT',
      iso2Code: iso2,
      iso3Code: iso3,
    });
  });

  it('rejects duplicate country slug and stale country updates', async () => {
    const current = await admin(
      'get',
      `/api/v1/admin/countries/${countryIds[0]}`,
    ).expect(200);
    const record = data(current);
    const duplicate = await admin('post', '/api/v1/admin/countries', {
      continentId,
      name: `Duplicate ${suffix}`,
      slug: record.slug,
      iso2Code: duplicateIso2,
      iso3Code: duplicateIso3,
      pageHeading: 'Duplicate',
      shortDescription: 'Duplicate test',
    });
    expect(duplicate.status).toBe(409);
    expect(errorCode(duplicate)).toBe('COUNTRY_SLUG_CONFLICT');
    const update = await admin(
      'patch',
      `/api/v1/admin/countries/${countryIds[0]}`,
      {
        continentId,
        name: `Edited ${suffix}`,
        slug: record.slug,
        iso2Code: iso2,
        iso3Code: iso3,
        pageHeading: 'Edited',
        shortDescription: 'Edited test',
        expectedUpdatedAt: record.updatedAt,
      },
    ).expect(200);
    expect(data(update).name).toBe(`Edited ${suffix}`);
    const stale = await admin(
      'patch',
      `/api/v1/admin/countries/${countryIds[0]}`,
      {
        continentId,
        name: `Stale ${suffix}`,
        pageHeading: 'Stale',
        shortDescription: 'Stale',
        iso2Code: iso2,
        iso3Code: iso3,
        expectedUpdatedAt: record.updatedAt,
      },
    );
    expect(stale.status).toBe(409);
    expect(errorCode(stale)).toBe('COUNTRY_STALE_VERSION');
  });

  it('publishes readiness failures, then exposes the published country publicly', async () => {
    const incomplete = await admin('post', '/api/v1/admin/countries', {
      continentId,
      name: `Incomplete ${suffix}`,
      slug: `incomplete-${suffix}`,
      pageHeading: 'Incomplete',
      shortDescription: 'Needs ISO fields',
    }).expect(201);
    const incompleteId = String(data(incomplete).id);
    countryIds.push(incompleteId);
    const readiness = await admin(
      'post',
      `/api/v1/admin/countries/${incompleteId}/publish`,
      { expectedUpdatedAt: data(incomplete).updatedAt },
    );
    expect(readiness.status).toBe(422);
    expect(errorCode(readiness)).toBe('COUNTRY_NOT_READY');
    const current = await admin(
      'get',
      `/api/v1/admin/countries/${countryIds[0]}`,
    ).expect(200);
    const publish = await admin(
      'post',
      `/api/v1/admin/countries/${countryIds[0]}/publish`,
      { expectedUpdatedAt: data(current).updatedAt },
    ).expect(201);
    expect(data(publish).status).toBe('PUBLISHED');
    const publishContinent = data(publish).continent as Json;
    const publicList = await request(app.getHttpServer())
      .get(
        `/api/v1/countries?continent=${encodeURIComponent(String(publishContinent.slug))}&q=${encodeURIComponent(String(data(publish).name))}`,
      )
      .expect(200);
    expect(
      (data(publicList) as unknown[]).map((item) => (item as Json).id),
    ).toContain(countryIds[0]);
    const detail = await request(app.getHttpServer())
      .get(`/api/v1/countries/${String(data(publish).slug)}`)
      .expect(200);
    expect(data(detail)).toMatchObject({ id: countryIds[0] });
    const suggestions = await request(app.getHttpServer())
      .get(
        `/api/v1/countries/suggestions?q=${encodeURIComponent(String(data(publish).name).slice(0, 4))}&limit=10`,
      )
      .expect(200);
    expect((data(suggestions) as unknown[]).length).toBeLessThanOrEqual(10);
    const directory = await request(app.getHttpServer())
      .get(
        `/api/v1/countries/directory?letter=${String(data(publish).name).slice(0, 1)}`,
      )
      .expect(200);
    expect(body(directory).meta).toMatchObject({ page: 1 });
  });

  it('returns public 404 for draft records and unpublishing removes visibility', async () => {
    const draft = await request(app.getHttpServer()).get(
      `/api/v1/countries/${`incomplete-${suffix}`}`,
    );
    expect(draft.status).toBe(404);
    const current = await admin(
      'get',
      `/api/v1/admin/countries/${countryIds[0]}`,
    ).expect(200);
    const unpublished = await admin(
      'post',
      `/api/v1/admin/countries/${countryIds[0]}/unpublish`,
      { expectedUpdatedAt: data(current).updatedAt },
    ).expect(201);
    expect(data(unpublished).status).toBe('DRAFT');
    const hidden = await request(app.getHttpServer()).get(
      `/api/v1/countries/${String(data(current).slug)}`,
    );
    expect(hidden.status).toBe(404);
  });

  it('soft-deletes countries, blocks in-use continent deletion, and writes audit events', async () => {
    const blocked = await admin(
      'delete',
      `/api/v1/admin/continents/${continentId}`,
      {},
    );
    expect(blocked.status).toBe(409);
    expect(errorCode(blocked)).toBe('CONTINENT_IN_USE');
    const current = await admin(
      'get',
      `/api/v1/admin/countries/${countryIds[0]}`,
    ).expect(200);
    const removed = await admin(
      'delete',
      `/api/v1/admin/countries/${countryIds[0]}`,
      { expectedUpdatedAt: data(current).updatedAt },
    ).expect(200);
    expect(data(removed)).toEqual({ deleted: true });
    const publicGone = await request(app.getHttpServer()).get(
      `/api/v1/countries/${String(data(current).slug)}`,
    );
    expect(publicGone.status).toBe(404);
    const adminList = await admin(
      'get',
      `/api/v1/admin/countries?q=${encodeURIComponent(suffix)}`,
    ).expect(200);
    expect(
      (data(adminList) as unknown[]).map((item) => (item as Json).id),
    ).not.toContain(countryIds[0]);
    const audit = await prisma.auditLog.findMany({
      where: { entityId: countryIds[0] },
      select: { action: true },
    });
    expect(audit.map((row) => row.action)).toEqual(
      expect.arrayContaining([
        'COUNTRY_CREATED',
        'COUNTRY_UPDATED',
        'COUNTRY_PUBLISHED',
        'COUNTRY_UNPUBLISHED',
        'COUNTRY_DELETED',
      ]),
    );
  });

  it('returns bounded suggestions and validation errors without raw database details', async () => {
    const missing = await request(app.getHttpServer()).get(
      '/api/v1/countries/suggestions?q=a',
    );
    expect(missing.status).toBe(400);
    expect(errorCode(missing)).toBe('VALIDATION_ERROR');
    expect(JSON.stringify(body(missing))).not.toMatch(
      /prisma|mysql|constraint/i,
    );
  });
});
