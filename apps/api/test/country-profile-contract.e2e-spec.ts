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
 * The client Country contract asks for country-owned tuition, visa, English
 * and statistics values. Those overlap facts the catalogue already derives
 * from published universities and offerings, so the tests below pin the
 * source-of-truth rule as much as the persistence:
 *
 *   a stored statistics figure speaks for the country only when an editor took
 *   ownership (`sourceMode` other than DERIVED) *and* recorded where it came
 *   from and when it was checked. Otherwise the live catalogue count wins.
 */

function record(response: { body: unknown }): Record<string, unknown> {
  const body =
    response.body && typeof response.body === 'object'
      ? (response.body as Record<string, unknown>)
      : {};
  const value = body.data;
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function group(bundle: Record<string, unknown>, key: string) {
  const value = bundle[key];
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

describe('country profile client contract (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token = '';
  let countryId = '';
  let countrySlug = '';
  const created: { universities: string[]; intakeIds: string[] } = {
    universities: [],
    intakeIds: [],
  };

  const admin = (
    method: 'get' | 'post' | 'put',
    path: string,
    body?: Record<string, unknown>,
  ) => {
    const call = request(app.getHttpServer())
      [method](path)
      .set('Authorization', `Bearer ${token}`)
      .set('x-request-id', 'country-contract-e2e');
    return body ? call.send(body) : call;
  };

  const profiles = async () =>
    record(await admin('get', `/api/v1/admin/countries/${countryId}/profiles`));

  /** Every profile PUT is version-checked, so each save must carry the token
   * from the row it is about to replace. Reading the bundle first makes this
   * helper async, so callers assert on the resolved status. */
  const put = async (
    section: 'cost' | 'work' | 'language' | 'statistics',
    body: Record<string, unknown>,
  ) => {
    const bundle = await profiles();
    const current = group(bundle, section);
    return admin(
      'put',
      `/api/v1/admin/countries/${countryId}/profiles/${section}`,
      { ...body, expectedUpdatedAt: current.updatedAt },
    );
  };
  const saved = async (
    section: 'cost' | 'work' | 'language' | 'statistics',
    body: Record<string, unknown>,
  ) => {
    const response = await put(section, body);
    if (response.status !== 200)
      throw new Error(
        `${section} save failed ${response.status}: ${JSON.stringify(response.body)}`,
      );
    return response;
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
    if (!continent) throw new Error('An active continent is required');

    let iso2 = '';
    let iso3 = '';
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const seed = randomUUID().replace(/[^a-f]/gi, '').toUpperCase().padEnd(6, 'Q');
      const candidate2 = seed.slice(0, 2);
      const candidate3 = seed.slice(0, 3);
      const conflict = await prisma.country.findFirst({
        where: {
          OR: [
            { iso2Code: candidate2 },
            { iso3Code: candidate2 },
            { iso2Code: candidate3 },
            { iso3Code: candidate3 },
          ],
        },
        select: { id: true },
      });
      if (!conflict) {
        iso2 = candidate2;
        iso3 = candidate3;
        break;
      }
    }
    if (!iso2) throw new Error('Unable to allocate unique ISO codes');

    countrySlug = `contract-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const country = await admin('post', '/api/v1/admin/countries', {
      continentId: continent.id,
      name: `Contract ${countrySlug}`,
      slug: countrySlug,
      iso2Code: iso2,
      iso3Code: iso3,
      pageHeading: 'Study in Contract Test',
      shortDescription: 'Country contract test fixture',
    }).expect(201);
    countryId = String(record(country).id);
    // The public detail route serves published countries only.
    await admin('post', `/api/v1/admin/countries/${countryId}/publish`).expect(
      201,
    );

    // Two published universities give the derived count something real to say.
    for (const index of [1, 2]) {
      const university = await prisma.university.create({
        data: {
          countryId,
          name: `Contract University ${index} ${countrySlug}`,
          slug: `contract-university-${index}-${countrySlug}`,
          institutionType: 'PUBLIC',
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
      });
      created.universities.push(university.id);
    }
  });

  afterAll(async () => {
    if (created.universities.length)
      await prisma.university
        .deleteMany({ where: { id: { in: created.universities } } })
        .catch(() => undefined);
    if (countryId)
      await prisma.country
        .deleteMany({ where: { id: countryId } })
        .catch(() => undefined);
    await app.close();
  });

  it('persists a country-owned tuition range and returns it on reload', async () => {
    await saved('cost', {
      currencyCode: 'EUR',
      tuitionMin: '9000',
      tuitionMax: '15000',
      tuitionPeriod: 'PER_YEAR',
      livingCostMin: '700',
      livingCostMax: '1100',
      applicationFeeMin: '50',
      applicationFeeMax: '120',
      sourceReference: 'https://example.invalid/tuition',
      verifiedAt: new Date().toISOString(),
    });

    const cost = group(await profiles(), 'cost');
    expect(cost.currencyCode).toBe('EUR');
    expect(String(cost.tuitionMin)).toBe('9000');
    expect(String(cost.tuitionMax)).toBe('15000');
    expect(String(cost.livingCostMin)).toBe('700');
    expect(String(cost.applicationFeeMax)).toBe('120');
  });

  it('accepts a second edit of the same section', async () => {
    // The version guard rejects a stale token, so this is the regression that
    // catches an editor which never re-reads after saving.
    await saved('cost', { currencyCode: 'EUR', tuitionMin: '9500' });
    const cost = group(await profiles(), 'cost');
    expect(String(cost.tuitionMin)).toBe('9500');
  });

  it('persists visa type, fee and processing time', async () => {
    await saved('work', {
      visaType: 'Student residence permit',
      visaFee: '85.50',
      visaFeeCurrencyCode: 'eur',
      visaProcessingTime: '4 to 6 weeks',
      partTimeAllowed: true,
      partTimeHoursPerWeek: '20',
      postStudyWorkAvailable: true,
      postStudyWorkMaxMonths: 24,
    });

    const work = group(await profiles(), 'work');
    expect(work.visaType).toBe('Student residence permit');
    expect(String(work.visaFee)).toBe('85.5');
    expect(work.visaFeeCurrencyCode).toBe('EUR');
    expect(work.visaProcessingTime).toBe('4 to 6 weeks');
    expect(work.partTimeAllowed).toBe(true);
    expect(work.postStudyWorkMaxMonths).toBe(24);
  });

  it('persists the full English requirement profile, not only IELTS', async () => {
    await saved('language', {
      ieltsRequirement: 'REQUIRED',
      ieltsMinScore: '6.5',
      ieltsNotes: 'No band below 6.0.',
      pteRequirement: 'OPTIONAL',
      pteMinScore: '58',
      languageWaiverAvailable: true,
      waiverNotes: 'Waived after a prior degree taught in English.',
      generalNotes: 'Programmes may ask for more.',
      // Publishing a waiver commits the platform to a claim, so the API
      // requires it to name a source and a check date.
      sourceReference: 'https://example.invalid/language-policy',
      verifiedAt: new Date().toISOString(),
    });

    const language = group(await profiles(), 'language');
    expect(language.ieltsRequirement).toBe('REQUIRED');
    expect(String(language.ieltsMinScore)).toBe('6.5');
    expect(language.ieltsNotes).toBe('No band below 6.0.');
    expect(String(language.pteMinScore)).toBe('58');
    expect(language.languageWaiverAvailable).toBe(true);
    expect(language.generalNotes).toBe('Programmes may ask for more.');
  });

  it('persists intakes with their application windows', async () => {
    const intakes = await prisma.intake.findMany({
      where: { status: 'ACTIVE' },
      take: 2,
      orderBy: { displayOrder: 'asc' },
    });
    if (intakes.length === 0) return;
    created.intakeIds = intakes.map((row) => row.id);
    // The intakes token is the newest CountryIntake row; with none saved yet
    // it must be omitted, because the guard treats a token against no rows as
    // stale.
    const bundle = await profiles();
    const existing = Array.isArray(bundle.intakes)
      ? (bundle.intakes as Array<Record<string, unknown>>)
      : [];
    const stamps = existing
      .map((row) => String(row.updatedAt ?? ''))
      .filter(Boolean)
      .sort();
    await admin('put', `/api/v1/admin/countries/${countryId}/profiles/intakes`, {
      expectedUpdatedAt: stamps.length ? stamps[stamps.length - 1] : undefined,
      intakes: intakes.map((row, index) => ({
        intakeId: row.id,
        isMajor: index === 0,
        availabilityStatus: 'AVAILABLE',
        applicationOpeningMonth: 3,
        applicationDeadlineMonth: 6,
        notes: `Applications for ${row.name}.`,
        displayOrder: index,
      })),
    }).expect(200);

    const saved = await prisma.countryIntake.findMany({
      where: { countryId },
      orderBy: { displayOrder: 'asc' },
    });
    expect(saved).toHaveLength(intakes.length);
    expect(saved[0].isMajor).toBe(true);
    expect(saved[0].applicationOpeningMonth).toBe(3);
    expect(saved[0].applicationDeadlineMonth).toBe(6);
    expect(saved[0].notes).toContain('Applications for');
  });

  it('counts published universities while statistics stay on DERIVED', async () => {
    await saved('statistics', {
      sourceMode: 'DERIVED',
      universitiesCount: 99,
    });

    const detail = record(
      await request(app.getHttpServer())
        .get(`/api/v1/countries/${countrySlug}`)
        .expect(200),
    );
    const statistics = detail.statistics as { universitiesCount: number | null } | null;
    // 99 was stored but must not be published while the mode says DERIVED.
    expect(statistics?.universitiesCount ?? null).toBeNull();
    const derived = detail.derived as
      | { statistics?: { universitiesCount?: number } }
      | undefined;
    expect(derived?.statistics?.universitiesCount).toBe(2);
  });

  it('publishes a verified manual university count as the override', async () => {
    await saved('statistics', {
      sourceMode: 'MANUAL',
      universitiesCount: 42,
      internationalStudentsCount: 1500,
      sourceReference: 'https://example.invalid/ministry-report',
      verifiedAt: new Date().toISOString(),
    });

    const detail = record(
      await request(app.getHttpServer())
        .get(`/api/v1/countries/${countrySlug}`)
        .expect(200),
    );
    const statistics = detail.statistics as { universitiesCount: number | null } | null;
    expect(statistics?.universitiesCount).toBe(42);
  });

  it('refuses a manual count that names no source', async () => {
    const response = await put('statistics', {
      sourceMode: 'MANUAL',
      universitiesCount: 77,
      sourceReference: '',
    });
    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it('ignores an unverified stored count and falls back to the live one', async () => {
    // Legacy rows predate the source requirement, so the read path -- not only
    // the write path -- has to hold the line.
    await prisma.countryStatistic.updateMany({
      where: { countryId },
      data: { sourceMode: 'MANUAL', verifiedAt: null, universitiesCount: 500 },
    });

    const detail = record(
      await request(app.getHttpServer())
        .get(`/api/v1/countries/${countrySlug}`)
        .expect(200),
    );
    const statistics = detail.statistics as { universitiesCount: number | null } | null;
    expect(statistics?.universitiesCount ?? null).toBeNull();
    const derived = detail.derived as
      | { statistics?: { universitiesCount?: number } }
      | undefined;
    expect(derived?.statistics?.universitiesCount).toBe(2);
  });

  it('still derives tuition when the country publishes none of its own', async () => {
    await prisma.countryCostProfile.deleteMany({ where: { countryId } });
    const detail = record(
      await request(app.getHttpServer())
        .get(`/api/v1/countries/${countrySlug}`)
        .expect(200),
    );
    // No manual cost profile remains, so the country page has to fall through
    // to the derived block rather than showing nothing at all.
    expect(detail.derived).toBeTruthy();
  });
});
