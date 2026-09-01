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
 * Country taxonomy is an editorial assignment (Country -> CountrySubject ->
 * Subject), not something inferred from the courses a country happens to
 * offer. These tests hold that line, and hold the list row to carrying enough
 * to render without a follow-up query per country.
 */

function body(response: { body: unknown }): Record<string, unknown> {
  return response.body && typeof response.body === 'object'
    ? (response.body as Record<string, unknown>)
    : {};
}
function record(response: { body: unknown }): Record<string, unknown> {
  const value = body(response).data;
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
/** The update DTO extends the create DTO, so every PATCH restates the core
 * record -- which is exactly what the Admin form posts. */
function corePayload(current: Record<string, unknown>): Record<string, unknown> {
  const continent = current.continent as { id?: string } | undefined;
  return {
    continentId: continent?.id,
    name: current.name,
    slug: current.slug,
    pageHeading: current.pageHeading,
    shortDescription: current.shortDescription,
  };
}
function rows(response: { body: unknown }): Array<Record<string, unknown>> {
  const value = body(response).data;
  return Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];
}

describe('country taxonomy admin (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token = '';
  let countryId = '';
  let countrySlug = '';
  let otherCountryId = '';
  const subjectIds: string[] = [];
  const tagIds: string[] = [];
  const universityIds: string[] = [];
  const scholarshipIds: string[] = [];
  let courseId = '';
  const stamp = `${Date.now()}-${randomUUID().slice(0, 6)}`;

  const admin = (
    method: 'get' | 'post' | 'patch',
    path: string,
    payload?: Record<string, unknown>,
  ) => {
    const call = request(app.getHttpServer())
      [method](path)
      .set('Authorization', `Bearer ${token}`)
      .set('x-request-id', 'country-taxonomy-e2e');
    return payload ? call.send(payload) : call;
  };

  async function isoPair() {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const seed = randomUUID().replace(/[^a-f]/gi, '').toUpperCase().padEnd(6, 'X');
      const two = seed.slice(0, 2);
      const three = seed.slice(0, 3);
      const clash = await prisma.country.findFirst({
        where: {
          OR: [
            { iso2Code: two },
            { iso3Code: two },
            { iso2Code: three },
            { iso3Code: three },
          ],
        },
        select: { id: true },
      });
      if (!clash) return { two, three };
    }
    throw new Error('Unable to allocate unique ISO codes');
  }

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = fixture.createNestApplication(new ExpressAdapter());
    configureApplication(app);
    await app.init();
    prisma = app.get(PrismaService);

    const email =
      process.env.SEED_ADMIN_EMAIL ?? process.env.SUPER_ADMIN_EMAIL ?? 'admin@universta.local';
    const password = process.env.SEED_ADMIN_PASSWORD ?? process.env.SUPER_ADMIN_PASSWORD;
    if (!password) throw new Error('A local Super Admin password is required');
    const login = await request(app.getHttpServer())
      .post('/api/v1/admin/auth/login')
      .send({ email, password })
      .expect(200);
    token = String(record(login).accessToken);

    const continent = await prisma.continent.findFirstOrThrow({
      where: { status: 'ACTIVE', deletedAt: null },
    });

    for (const label of ['Alpha', 'Beta', 'Gamma']) {
      const subject = await prisma.subject.create({
        data: {
          name: `Taxonomy ${label} ${stamp}`,
          slug: `taxonomy-${label.toLowerCase()}-${stamp}`,
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
      });
      subjectIds.push(subject.id);
    }
    for (const label of ['Popular', 'Affordable']) {
      const tag = await prisma.countryTag.create({
        data: {
          name: `Taxonomy ${label} ${stamp}`,
          slug: `taxonomy-${label.toLowerCase()}-${stamp}`,
        },
      });
      tagIds.push(tag.id);
    }

    const first = await isoPair();
    countrySlug = `taxonomy-${stamp}`;
    const country = await admin('post', '/api/v1/admin/countries', {
      continentId: continent.id,
      name: `Taxonomy ${stamp}`,
      slug: countrySlug,
      iso2Code: first.two,
      iso3Code: first.three,
      pageHeading: 'Study in Taxonomy',
      shortDescription: 'Taxonomy fixture country',
      subjectIds: [subjectIds[0], subjectIds[1]],
      tagIds: [tagIds[0]],
    }).expect(201);
    countryId = String(record(country).id);

    const second = await isoPair();
    const other = await admin('post', '/api/v1/admin/countries', {
      continentId: continent.id,
      name: `Taxonomy Other ${stamp}`,
      slug: `taxonomy-other-${stamp}`,
      iso2Code: second.two,
      iso3Code: second.three,
      pageHeading: 'Study in Other',
      shortDescription: 'Second fixture, no taxonomy',
    }).expect(201);
    otherCountryId = String(record(other).id);

    // Linked records for the count columns.
    for (const index of [1, 2]) {
      const university = await prisma.university.create({
        data: {
          countryId,
          name: `Taxonomy University ${index} ${stamp}`,
          slug: `taxonomy-university-${index}-${stamp}`,
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
      });
      universityIds.push(university.id);
    }
    const level = await prisma.courseLevel.findFirstOrThrow({ where: { status: 'ACTIVE' } });
    const course = await prisma.course.create({
      data: {
        subjectId: subjectIds[0],
        courseLevelId: level.id,
        name: `Taxonomy Course ${stamp}`,
        slug: `taxonomy-course-${stamp}`,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
    courseId = course.id;
    await prisma.countryCourse.create({
      data: { countryId, courseId, availabilityStatus: 'AVAILABLE', status: 'PUBLISHED' },
    });
    const scholarship = await prisma.scholarship.create({
      data: {
        title: `Taxonomy Scholarship ${stamp}`,
        slug: `taxonomy-scholarship-${stamp}`,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
    scholarshipIds.push(scholarship.id);
    await prisma.scholarshipCountry.create({
      data: { scholarshipId: scholarship.id, countryId },
    });
  });

  afterAll(async () => {
    await prisma.scholarshipCountry.deleteMany({ where: { countryId } }).catch(() => undefined);
    await prisma.scholarship
      .deleteMany({ where: { id: { in: scholarshipIds } } })
      .catch(() => undefined);
    await prisma.countryCourse.deleteMany({ where: { countryId } }).catch(() => undefined);
    if (courseId)
      await prisma.course.deleteMany({ where: { id: courseId } }).catch(() => undefined);
    await prisma.university
      .deleteMany({ where: { id: { in: universityIds } } })
      .catch(() => undefined);
    await prisma.country
      .deleteMany({ where: { id: { in: [countryId, otherCountryId].filter(Boolean) } } })
      .catch(() => undefined);
    await prisma.subject.deleteMany({ where: { id: { in: subjectIds } } }).catch(() => undefined);
    await prisma.countryTag.deleteMany({ where: { id: { in: tagIds } } }).catch(() => undefined);
    await app.close();
  });

  it('carries assigned subjects, tags, continent and linked counts on a list row', async () => {
    const response = await admin(
      'get',
      `/api/v1/admin/countries?q=${countrySlug}&limit=5`,
    ).expect(200);
    const row = rows(response).find((item) => item.id === countryId);
    expect(row).toBeTruthy();

    const subjects = row!.subjects as Array<{ id: string; name: string }>;
    expect(subjects.map((item) => item.id).sort()).toEqual(
      [subjectIds[0], subjectIds[1]].sort(),
    );
    expect(subjects.every((item) => typeof item.name === 'string')).toBe(true);

    const tags = row!.tags as Array<{ id: string; name: string }>;
    expect(tags.map((item) => item.id)).toEqual([tagIds[0]]);

    const continent = row!.continent as { name?: string };
    expect(typeof continent.name).toBe('string');

    expect(row!.linkedCounts).toEqual({
      universities: 2,
      courses: 1,
      scholarships: 1,
    });
  });

  it('filters countries by directly assigned subject', async () => {
    const match = await admin(
      'get',
      `/api/v1/admin/countries?subjectId=${subjectIds[0]}&limit=50`,
    ).expect(200);
    const ids = rows(match).map((item) => item.id);
    expect(ids).toContain(countryId);
    expect(ids).not.toContain(otherCountryId);

    // Gamma is assigned to nobody, so it must not match on course lineage.
    const empty = await admin(
      'get',
      `/api/v1/admin/countries?subjectId=${subjectIds[2]}&limit=50`,
    ).expect(200);
    expect(rows(empty).map((item) => item.id)).not.toContain(countryId);
  });

  it('filters countries by tag', async () => {
    const match = await admin(
      'get',
      `/api/v1/admin/countries?tagId=${tagIds[0]}&limit=50`,
    ).expect(200);
    expect(rows(match).map((item) => item.id)).toContain(countryId);

    const other = await admin(
      'get',
      `/api/v1/admin/countries?tagId=${tagIds[1]}&limit=50`,
    ).expect(200);
    expect(rows(other).map((item) => item.id)).not.toContain(countryId);
  });

  it('intersects subject and tag filters rather than unioning them', async () => {
    const both = await admin(
      'get',
      `/api/v1/admin/countries?subjectId=${subjectIds[0]}&tagId=${tagIds[0]}&limit=50`,
    ).expect(200);
    expect(rows(both).map((item) => item.id)).toContain(countryId);

    const mismatched = await admin(
      'get',
      `/api/v1/admin/countries?subjectId=${subjectIds[0]}&tagId=${tagIds[1]}&limit=50`,
    ).expect(200);
    expect(rows(mismatched).map((item) => item.id)).not.toContain(countryId);
  });

  it('replaces the subject and tag sets rather than appending to them', async () => {
    const before = record(await admin('get', `/api/v1/admin/countries/${countryId}`).expect(200));
    await admin('patch', `/api/v1/admin/countries/${countryId}`, {
      ...corePayload(before),
      subjectIds: [subjectIds[2]],
      tagIds: [tagIds[1]],
      expectedUpdatedAt: before.updatedAt,
    }).expect(200);

    const after = record(await admin('get', `/api/v1/admin/countries/${countryId}`).expect(200));
    expect(after.subjectIds).toEqual([subjectIds[2]]);
    expect(after.tagIds).toEqual([tagIds[1]]);

    const joins = await prisma.countrySubject.findMany({ where: { countryId } });
    expect(joins).toHaveLength(1);
  });

  it('clears the sets when given empty arrays', async () => {
    const before = record(await admin('get', `/api/v1/admin/countries/${countryId}`).expect(200));
    await admin('patch', `/api/v1/admin/countries/${countryId}`, {
      ...corePayload(before),
      subjectIds: [],
      tagIds: [],
      expectedUpdatedAt: before.updatedAt,
    }).expect(200);

    const after = record(await admin('get', `/api/v1/admin/countries/${countryId}`).expect(200));
    expect(after.subjectIds).toEqual([]);
    expect(after.tagIds).toEqual([]);
    // Removing a country's subject must not disturb Course -> Subject.
    const course = await prisma.course.findUniqueOrThrow({ where: { id: courseId } });
    expect(course.subjectId).toBe(subjectIds[0]);
  });

  it('returns the existing active tag instead of a duplicate', async () => {
    const first = record(
      await admin('post', '/api/v1/admin/country-tags', {
        name: `Duplicate Tag ${stamp}`,
      }).expect(201),
    );
    tagIds.push(String(first.id));
    const again = record(
      await admin('post', '/api/v1/admin/country-tags', {
        // Different casing and spacing, same term.
        name: `  duplicate tag ${stamp}  `,
      }),
    );
    expect(again.id).toBe(first.id);
    const all = await prisma.countryTag.findMany({
      where: { name: { contains: `Duplicate Tag ${stamp}` } },
    });
    expect(all).toHaveLength(1);
  });

  it('rejects a duplicate subject slug rather than creating a second one', async () => {
    const created = record(
      await admin('post', '/api/v1/admin/subjects', {
        name: `Dedupe Subject ${stamp}`,
        slug: `dedupe-subject-${stamp}`,
      }).expect(201),
    );
    subjectIds.push(String(created.id));
    const conflict = await admin('post', '/api/v1/admin/subjects', {
      name: `Totally Different ${stamp}`,
      slug: `dedupe-subject-${stamp}`,
    });
    expect(conflict.status).toBe(409);
    const errorBody = body(conflict).error as { code?: string };
    expect(errorBody.code).toBe('SUBJECT_CONFLICT');
  });

  it('exposes subject usage counts and sub-subjects for the picker', async () => {
    const response = await admin(
      'get',
      `/api/v1/admin/subjects?q=Taxonomy%20Alpha%20${stamp}&limit=10`,
    ).expect(200);
    const subject = rows(response).find((item) => item.id === subjectIds[0]);
    expect(subject).toBeTruthy();
    // Alpha owns the fixture course, so "most used" has a real number to sort on.
    expect(subject!.courseCount).toBe(1);
    expect(Array.isArray(subject!.subSubjects)).toBe(true);
  });

  it('exposes the client contract on the public country payload', async () => {
    // Re-assign a subject: the earlier tests deliberately left the set empty.
    const current = record(
      await admin('get', `/api/v1/admin/countries/${countryId}`).expect(200),
    );
    await admin('patch', `/api/v1/admin/countries/${countryId}`, {
      ...corePayload(current),
      subjectIds: [subjectIds[0], subjectIds[1]],
      expectedUpdatedAt: current.updatedAt,
    }).expect(200);
    await admin('post', `/api/v1/admin/countries/${countryId}/publish`).catch(
      () => undefined,
    );

    const detail = record(
      await request(app.getHttpServer())
        .get(`/api/v1/countries/${countrySlug}`)
        .expect(200),
    );
    // Authored assignments, in the order the join stores them.
    const subjects = detail.subjects as Array<{ id: string; slug: string }>;
    expect(subjects.map((row) => row.id)).toEqual([subjectIds[0], subjectIds[1]]);
    expect(subjects.every((row) => typeof row.slug === 'string')).toBe(true);

    for (const key of [
      'tagline',
      'capitalCity',
      'officialLanguage',
      'currency',
      'overview',
    ])
      expect(key in detail).toBe(true);

    // Admin-only identity stays out of the public payload.
    expect(detail.externalUid).toBeUndefined();
    expect(detail.tagIds).toBeUndefined();
    expect(detail.linkedCounts).toBeUndefined();
  });

  it('keeps taxonomy writes off the public surface', async () => {
    const publicList = await request(app.getHttpServer())
      .get('/api/v1/countries?limit=5')
      .expect(200);
    for (const row of rows(publicList)) {
      expect(row.linkedCounts).toBeUndefined();
      expect(row.tagIds).toBeUndefined();
    }
    await request(app.getHttpServer())
      .post('/api/v1/admin/country-tags')
      .send({ name: `Unauthorised ${stamp}` })
      .expect(401);
  });
});
