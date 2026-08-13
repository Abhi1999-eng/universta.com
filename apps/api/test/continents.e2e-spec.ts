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
 * The continent lifecycle, end to end.
 *
 * The case that matters most is delete-then-recreate: uniqueness used to be
 * enforced across every row ever written, so a deleted continent kept its name,
 * slug and code forever and the same continent could never be created again.
 * That is asserted here for both continents and countries, alongside the
 * dependency rule that stops a continent leaving while countries still point at
 * it.
 */

type Json = Record<string, unknown>;

const run = `cont-${Date.now()}-${randomUUID().slice(0, 8)}`;

function body(response: { body: unknown }): Json {
  return response.body && typeof response.body === 'object'
    ? (response.body as Json)
    : {};
}
function data(response: { body: unknown }): Json {
  const value = body(response).data;
  return value && typeof value === 'object' ? (value as Json) : {};
}
function errorOf(response: { body: unknown }): Json {
  const value = body(response).error;
  return value && typeof value === 'object' ? (value as Json) : {};
}
function letters(length: number): string {
  return randomUUID()
    .replace(/-/g, '')
    .slice(0, length)
    .split('')
    .map((value) => String.fromCharCode(65 + (parseInt(value, 16) % 26)))
    .join('');
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/* ISO alpha-2 is only two letters wide -- 676 values, shared with every other
 * suite that creates a country. Drawing one at random collides often enough
 * that this spec failed roughly one run in five, which looks like a product
 * bug and is not one. Codes are therefore taken from what is actually free in
 * the database, the same approach catalog.e2e-spec uses. */
const freeIso2: string[] = [];
const usedIso3 = new Set<string>();

function nextIso(): { iso2Code: string; iso3Code: string } {
  const iso2Code = freeIso2.pop();
  if (!iso2Code) throw new Error('No free ISO alpha-2 code remains locally');
  const suffix = ALPHABET.find(
    (letter) => !usedIso3.has(`${iso2Code}${letter}`),
  );
  if (!suffix)
    throw new Error(`No free ISO alpha-3 code remains for ${iso2Code}`);
  const iso3Code = `${iso2Code}${suffix}`;
  usedIso3.add(iso3Code);
  return { iso2Code, iso3Code };
}

describe('continent lifecycle (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token = '';
  const continentIds = new Set<string>();
  const countryIds = new Set<string>();

  function admin(
    method: 'get' | 'post' | 'patch' | 'delete',
    path: string,
    payload?: Json,
  ) {
    const call = request(app.getHttpServer())
      [method](path)
      .set('Authorization', `Bearer ${token}`)
      .set('x-request-id', 'continents-e2e');
    return payload ? call.send(payload) : call;
  }

  /** Records the id so afterAll can hard-delete it, then returns the payload. */
  async function makeContinent(payload: Json, expected = 201) {
    const response = await admin(
      'post',
      '/api/v1/admin/continents',
      payload,
    ).expect(expected);
    const record = data(response);
    if (typeof record.id === 'string') continentIds.add(record.id);
    return record;
  }

  async function makeCountry(payload: Json, expected = 201) {
    const response = await admin(
      'post',
      '/api/v1/admin/countries',
      payload,
    ).expect(expected);
    const record = data(response);
    if (typeof record.id === 'string') countryIds.add(record.id);
    return record;
  }

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = fixture.createNestApplication(new ExpressAdapter());
    configureApplication(app);
    await app.init();
    prisma = app.get(PrismaService);

    // Uniqueness is scoped to live rows, so only live countries hold a code.
    const inUse = await prisma.country.findMany({
      where: { deletedAt: null },
      select: { iso2Code: true, iso3Code: true },
    });
    const takenIso2 = new Set(inUse.map((row) => row.iso2Code));
    for (const row of inUse) if (row.iso3Code) usedIso3.add(row.iso3Code);
    for (const first of ALPHABET)
      for (const second of ALPHABET) {
        const code = `${first}${second}`;
        if (!takenIso2.has(code)) freeIso2.push(code);
      }

    const email =
      process.env.SEED_ADMIN_EMAIL ??
      process.env.SUPER_ADMIN_EMAIL ??
      'admin@universta.local';
    const password =
      process.env.SEED_ADMIN_PASSWORD ?? process.env.SUPER_ADMIN_PASSWORD;
    if (!password)
      throw new Error('A local Super Admin password is required for this E2E');
    const login = await request(app.getHttpServer())
      .post('/api/v1/admin/auth/login')
      .send({ email, password })
      .expect(200);
    token = String(data(login).accessToken);
  });

  afterAll(async () => {
    // Hard-deleted, not soft: these fixtures exist only for the assertions
    // above and should not survive the run in any form.
    if (countryIds.size)
      await prisma.country
        .deleteMany({ where: { id: { in: [...countryIds] } } })
        .catch(() => undefined);
    if (continentIds.size)
      await prisma.continent
        .deleteMany({ where: { id: { in: [...continentIds] } } })
        .catch(() => undefined);
    await app.close();
  });

  describe('slug', () => {
    it('derives the slug from the name when none is given', async () => {
      const record = await makeContinent({ name: `North Ocean ${run}` });
      expect(record.slug).toBe(`north-ocean-${run}`);
    });

    it('keeps a slug the admin chose instead of deriving one', async () => {
      const record = await makeContinent({
        name: `Chosen Slug ${run}`,
        slug: `custom-${run}`,
      });
      expect(record.slug).toBe(`custom-${run}`);
    });

    it('normalizes a slug that arrives unnormalized', async () => {
      const record = await makeContinent({
        name: `Loose Slug ${run}`,
        slug: `  Loose Slug ${run}  `,
      });
      expect(record.slug).toBe(`loose-slug-${run}`);
    });

    it('rejects a slug that normalizes away to nothing', async () => {
      const response = await admin('post', '/api/v1/admin/continents', {
        name: `Empty Slug ${run}`,
        slug: '///',
      }).expect(400);
      expect(errorOf(response).code).toBe('VALIDATION_ERROR');
    });

    it('does not rewrite the slug when the name is edited', async () => {
      const record = await makeContinent({ name: `Stable ${run}` });
      const updated = await admin(
        'patch',
        `/api/v1/admin/continents/${String(record.id)}`,
        { name: `Stable Renamed ${run}`, expectedUpdatedAt: record.updatedAt },
      ).expect(200);
      expect(data(updated).name).toBe(`Stable Renamed ${run}`);
      expect(data(updated).slug).toBe(`stable-${run}`);
    });
  });

  describe('uniqueness among live continents', () => {
    it('refuses a duplicate name, slug and code', async () => {
      const code = `D${letters(5)}`;
      const first = await makeContinent({
        name: `Duplicate ${run}`,
        slug: `duplicate-${run}`,
        code,
      });
      expect(first.id).toBeTruthy();

      const byName = await admin('post', '/api/v1/admin/continents', {
        name: `Duplicate ${run}`,
        slug: `duplicate-other-${run}`,
      }).expect(409);
      expect(errorOf(byName).code).toBe('CONTINENT_NAME_CONFLICT');

      const bySlug = await admin('post', '/api/v1/admin/continents', {
        name: `Duplicate Other ${run}`,
        slug: `duplicate-${run}`,
      }).expect(409);
      expect(errorOf(bySlug).code).toBe('CONTINENT_SLUG_CONFLICT');

      const byCode = await admin('post', '/api/v1/admin/continents', {
        name: `Duplicate Code ${run}`,
        slug: `duplicate-code-${run}`,
        code,
      }).expect(409);
      expect(errorOf(byCode).code).toBe('CONTINENT_CODE_CONFLICT');
    });
  });

  describe('deletion', () => {
    it('deletes a continent that has no countries', async () => {
      const record = await makeContinent({ name: `Unlinked ${run}` });
      await admin('delete', `/api/v1/admin/continents/${String(record.id)}`, {
        expectedUpdatedAt: record.updatedAt,
      }).expect(200);

      await admin(
        'get',
        `/api/v1/admin/continents/${String(record.id)}`,
      ).expect(404);
      const row = await prisma.continent.findUnique({
        where: { id: String(record.id) },
      });
      expect(row?.deletedAt).not.toBeNull();
    });

    it('refuses to delete a continent that still has countries, and names them', async () => {
      const continent = await makeContinent({ name: `Occupied ${run}` });
      const country = await makeCountry({
        continentId: continent.id,
        name: `Occupied Country ${run}`,
        slug: `occupied-country-${run}`,
        ...nextIso(),
        pageHeading: `Study in Occupied ${run}`,
        shortDescription: 'Fixture country for the dependency rule.',
      });

      const blocked = await admin(
        'delete',
        `/api/v1/admin/continents/${String(continent.id)}`,
        { expectedUpdatedAt: continent.updatedAt },
      ).expect(409);
      const error = errorOf(blocked);
      expect(error.code).toBe('CONTINENT_IN_USE');
      const details = error.details as {
        countriesCount: number;
        countries: Array<{ id: string; name: string }>;
      };
      expect(details.countriesCount).toBe(1);
      expect(details.countries[0].id).toBe(country.id);
      expect(details.countries[0].name).toBe(`Occupied Country ${run}`);

      // Nothing cascaded: the country is untouched and still linked.
      const survivor = await prisma.country.findUnique({
        where: { id: String(country.id) },
      });
      expect(survivor?.deletedAt).toBeNull();
      expect(survivor?.continentId).toBe(continent.id);
    });

    it('allows the delete once the last country has moved away', async () => {
      const from = await makeContinent({ name: `Emptying ${run}` });
      const to = await makeContinent({ name: `Receiving ${run}` });
      const country = await makeCountry({
        continentId: from.id,
        name: `Moving Country ${run}`,
        slug: `moving-country-${run}`,
        ...nextIso(),
        pageHeading: `Study in Moving ${run}`,
        shortDescription: 'Fixture country for continent reassignment.',
      });

      const moved = await admin(
        'patch',
        `/api/v1/admin/countries/${String(country.id)}`,
        {
          continentId: to.id,
          name: `Moving Country ${run}`,
          slug: `moving-country-${run}`,
          iso2Code: country.iso2Code,
          iso3Code: country.iso3Code,
          pageHeading: `Study in Moving ${run}`,
          shortDescription: 'Fixture country for continent reassignment.',
          expectedUpdatedAt: country.updatedAt,
        },
      ).expect(200);
      expect((data(moved).continent as Json).id).toBe(to.id);

      const fresh = await admin(
        'get',
        `/api/v1/admin/continents/${String(from.id)}`,
      ).expect(200);
      expect(data(fresh).countriesCount).toBe(0);
      await admin('delete', `/api/v1/admin/continents/${String(from.id)}`, {
        expectedUpdatedAt: data(fresh).updatedAt,
      }).expect(200);
    });
  });

  describe('recreation after deletion', () => {
    it('lets the same continent be created again once it is deleted', async () => {
      const name = `Recreated ${run}`;
      const slug = `recreated-${run}`;
      const code = `R${letters(5)}`;

      const first = await makeContinent({ name, slug, code });
      await admin('delete', `/api/v1/admin/continents/${String(first.id)}`, {
        expectedUpdatedAt: first.updatedAt,
      }).expect(200);

      // The whole point: identical name, slug and code, and it must succeed.
      const second = await makeContinent({ name, slug, code });
      expect(second.id).not.toBe(first.id);
      expect(second.name).toBe(name);
      expect(second.slug).toBe(slug);
      expect(second.code).toBe(code);

      // And exactly one of them is live.
      const live = await prisma.continent.findMany({
        where: { slug, deletedAt: null },
        select: { id: true },
      });
      expect(live.map((row) => row.id)).toEqual([second.id]);

      // The list an admin sees shows one, not two.
      const listed = await admin(
        'get',
        `/api/v1/admin/continents?q=${encodeURIComponent(slug)}`,
      ).expect(200);
      expect((body(listed).data as Json[]).length).toBe(1);
    });

    it('lets the same country be created again once it is deleted', async () => {
      const continent = await makeContinent({ name: `Country Reuse ${run}` });
      const shared = {
        continentId: continent.id,
        name: `Reused Country ${run}`,
        slug: `reused-country-${run}`,
        ...nextIso(),
        pageHeading: `Study in Reused ${run}`,
        shortDescription: 'Fixture country for the recreation rule.',
      };

      const first = await makeCountry(shared);
      await admin('delete', `/api/v1/admin/countries/${String(first.id)}`, {
        expectedUpdatedAt: first.updatedAt,
      }).expect(200);

      const second = await makeCountry(shared);
      expect(second.id).not.toBe(first.id);
      expect(second.slug).toBe(shared.slug);

      const live = await prisma.country.findMany({
        where: { slug: shared.slug, deletedAt: null },
        select: { id: true },
      });
      expect(live.map((row) => row.id)).toEqual([second.id]);
    });
  });

  describe('country assignment', () => {
    it('creates a country against an existing continent and rejects an unknown one', async () => {
      const continent = await makeContinent({ name: `Assignment ${run}` });
      const country = await makeCountry({
        continentId: continent.id,
        name: `Assigned Country ${run}`,
        slug: `assigned-country-${run}`,
        ...nextIso(),
        pageHeading: `Study in Assigned ${run}`,
        shortDescription: 'Fixture country for continent assignment.',
      });
      expect((country.continent as Json).id).toBe(continent.id);

      const unknown = await admin('post', '/api/v1/admin/countries', {
        continentId: randomUUID(),
        name: `Orphan Country ${run}`,
        slug: `orphan-country-${run}`,
        ...nextIso(),
        pageHeading: `Study in Orphan ${run}`,
        shortDescription: 'Fixture country that must not be created.',
      }).expect(409);
      expect(errorOf(unknown).code).toBe('COUNTRY_CONTINENT_INVALID');
    });

    it('refuses a country pointed at a deleted continent', async () => {
      const continent = await makeContinent({ name: `Gone ${run}` });
      await admin(
        'delete',
        `/api/v1/admin/continents/${String(continent.id)}`,
        {
          expectedUpdatedAt: continent.updatedAt,
        },
      ).expect(200);

      const response = await admin('post', '/api/v1/admin/countries', {
        continentId: continent.id,
        name: `Stranded Country ${run}`,
        slug: `stranded-country-${run}`,
        ...nextIso(),
        pageHeading: `Study in Stranded ${run}`,
        shortDescription: 'Fixture country that must not be created.',
      }).expect(409);
      expect(errorOf(response).code).toBe('COUNTRY_CONTINENT_INVALID');
    });
  });

  describe('public listing', () => {
    it('never shows a deleted continent', async () => {
      const record = await makeContinent({ name: `Public Gone ${run}` });
      await admin('delete', `/api/v1/admin/continents/${String(record.id)}`, {
        expectedUpdatedAt: record.updatedAt,
      }).expect(200);

      const listed = await request(app.getHttpServer())
        .get('/api/v1/continents')
        .expect(200);
      const slugs = (body(listed).data as Json[]).map((row) => row.slug);
      expect(slugs).not.toContain(`public-gone-${run}`);
    });
  });
});
