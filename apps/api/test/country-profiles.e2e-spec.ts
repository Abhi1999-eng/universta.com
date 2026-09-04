import { ExpressAdapter } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';

function data(response: { body: unknown }): unknown {
  const value =
    response.body && typeof response.body === 'object'
      ? (response.body as Record<string, unknown>).data
      : null;
  return value;
}
function code(response: { body: unknown }): string {
  const body =
    response.body && typeof response.body === 'object'
      ? (response.body as Record<string, unknown>)
      : {};
  const error =
    body.error && typeof body.error === 'object'
      ? (body.error as Record<string, unknown>)
      : {};
  return typeof error.code === 'string' ? error.code : '';
}
function record(response: { body: unknown }): Record<string, unknown> {
  const value = data(response);
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

describe('country structured profiles (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token = '';
  let countryId = '';
  let countrySlug = '';

  const admin = (
    method: 'get' | 'post' | 'put' | 'patch' | 'delete',
    path: string,
    body?: Record<string, unknown>,
  ) => {
    const call = request(app.getHttpServer())
      [method](path)
      .set('Authorization', `Bearer ${token}`)
      .set('x-request-id', 'task005-profile-e2e');
    return body ? call.send(body) : call;
  };

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
    if (!password) throw new Error('A local Super Admin password is required');
    const login = await request(app.getHttpServer())
      .post('/api/v1/admin/auth/login')
      .send({ email, password })
      .expect(200);
    token = String(record(login).accessToken);
    const continent = await prisma.continent.findFirst({
      where: { status: 'ACTIVE', deletedAt: null },
    });
    if (!continent)
      throw new Error('An active continent is required for profile E2E');
    let iso2 = '';
    let iso3 = '';
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const codeSeed = randomUUID()
        .replace(/[^a-f]/gi, '')
        .toUpperCase()
        .padEnd(6, 'Z');
      const candidateIso2 = codeSeed.slice(0, 2);
      const candidateIso3 = codeSeed.slice(0, 3);
      const conflict = await prisma.country.findFirst({
        where: {
          OR: [
            { iso2Code: candidateIso2 },
            { iso3Code: candidateIso2 },
            { iso2Code: candidateIso3 },
            { iso3Code: candidateIso3 },
          ],
        },
        select: { id: true },
      });
      if (!conflict) {
        iso2 = candidateIso2;
        iso3 = candidateIso3;
        break;
      }
    }
    if (!iso2 || !iso3)
      throw new Error('Unable to allocate unique profile E2E ISO codes');
    countrySlug = `profile-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const created = await admin('post', '/api/v1/admin/countries', {
      continentId: continent.id,
      name: `Profile ${countrySlug}`,
      slug: countrySlug,
      iso2Code: iso2,
      iso3Code: iso3,
      pageHeading: 'Study in Profile Test',
      shortDescription: 'Profile test country',
    }).expect(201);
    countryId = String(record(created).id);
  });

  afterAll(async () => {
    // Hard-delete rather than the admin API's soft delete: the ISO code
    // collision check below (`iso2Code`/`iso3Code` lookup) does not exclude
    // soft-deleted rows, so a merely-archived fixture still permanently
    // consumes one of the tiny 36-combination candidate space this random
    // generator draws from. Left as a soft delete across many prior runs,
    // that space silently filled up and made this test's own setup flaky.
    if (countryId)
      await prisma.country
        .deleteMany({ where: { id: countryId } })
        .catch(() => undefined);
    await app.close();
  });

  it('protects profile routes and exposes active intake masters', async () => {
    expect(
      (
        await request(app.getHttpServer()).get(
          `/api/v1/admin/countries/${countryId}/profiles`,
        )
      ).status,
    ).toBe(401);
    const options = await admin('get', '/api/v1/admin/intakes').expect(200);
    expect(
      Array.isArray(data(options)) ? data(options).length : 0,
    ).toBeGreaterThan(0);
  });

  it('upserts verified profiles, enforces stale versions, replaces intakes, and redacts public data safely', async () => {
    const verifiedAt = '2026-01-01T00:00:00.000Z';
    const cost = await admin(
      'put',
      `/api/v1/admin/countries/${countryId}/profiles/cost`,
      {
        currencyCode: 'CAD',
        tuitionMin: '10000.00',
        tuitionMax: '20000.00',
        tuitionPeriod: 'PER_YEAR',
        budgetBand: 'MID_RANGE',
        sourceReference: 'https://example.com/profile-cost',
        verifiedAt,
      },
    ).expect(200);
    expect(record(cost).currencyCode).toBe('CAD');
    const stale = await admin(
      'put',
      `/api/v1/admin/countries/${countryId}/profiles/cost`,
      {
        currencyCode: 'CAD',
        tuitionMin: '1.00',
        expectedUpdatedAt: '2025-01-01T00:00:00.000Z',
      },
    );
    expect(stale.status).toBe(409);
    expect(code(stale)).toBe('COUNTRY_COST_PROFILE_STALE_VERSION');
    const invalidWork = await admin(
      'put',
      `/api/v1/admin/countries/${countryId}/profiles/work`,
      { visaSuccessBand: 'HIGH' },
    );
    expect(invalidWork.status).toBe(400);
    expect(code(invalidWork)).toBe('PROFILE_SOURCE_REQUIRED');
    await admin('put', `/api/v1/admin/countries/${countryId}/profiles/work`, {
      visaSuccessBand: 'MEDIUM',
      immigrationPathwayStrength: 'MODERATE',
      sourceReference: 'https://example.com/profile-work',
      verifiedAt,
    }).expect(200);
    const language = await admin(
      'put',
      `/api/v1/admin/countries/${countryId}/profiles/language`,
      {
        ieltsRequirement: 'OPTIONAL',
        ieltsMinScore: '6.5',
        languageWaiverAvailable: true,
        sourceReference: 'https://example.com/profile-language',
        verifiedAt,
      },
    );
    expect(record(language).ieltsRequirement).toBe('OPTIONAL');
    await admin(
      'put',
      `/api/v1/admin/countries/${countryId}/profiles/statistics`,
      {
        universitiesCount: 0,
        topRankedUniversitiesCount: 0,
        sourceMode: 'MANUAL',
        sourceReference: 'https://example.com/profile-statistics',
        verifiedAt,
      },
    ).expect(200);
    const intakeOptions = data(
      await admin('get', '/api/v1/admin/intakes').expect(200),
    );
    const intake = Array.isArray(intakeOptions)
      ? (intakeOptions[0] as Record<string, unknown>)
      : {};
    const intakeSlug = String(intake.slug);
    const intakes = await admin(
      'put',
      `/api/v1/admin/countries/${countryId}/profiles/intakes`,
      {
        intakes: [
          {
            intakeId: intake.id,
            isMajor: true,
            availabilityStatus: 'AVAILABLE',
          },
        ],
      },
    ).expect(200);
    expect(
      Array.isArray(record(intakes).intakes)
        ? record(intakes).intakes.length
        : 0,
    ).toBe(1);
    await admin('post', `/api/v1/admin/countries/${countryId}/publish`, {
      expectedUpdatedAt: record(
        await admin('get', `/api/v1/admin/countries/${countryId}`).expect(200),
      ).updatedAt,
    }).expect(201);
    const publicCountry = await request(app.getHttpServer())
      .get(`/api/v1/countries/${countrySlug}`)
      .expect(200);
    const publicProfiles = record(publicCountry).profiles as Record<
      string,
      unknown
    >;
    expect(
      (publicProfiles.language as Record<string, unknown>).ieltsRequirement,
    ).toBe('OPTIONAL');
    expect(
      (publicProfiles.statistics as Record<string, unknown>)
        .topRankedUniversitiesCount,
    ).toBe(0);
    const filtered = await request(app.getHttpServer())
      .get(
        `/api/v1/countries?budgetBand=MID_RANGE&ieltsOptional=true&intake=${intakeSlug}&visaSuccessBand=MEDIUM&pathwayStrength=MODERATE&hasTopRankedUniversities=false`,
      )
      .expect(200);
    expect(
      (data(filtered) as Array<Record<string, unknown>>).some(
        (item) => item.slug === countrySlug,
      ),
    ).toBe(true);
    const audits = await prisma.auditLog.count({
      where: {
        entityId: countryId,
        action: {
          in: [
            'COUNTRY_COST_PROFILE_UPSERTED',
            'COUNTRY_LANGUAGE_PROFILE_UPSERTED',
            'COUNTRY_STATISTICS_UPSERTED',
            'COUNTRY_INTAKES_REPLACED',
          ],
        },
      },
    });
    expect(audits).toBeGreaterThanOrEqual(4);
  });
  it('clears a numeric profile figure when the field is emptied', async () => {
    const verifiedAt = '2026-01-01T00:00:00.000Z';
    const current = await admin(
      'get',
      `/api/v1/admin/countries/${countryId}/profiles`,
    ).expect(200);
    const existing = (data(current) as { cost?: { updatedAt?: string } }).cost;
    const set = await admin(
      'put',
      `/api/v1/admin/countries/${countryId}/profiles/cost`,
      {
        currencyCode: 'CAD',
        tuitionMin: '10000.00',
        applicationFeeMin: '75.00',
        sourceReference: 'https://example.com/clear-cost',
        verifiedAt,
        ...(existing?.updatedAt
          ? { expectedUpdatedAt: existing.updatedAt }
          : {}),
      },
    ).expect(200);
    expect(String(record(set).applicationFeeMin)).toBe('75');

    /* An emptied field is the Admin's explicit clear. It used to be read as
     * "not provided", so the save reported success and kept the old figure. */
    const cleared = await admin(
      'put',
      `/api/v1/admin/countries/${countryId}/profiles/cost`,
      {
        currencyCode: 'CAD',
        tuitionMin: '10000.00',
        applicationFeeMin: '',
        sourceReference: 'https://example.com/clear-cost',
        verifiedAt,
        expectedUpdatedAt: record(set).updatedAt,
      },
    ).expect(200);
    expect(record(cleared).applicationFeeMin).toBeNull();

    // An omitted key still means "leave unchanged" for other API callers.
    const untouched = await admin(
      'put',
      `/api/v1/admin/countries/${countryId}/profiles/cost`,
      {
        currencyCode: 'CAD',
        tuitionMin: '12000.00',
        sourceReference: 'https://example.com/clear-cost',
        verifiedAt,
        expectedUpdatedAt: record(cleared).updatedAt,
      },
    ).expect(200);
    expect(String(record(untouched).tuitionMin)).toBe('12000');
  });

  it('unsets a language requirement back to its "nothing asserted" default', async () => {
    const current = await admin(
      'get',
      `/api/v1/admin/countries/${countryId}/profiles`,
    ).expect(200);
    const existing = (data(current) as { language?: { updatedAt?: string } })
      .language;
    const set = await admin(
      'put',
      `/api/v1/admin/countries/${countryId}/profiles/language`,
      {
        ieltsRequirement: 'REQUIRED',
        ieltsMinScore: '6.5',
        ...(existing?.updatedAt
          ? { expectedUpdatedAt: existing.updatedAt }
          : {}),
      },
    ).expect(200);
    expect(record(set).ieltsRequirement).toBe('REQUIRED');

    /* `ielts_requirement` is NOT NULL and defaults to VARIES, so "not set" is
     * VARIES -- which is exactly what the public page prints. The Admin used to
     * send '' here and take a 400 naming no field. */
    const cleared = await admin(
      'put',
      `/api/v1/admin/countries/${countryId}/profiles/language`,
      {
        ieltsRequirement: 'VARIES',
        ieltsMinScore: '',
        expectedUpdatedAt: record(set).updatedAt,
      },
    ).expect(200);
    expect(record(cleared).ieltsRequirement).toBe('VARIES');
    expect(record(cleared).ieltsMinScore).toBeNull();
  });

  it('refuses a test score whose requirement says the test is not asked for', async () => {
    const current = await admin(
      'get',
      `/api/v1/admin/countries/${countryId}/profiles`,
    ).expect(200);
    const existing = (data(current) as { language?: { updatedAt?: string } })
      .language;
    const response = await admin(
      'put',
      `/api/v1/admin/countries/${countryId}/profiles/language`,
      {
        toeflRequirement: 'VARIES',
        toeflMinScore: '90',
        ...(existing?.updatedAt
          ? { expectedUpdatedAt: existing.updatedAt }
          : {}),
      },
    );
    expect(response.status).toBe(400);
    expect(code(response)).toBe('PROFILE_LANGUAGE_SCORE_INVALID');
  });

  it('accepts a TOEFL and Duolingo score once the requirement asks for the test', async () => {
    const current = await admin(
      'get',
      `/api/v1/admin/countries/${countryId}/profiles`,
    ).expect(200);
    const existing = (data(current) as { language?: { updatedAt?: string } })
      .language;
    const saved = await admin(
      'put',
      `/api/v1/admin/countries/${countryId}/profiles/language`,
      {
        toeflRequirement: 'REQUIRED',
        toeflMinScore: '90',
        duolingoRequirement: 'OPTIONAL',
        duolingoMinScore: '110',
        ...(existing?.updatedAt
          ? { expectedUpdatedAt: existing.updatedAt }
          : {}),
      },
    ).expect(200);
    expect(String(record(saved).toeflMinScore)).toBe('90');
    expect(String(record(saved).duolingoMinScore)).toBe('110');
  });
});
