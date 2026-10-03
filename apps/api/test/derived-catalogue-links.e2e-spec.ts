import { ExpressAdapter } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  DERIVED,
  EDITORIAL,
} from '../src/countries/country-taxonomy-reconciler';

/**
 * What a destination offers, and therefore which subjects it teaches, is
 * worked out from the offerings its universities publish -- and it is
 * worked out when the editor saves, not when the next deployment runs.
 *
 * These go through the admin HTTP API rather than the reconcilers, because
 * the reconcilers were already right and the bug was that nothing called
 * them. An editor adding an institution and publishing its programmes is
 * the case that mattered and the one that did nothing at all.
 *
 * Creation order is varied on purpose. A subject can exist long before the
 * destination or arrive long after it, and neither is the order anybody
 * actually works in, so neither may decide whether the links appear.
 */
function record(response: { body: unknown }): Record<string, unknown> {
  const value = (response.body as { data?: unknown } | null)?.data;
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

describe('derived catalogue links (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token = '';
  let continentId = '';
  let courseLevelId = '';
  let studyModeId = '';
  const stamp = `${Date.now()}-${randomUUID().slice(0, 6)}`;

  const admin = (
    method: 'get' | 'post' | 'patch' | 'delete' | 'put',
    path: string,
    payload?: Record<string, unknown>,
  ) => {
    const call = request(app.getHttpServer())
      [method](path)
      .set('Authorization', `Bearer ${token}`)
      .set('x-request-id', 'derived-links-e2e');
    return payload ? call.send(payload) : call;
  };

  /** Asserts a status and, when it differs, says what the API objected to --
   * a bare `.expect(201)` hides the one thing worth reading. */
  async function expectStatus(call: request.Test, status: number) {
    const response = await call;
    if (response.status !== status)
      throw new Error(
        `Expected ${status}, got ${response.status}: ${JSON.stringify(
          response.body,
        )}`,
      );
    return response;
  }

  /** A published destination. ISO codes are left out: they are optional,
   * nothing here reads them, and the local database has long since used up
   * the pairs a random allocator can offer. */
  async function makeCountry(label: string) {
    const response = await expectStatus(
      admin('post', '/api/v1/admin/countries', {
        continentId,
        name: `Derived ${label} ${stamp}`,
        slug: `derived-${label}-${stamp}`,
        pageHeading: `Study in ${label}`,
        shortDescription: 'Derived links fixture',
      }),
      201,
    );
    const id = String(record(response).id);
    await expectStatus(
      admin('post', `/api/v1/admin/countries/${id}/publish`, {}),
      201,
    );
    return id;
  }

  async function makeSubject(label: string) {
    const response = await expectStatus(
      admin('post', '/api/v1/admin/subjects', {
        name: `Derived ${label} ${stamp}`,
        slug: `derived-${label}-${stamp}`,
        shortDescription: 'Derived links fixture subject',
      }),
      201,
    );
    const id = String(record(response).id);
    await expectStatus(
      admin('post', `/api/v1/admin/subjects/${id}/publish`, {}),
      201,
    );
    return id;
  }

  /**
   * A course, left in draft.
   *
   * It cannot be published yet, and should not be: the readiness gate asks
   * for a destination that offers it, and with the mapping now worked out
   * from offerings that means asking for an institution that teaches it.
   * The order an editor works in is course, then institution, then
   * offering, and the course goes live once something stands behind it.
   */
  async function makeCourse(label: string, subjectId: string) {
    const response = await expectStatus(
      admin('post', '/api/v1/admin/courses', {
        subjectId,
        courseLevelId,
        name: `Derived ${label} ${stamp}`,
        slug: `derived-course-${label}-${stamp}`,
        shortDescription: 'Derived links fixture course',
      }),
      201,
    );
    const id = String(record(response).id);
    await expectStatus(
      admin('put', `/api/v1/admin/courses/${id}/study-modes`, {
        studyModeIds: [studyModeId],
      }),
      200,
    );
    return id;
  }

  const publishCourse = (id: string) =>
    expectStatus(admin('post', `/api/v1/admin/courses/${id}/publish`, {}), 201);

  async function makeUniversity(label: string, countryId: string) {
    const response = await expectStatus(
      admin('post', '/api/v1/admin/phase1/universities', {
        countryId,
        name: `Derived ${label} University ${stamp}`,
        slug: `derived-uni-${label}-${stamp}`,
        shortDescription: 'Derived links fixture university',
      }),
      201,
    );
    const id = String(record(response).id);
    await expectStatus(
      admin('post', `/api/v1/admin/phase1/universities/${id}/publish`, {}),
      201,
    );
    return id;
  }

  /** A published offering: this institution teaches this course, at a price. */
  async function makeOffering(
    label: string,
    universityId: string,
    genericCourseId: string,
    tuition?: { min: number; max: number; currencyCode: string },
  ) {
    const response = await expectStatus(
      admin('post', '/api/v1/admin/phase1/offerings', {
        universityId,
        genericCourseId,
        name: `Derived ${label} Offering ${stamp}`,
        slug: `derived-offering-${label}-${stamp}`,
        ...(tuition
          ? {
              tuitionMin: tuition.min,
              tuitionMax: tuition.max,
              currencyCode: tuition.currencyCode,
            }
          : {}),
      }),
      201,
    );
    const id = String(record(response).id);
    await expectStatus(
      admin('post', `/api/v1/admin/phase1/offerings/${id}/publish`, {}),
      201,
    );
    return id;
  }

  /** One destination teaching one course, however it got there. */
  const mapping = (countryId: string, courseId: string) =>
    prisma.countryCourse.findFirst({ where: { countryId, courseId } });
  const subjectLink = (countryId: string, subjectId: string) =>
    prisma.countrySubject.findFirst({ where: { countryId, subjectId } });

  /** The whole chain, in the order an editor works in. */
  async function teach(label: string) {
    const countryId = await makeCountry(label);
    const subjectId = await makeSubject(label);
    const courseId = await makeCourse(label, subjectId);
    const universityId = await makeUniversity(label, countryId);
    const offeringId = await makeOffering(label, universityId, courseId);
    await publishCourse(courseId);
    return { countryId, subjectId, courseId, universityId, offeringId };
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
    if (!password) throw new Error('A local Super Admin password is required');
    const login = await request(app.getHttpServer())
      .post('/api/v1/admin/auth/login')
      .send({ email, password })
      .expect(200);
    token = String(record(login).accessToken);

    continentId = (
      await prisma.continent.findFirstOrThrow({
        where: { status: 'ACTIVE', deletedAt: null },
      })
    ).id;
    courseLevelId = (
      await prisma.courseLevel.findFirstOrThrow({ where: { status: 'ACTIVE' } })
    ).id;
    studyModeId = (
      await prisma.studyMode.findFirstOrThrow({ where: { status: 'ACTIVE' } })
    ).id;
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  it('puts a course in a destination the moment an offering is published', async () => {
    const countryId = await makeCountry('a');
    const subjectId = await makeSubject('a');
    const courseId = await makeCourse('a', subjectId);
    const universityId = await makeUniversity('a', countryId);

    /* An institution with no published programme teaches nothing, and the
       destination should not claim otherwise. */
    expect(await mapping(countryId, courseId)).toBeNull();

    await makeOffering('a', universityId, courseId);

    expect(await mapping(countryId, courseId)).toMatchObject({
      source: DERIVED,
      deletedAt: null,
    });
  }, 60_000);

  it('starts a destination with every subject, and a subject in every destination', async () => {
    /* Either order: the subject is there when the country is born, or the
       country is there when the subject is. Neither has a course yet, so
       both links are listings and nothing more. */
    const before = await makeSubject('l1');
    const countryId = await makeCountry('l');
    const after = await makeSubject('l2');

    expect(await subjectLink(countryId, before)).toMatchObject({
      source: EDITORIAL,
    });
    expect(await subjectLink(countryId, after)).toMatchObject({
      source: EDITORIAL,
    });
  }, 60_000);

  it('brings back a subject an editor unticked, once a course is taught in it', async () => {
    const countryId = await makeCountry('m');
    const subjectId = await makeSubject('m');
    const current = record(
      await expectStatus(
        admin('get', `/api/v1/admin/countries/${countryId}`),
        200,
      ),
    );
    await expectStatus(
      admin('patch', `/api/v1/admin/countries/${countryId}`, {
        continentId,
        name: current.name,
        slug: current.slug,
        pageHeading: current.pageHeading,
        shortDescription: current.shortDescription,
        subjectIds: [],
      }),
      200,
    );
    expect(await subjectLink(countryId, subjectId)).toBeNull();

    /* Unticking a box cannot make a course untrue. */
    const courseId = await makeCourse('m', subjectId);
    const universityId = await makeUniversity('m', countryId);
    await makeOffering('m', universityId, courseId);
    await publishCourse(courseId);

    expect(await subjectLink(countryId, subjectId)).toMatchObject({
      source: DERIVED,
    });
  }, 90_000);

  it('gives the destination the subject that course belongs to', async () => {
    const { countryId, subjectId } = await teach('b');
    expect(await subjectLink(countryId, subjectId)).toMatchObject({
      source: DERIVED,
    });
  }, 60_000);

  it('works the same when the subject existed long before the destination', async () => {
    const subjectId = await makeSubject('c');
    const courseId = await makeCourse('c', subjectId);
    const countryId = await makeCountry('c');
    const universityId = await makeUniversity('c', countryId);
    await makeOffering('c', universityId, courseId);
    await publishCourse(courseId);

    expect(await mapping(countryId, courseId)).toMatchObject({
      source: DERIVED,
    });
    expect(await subjectLink(countryId, subjectId)).toMatchObject({
      source: DERIVED,
    });
  }, 60_000);

  it('works the same when the subject arrives long after the destination', async () => {
    const countryId = await makeCountry('d');
    const subjectId = await makeSubject('d');
    const courseId = await makeCourse('d', subjectId);
    const universityId = await makeUniversity('d', countryId);
    await makeOffering('d', universityId, courseId);
    await publishCourse(courseId);

    expect(await mapping(countryId, courseId)).toMatchObject({
      source: DERIVED,
    });
    expect(await subjectLink(countryId, subjectId)).toMatchObject({
      source: DERIVED,
    });
  }, 60_000);

  it('maps the destination once however many universities teach there', async () => {
    const countryId = await makeCountry('e');
    const subjectId = await makeSubject('e');
    const courseId = await makeCourse('e', subjectId);
    const first = await makeUniversity('e1', countryId);
    const second = await makeUniversity('e2', countryId);
    await makeOffering('e1', first, courseId);
    await makeOffering('e2', second, courseId);
    await publishCourse(courseId);

    /* Two institutions are two offerings and one fact about the country. */
    expect(
      await prisma.countryCourse.findMany({ where: { countryId, courseId } }),
    ).toHaveLength(1);
  }, 90_000);

  it('quotes a range that spans what both universities charge', async () => {
    const countryId = await makeCountry('f');
    const subjectId = await makeSubject('f');
    const courseId = await makeCourse('f', subjectId);
    const first = await makeUniversity('f1', countryId);
    const second = await makeUniversity('f2', countryId);
    await makeOffering('f1', first, courseId, {
      min: 200000,
      max: 250000,
      currencyCode: 'INR',
    });
    await makeOffering('f2', second, courseId, {
      min: 400000,
      max: 450000,
      currencyCode: 'INR',
    });
    await publishCourse(courseId);

    const link = await mapping(countryId, courseId);
    expect(Number(link?.indicativeTuitionMin)).toBe(200000);
    expect(Number(link?.indicativeTuitionMax)).toBe(450000);
    expect(link?.currencyCode).toBe('INR');
  }, 90_000);

  it('takes the course away when its last offering is withdrawn', async () => {
    const { countryId, courseId, subjectId, offeringId } = await teach('g');
    expect(await mapping(countryId, courseId)).toMatchObject({
      deletedAt: null,
    });

    await expectStatus(
      admin(
        'post',
        `/api/v1/admin/phase1/offerings/${offeringId}/unpublish`,
        {},
      ),
      201,
    );

    /* The course goes; the subject does not. Every destination starts out
       listing every subject, so what the last course takes with it is the
       claim that something is taught here -- the link is handed back to the
       editor rather than deleted, or one withdrawn programme would cost a
       destination a field for good. */
    expect((await mapping(countryId, courseId))?.deletedAt).toBeInstanceOf(
      Date,
    );
    expect(await subjectLink(countryId, subjectId)).toMatchObject({
      source: EDITORIAL,
    });
  }, 60_000);

  it('moves the course when the university moves country', async () => {
    const {
      countryId: from,
      courseId,
      subjectId,
      universityId,
    } = await teach('h');
    const to = await makeCountry('h2');

    expect(await mapping(from, courseId)).toMatchObject({ deletedAt: null });

    await expectStatus(
      admin('patch', `/api/v1/admin/phase1/universities/${universityId}`, {
        countryId: to,
      }),
      200,
    );

    expect((await mapping(from, courseId))?.deletedAt).toBeInstanceOf(Date);
    expect(await mapping(to, courseId)).toMatchObject({ deletedAt: null });
    expect(await subjectLink(to, subjectId)).toMatchObject({ source: DERIVED });
    /* Still listed where it left, and no longer claimed as taught there. */
    expect(await subjectLink(from, subjectId)).toMatchObject({
      source: EDITORIAL,
    });
  }, 90_000);

  it('withdraws a destination’s courses when the university is unpublished', async () => {
    const { countryId, courseId, universityId } = await teach('i');

    await expectStatus(
      admin(
        'post',
        `/api/v1/admin/phase1/universities/${universityId}/unpublish`,
        {},
      ),
      201,
    );

    expect((await mapping(countryId, courseId))?.deletedAt).toBeInstanceOf(
      Date,
    );
  }, 60_000);

  it('follows the course to its new subject', async () => {
    const { countryId, courseId, subjectId: was } = await teach('j');
    const now = await makeSubject('j2');

    expect(await subjectLink(countryId, was)).toMatchObject({
      source: DERIVED,
    });

    const current = record(
      await expectStatus(
        admin('get', `/api/v1/admin/courses/${courseId}`),
        200,
      ),
    );
    await expectStatus(
      admin('patch', `/api/v1/admin/courses/${courseId}`, {
        subjectId: now,
        courseLevelId,
        name: current.name,
        slug: current.slug,
        shortDescription: current.shortDescription,
      }),
      200,
    );

    /* The old claim has to go, or the destination keeps teaching a subject
       nothing of its own covers any more. The link itself stays, as the
       listing it was before the course arrived. */
    expect(await subjectLink(countryId, was)).toMatchObject({
      source: EDITORIAL,
    });
    expect(await subjectLink(countryId, now)).toMatchObject({
      source: DERIVED,
    });
  }, 90_000);

  it('does not let a country save wipe what was worked out', async () => {
    const { countryId, subjectId: derivedSubject } = await teach('k');
    const typedSubject = await makeSubject('k2');

    expect(await subjectLink(countryId, derivedSubject)).toMatchObject({
      source: DERIVED,
    });

    /* The country editor posts the subjects it was shown. It may replace
       only what an editor put there: a derived row states what this
       destination's courses cover, and a form cannot make that untrue. */
    const current = record(
      await expectStatus(
        admin('get', `/api/v1/admin/countries/${countryId}`),
        200,
      ),
    );
    await expectStatus(
      admin('patch', `/api/v1/admin/countries/${countryId}`, {
        continentId,
        name: current.name,
        slug: current.slug,
        pageHeading: current.pageHeading,
        shortDescription: current.shortDescription,
        subjectIds: [typedSubject],
      }),
      200,
    );

    expect(await subjectLink(countryId, derivedSubject)).toMatchObject({
      source: DERIVED,
    });
    expect(await subjectLink(countryId, typedSubject)).toMatchObject({
      source: EDITORIAL,
    });
  }, 90_000);
});
