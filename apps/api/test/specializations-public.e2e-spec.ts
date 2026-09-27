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
 * A specialization is addressed inside its subject, because that pair is what
 * makes it unique: the client's taxonomy teaches "Animal Science" under
 * Agriculture, under Science and under Biological & Life Sciences, and those
 * are three different pages.
 *
 * These tests hold that. Two subjects carry a specialization with the same
 * slug, and each has to resolve to its own record rather than to whichever one
 * the database happened to return first.
 */

type Json = Record<string, unknown>;

const body = (response: { body: unknown }): Json =>
  (response.body ?? {}) as Json;
const record = (response: { body: unknown }): Json => {
  const value = body(response).data;
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Json)
    : {};
};
const rows = (response: { body: unknown }): Json[] => {
  const value = body(response).data;
  return Array.isArray(value) ? (value as Json[]) : [];
};

describe('public specializations (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const stamp = randomUUID().slice(0, 8);
  const subjectIds: string[] = [];
  const shared = `shared-branch-${stamp}`;

  const get = (path: string) =>
    request(app.getHttpServer())
      .get(path)
      .set('x-request-id', `spec-public-${stamp}`);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication(new ExpressAdapter());
    configureApplication(app);
    await app.init();
    prisma = app.get(PrismaService);

    /* Two subjects, each with a specialization under the same slug. */
    for (const label of ['Alpha', 'Beta']) {
      const subject = await prisma.subject.create({
        data: {
          name: `Spec Subject ${label} ${stamp}`,
          slug: `spec-subject-${label.toLowerCase()}-${stamp}`,
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
      });
      subjectIds.push(subject.id);
      await prisma.subSubject.create({
        data: {
          subjectId: subject.id,
          name: `Shared Branch ${label} ${stamp}`,
          slug: shared,
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
      });
    }
    /* A second branch under the first subject, so siblings are non-empty. */
    await prisma.subSubject.create({
      data: {
        subjectId: subjectIds[0],
        name: `Other Branch ${stamp}`,
        slug: `other-branch-${stamp}`,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    await prisma.subSubject
      .deleteMany({ where: { subjectId: { in: subjectIds } } })
      .catch(() => undefined);
    await prisma.subject
      .deleteMany({ where: { id: { in: subjectIds } } })
      .catch(() => undefined);
    await app.close();
  });

  it('resolves one slug to a different record under each subject', async () => {
    const alpha = record(
      await get(
        `/api/v1/subjects/spec-subject-alpha-${stamp}/specializations/${shared}`,
      ).expect(200),
    );
    const beta = record(
      await get(
        `/api/v1/subjects/spec-subject-beta-${stamp}/specializations/${shared}`,
      ).expect(200),
    );

    expect(alpha.name).toBe(`Shared Branch Alpha ${stamp}`);
    expect(beta.name).toBe(`Shared Branch Beta ${stamp}`);
    expect(alpha.id).not.toBe(beta.id);
    expect((alpha.subject as Json).slug).toBe(`spec-subject-alpha-${stamp}`);
  });

  it('carries the siblings that share its subject, and not itself', async () => {
    const detail = record(
      await get(
        `/api/v1/subjects/spec-subject-alpha-${stamp}/specializations/${shared}`,
      ).expect(200),
    );
    const siblings = detail.siblings as Json[];
    expect(siblings.map((row) => row.slug)).toEqual([`other-branch-${stamp}`]);
  });

  it('404s for a slug that exists under a different subject', async () => {
    const response = await get(
      `/api/v1/subjects/spec-subject-alpha-${stamp}/specializations/other-branch-nope-${stamp}`,
    ).expect(404);
    expect((body(response).error as Json).code).toBe(
      'SPECIALIZATION_NOT_FOUND',
    );
  });

  it('404s when the subject itself is not published', async () => {
    const response = await get(
      `/api/v1/subjects/no-such-subject-${stamp}/specializations/${shared}`,
    ).expect(404);
    expect((body(response).error as Json).code).toBe('SUBJECT_NOT_FOUND');
  });

  it('lists a shared slug once per subject, each with its own subject', async () => {
    const listed = rows(
      await get(`/api/v1/specializations?slug=${shared}`).expect(200),
    );
    expect(listed).toHaveLength(2);
    expect(listed.map((row) => (row.subject as Json).slug).sort()).toEqual(
      [`spec-subject-alpha-${stamp}`, `spec-subject-beta-${stamp}`].sort(),
    );
  });

  it('narrows the list to one subject', async () => {
    const listed = rows(
      await get(
        `/api/v1/specializations?subject=spec-subject-alpha-${stamp}`,
      ).expect(200),
    );
    expect(listed.map((row) => row.slug).sort()).toEqual(
      [shared, `other-branch-${stamp}`].sort(),
    );
  });

  it('searches by name', async () => {
    const listed = rows(
      await get(
        `/api/v1/specializations?search=${encodeURIComponent(`Other Branch ${stamp}`)}`,
      ).expect(200),
    );
    expect(listed).toHaveLength(1);
    expect(listed[0].slug).toBe(`other-branch-${stamp}`);
  });
});
