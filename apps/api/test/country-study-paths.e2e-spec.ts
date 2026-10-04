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
 * A destination's study paths are what its editor typed, and nothing when
 * they typed nothing.
 *
 * The public guide printed four levels on every country page from a list in
 * the web app. A country created with a name and nothing else showed
 * "Bachelor's, 3-4 years, School leaving qualification" as though somebody
 * had said so. The list is the country's own now, and these hold the API to
 * the three things that makes true: a new country has none, what is saved is
 * what is served, and emptying the list empties the page.
 */
type Path = {
  name: string;
  duration: string | null;
  entry: string | null;
  summary: string | null;
};

function record(response: { body: unknown }): Record<string, unknown> {
  const value = (response.body as { data?: unknown } | null)?.data;
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
const paths = (value: Record<string, unknown>): Path[] =>
  (value.configuration as { studyPaths?: Path[] } | null)?.studyPaths ?? [];

describe('country study paths (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token = '';
  let continentId = '';
  let countryId = '';
  const stamp = `${Date.now()}-${randomUUID().slice(0, 6)}`;
  const slug = `study-paths-${stamp}`;

  const admin = (
    method: 'get' | 'post' | 'patch',
    path: string,
    payload?: Record<string, unknown>,
  ) => {
    const call = request(app.getHttpServer())
      [method](path)
      .set('Authorization', `Bearer ${token}`);
    return payload ? call.send(payload) : call;
  };
  const core = () => ({
    continentId,
    name: `Study Paths ${stamp}`,
    slug,
    pageHeading: 'Study in Study Paths',
    shortDescription: 'Study paths fixture',
  });

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
    token = String(record(login).accessToken);
    continentId = (
      await prisma.continent.findFirstOrThrow({
        where: { status: 'ACTIVE', deletedAt: null },
      })
    ).id;
  }, 60_000);

  afterAll(async () => {
    if (countryId)
      await prisma.country
        .deleteMany({ where: { id: countryId } })
        .catch(() => undefined);
    await app.close();
  });

  it('starts a new country with none', async () => {
    const created = record(
      await admin('post', '/api/v1/admin/countries', core()).expect(201),
    );
    countryId = String(created.id);
    expect(paths(created)).toEqual([]);
    await admin(
      'post',
      `/api/v1/admin/countries/${countryId}/publish`,
      {},
    ).expect(201);

    const page = record(
      await request(app.getHttpServer())
        .get(`/api/v1/countries/${slug}/page`)
        .expect(200),
    );
    expect(paths(page.country as Record<string, unknown>)).toEqual([]);
  });

  it('serves the levels an editor saves, in their order, word for word', async () => {
    const saved = record(
      await admin('patch', `/api/v1/admin/countries/${countryId}`, {
        ...core(),
        studyPaths: [
          {
            name: 'Foundation year',
            duration: '1 year',
            summary: 'A bridge into a degree.',
          },
          {
            name: "Bachelor's",
            duration: '3 years (4 in Scotland)',
            entry: 'A-levels or equivalent',
          },
        ],
      }).expect(200),
    );
    const expected: Path[] = [
      {
        name: 'Foundation year',
        duration: '1 year',
        entry: null,
        summary: 'A bridge into a degree.',
      },
      {
        name: "Bachelor's",
        duration: '3 years (4 in Scotland)',
        entry: 'A-levels or equivalent',
        summary: null,
      },
    ];
    expect(paths(saved)).toEqual(expected);

    const page = record(
      await request(app.getHttpServer())
        .get(`/api/v1/countries/${slug}/page`)
        .expect(200),
    );
    expect(paths(page.country as Record<string, unknown>)).toEqual(expected);
  });

  it('leaves them alone when a save does not mention them', async () => {
    const saved = record(
      await admin('patch', `/api/v1/admin/countries/${countryId}`, {
        ...core(),
        shortDescription: 'Edited without touching the levels',
      }).expect(200),
    );
    expect(paths(saved)).toHaveLength(2);
  });

  it('refuses a level with no name rather than storing a tab with nothing on it', async () => {
    await admin('patch', `/api/v1/admin/countries/${countryId}`, {
      ...core(),
      studyPaths: [{ name: '', duration: '3 years' }],
    }).expect(400);
  });

  it('refuses more levels than a guide will show', async () => {
    await admin('patch', `/api/v1/admin/countries/${countryId}`, {
      ...core(),
      studyPaths: Array.from({ length: 9 }, (_, index) => ({
        name: `Level ${index}`,
      })),
    }).expect(400);
  });

  it('clears them when the list is emptied, and stores nothing in their place', async () => {
    const saved = record(
      await admin('patch', `/api/v1/admin/countries/${countryId}`, {
        ...core(),
        studyPaths: [],
      }).expect(200),
    );
    expect(paths(saved)).toEqual([]);
    const row = await prisma.country.findUniqueOrThrow({
      where: { id: countryId },
      select: { studyPaths: true },
    });
    expect(row.studyPaths).toBeNull();
  });
});
