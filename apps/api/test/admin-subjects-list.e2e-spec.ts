import { ExpressAdapter } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/bootstrap';

/** The Admin Subjects screen showed "Invalid catalog request" on every visit,
 * including on an empty production database where it should have shown the
 * ordinary "No subjects found" empty state.
 *
 * The cause was a contract mismatch, not data: the screen asks for
 * `sort=featured` -- Subjects carry an `isFeatured` flag and the screen offers
 * a Featured filter -- but the API's list DTO only accepted
 * displayOrder/name/createdAt/updatedAt, so class-validator rejected every
 * request with VALIDATION_ERROR, which the Admin proxy renders as "Invalid
 * catalog request".
 *
 * These tests pin the contract itself: the parameters the screen actually
 * sends must be accepted, and unsupported ones must still be refused. */

type Json = Record<string, unknown>;

function body(response: { body: unknown }): Json {
  return (response.body ?? {}) as Json;
}

function errorCode(response: { body: unknown }): string {
  const error = body(response).error as Json | null;
  return error && typeof error.code === 'string' ? error.code : '';
}

describe('admin subjects list contract (e2e)', () => {
  let app: INestApplication<App>;
  let token = '';

  const list = (queryString: string) =>
    request(app.getHttpServer())
      .get(`/api/v1/admin/subjects${queryString}`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-request-id', 'subjects-list-e2e');

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = fixture.createNestApplication(new ExpressAdapter());
    configureApplication(app);
    await app.init();

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
    token = String((body(login).data as Json).accessToken);
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts the exact request the Subjects screen sends', async () => {
    // This is the regression. Before the fix it returned 400 VALIDATION_ERROR.
    const response = await list('?page=1&limit=12&sort=featured').expect(200);
    expect(Array.isArray(body(response).data)).toBe(true);
    expect(body(response).error).toBeNull();
  });

  it('accepts a request with no filters at all', async () => {
    const response = await list('').expect(200);
    expect(Array.isArray(body(response).data)).toBe(true);
  });

  it('returns a valid empty result rather than an error when nothing matches', async () => {
    // An empty catalogue is a normal state, not a failure -- this is what lets
    // the screen render "No subjects found" on a fresh production database.
    const response = await list(
      '?q=zzz-no-such-subject-zzz&page=1&limit=12&sort=featured',
    ).expect(200);
    expect(body(response).data).toEqual([]);
    expect(body(response).error).toBeNull();
    const meta = body(response).meta as Json;
    expect(meta.total).toBe(0);
    expect(meta.page).toBe(1);
  });

  it('accepts every filter the screen exposes', async () => {
    for (const query of [
      '?q=computer&sort=featured',
      '?status=PUBLISHED&sort=featured',
      '?status=DRAFT&sort=featured',
      '?featured=true&sort=featured',
      '?featured=false&sort=featured',
      '?page=2&limit=12&sort=featured',
    ]) {
      const response = await list(query);
      expect({ query, status: response.status }).toEqual({
        query,
        status: 200,
      });
    }
  });

  it('accepts every sort the API advertises', async () => {
    for (const sort of [
      'displayOrder',
      'name',
      'createdAt',
      'updatedAt',
      'featured',
    ]) {
      const response = await list(`?sort=${sort}`);
      expect({ sort, status: response.status }).toEqual({ sort, status: 200 });
    }
  });

  it('answers sort=featured in the catalogue’s own order', async () => {
    /* The screen still sends `sort=featured` and a saved link still has to
       work, but the sort no longer reads `isFeatured`: nothing sets that
       column any more, so ordering on it only sorted by a value that is
       false on every row an editor creates. What it promises now is the
       order the catalogue itself keeps -- display order, then name.

       This used to assert featured-first, and passed only because the
       seeded featured subjects happened to hold the lowest display
       orders. Any new subject, which starts at display order 0, put a
       plain row in front of them and broke it. */
    const response = await list('?sort=featured&limit=100').expect(200);
    const rows = body(response).data as Array<{
      displayOrder?: number;
      name?: string;
    }>;
    const keys = rows.map((row) => [row.displayOrder ?? 0, row.name ?? '']);
    const sorted = [...keys].sort(
      (a, b) =>
        (a[0] as number) - (b[0] as number) ||
        String(a[1]).localeCompare(String(b[1])),
    );
    expect(keys).toEqual(sorted);
  });

  it('still rejects an unsupported sort', async () => {
    // Validation must stay enforced -- the fix widened the contract to what the
    // screen needs, it did not disable checking.
    const response = await list('?sort=notARealColumn').expect(400);
    expect(errorCode(response)).toBe('VALIDATION_ERROR');
  });

  it('still rejects an unsupported status and an out-of-range page', async () => {
    expect(errorCode(await list('?status=ARCHIVED').expect(400))).toBe(
      'VALIDATION_ERROR',
    );
    expect(errorCode(await list('?page=0').expect(400))).toBe(
      'VALIDATION_ERROR',
    );
    expect(errorCode(await list('?limit=100000').expect(400))).toBe(
      'VALIDATION_ERROR',
    );
  });

  it('still requires authentication', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/subjects?sort=featured')
      .expect(401);
  });
});
