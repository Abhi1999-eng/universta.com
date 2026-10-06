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
 * Where a subject and a specialization can be studied, as their public
 * records report it.
 *
 * Every destination starts out linked to every subject, so ordered by that
 * link the band opened A to Z on countries that teach none of it, and its
 * figure said 205 where 82 taught it. The records now lead with the places
 * that teach it, most programmes first, carry the count on each, and keep
 * `availableCountryCount` to the ones that teach it. Study levels come in
 * the order a student climbs them.
 */

type Json = Record<string, unknown>;
const record = (response: { body: unknown }): Json => {
  const value = (response.body as { data?: unknown } | null)?.data;
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Json)
    : {};
};

describe('subject and specialization destinations (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const stamp = randomUUID().slice(0, 8);
  const subjectSlug = `dest-subject-${stamp}`;
  const branchSlug = `dest-branch-${stamp}`;
  let subjectId = '';
  let branchId = '';
  const courseIds: string[] = [];
  /** Three live destinations: two teach it, one only lists it. */
  let busy = { id: '', slug: '' };
  let quiet = { id: '', slug: '' };
  let listed = { id: '', slug: '' };

  const get = (path: string) =>
    request(app.getHttpServer()).get(path).set('x-request-id', `dest-${stamp}`);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication(new ExpressAdapter());
    configureApplication(app);
    await app.init();
    prisma = app.get(PrismaService);

    const countries = await prisma.country.findMany({
      where: { status: 'PUBLISHED', deletedAt: null },
      select: { id: true, slug: true },
      orderBy: { name: 'asc' },
      take: 3,
    });
    if (countries.length < 3)
      throw new Error('The test database needs three published countries');
    /* The one only listed sorts first by name, so leading with the busy
       one has to come from the counts, not the alphabet. */
    [listed, quiet, busy] = countries;

    const [phd, bachelors] = await Promise.all([
      prisma.courseLevel.findFirstOrThrow({ where: { code: 'PHD' } }),
      prisma.courseLevel.findFirstOrThrow({ where: { code: 'UG' } }),
    ]);

    const subject = await prisma.subject.create({
      data: {
        name: `Destinations Subject ${stamp}`,
        slug: subjectSlug,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
    subjectId = subject.id;
    const branch = await prisma.subSubject.create({
      data: {
        subjectId,
        name: `Destinations Branch ${stamp}`,
        slug: branchSlug,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
    branchId = branch.id;

    for (const country of [listed, quiet, busy]) {
      await prisma.countrySubject.create({
        data: { countryId: country.id, subjectId },
      });
      await prisma.countrySubSubject.create({
        data: { countryId: country.id, subSubjectId: branchId },
      });
    }

    /* PhD first on purpose: the levels must not come back in the order the
       rows were written. Two programmes in the busy country, one in the
       quiet one. */
    const plan = [
      { level: phd.id, countries: [busy.id] },
      { level: bachelors.id, countries: [busy.id, quiet.id] },
    ];
    for (const [index, entry] of plan.entries()) {
      const course = await prisma.course.create({
        data: {
          subjectId,
          subSubjectId: branchId,
          courseLevelId: entry.level,
          name: `Destinations Course ${index} ${stamp}`,
          slug: `dest-course-${index}-${stamp}`,
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
      });
      courseIds.push(course.id);
      for (const countryId of entry.countries)
        await prisma.countryCourse.create({
          data: { countryId, courseId: course.id, status: 'ACTIVE' },
        });
    }
  });

  afterAll(async () => {
    await prisma.countryCourse
      .deleteMany({ where: { courseId: { in: courseIds } } })
      .catch(() => undefined);
    await prisma.course
      .deleteMany({ where: { id: { in: courseIds } } })
      .catch(() => undefined);
    await prisma.countrySubSubject
      .deleteMany({ where: { subSubjectId: branchId } })
      .catch(() => undefined);
    await prisma.countrySubject
      .deleteMany({ where: { subjectId } })
      .catch(() => undefined);
    await prisma.subSubject
      .deleteMany({ where: { subjectId } })
      .catch(() => undefined);
    await prisma.subject
      .deleteMany({ where: { id: subjectId } })
      .catch(() => undefined);
    await app.close();
  });

  it('leads a subject’s destinations with the places that teach it', async () => {
    const detail = record(
      await get(`/api/v1/subjects/${subjectSlug}`).expect(200),
    );
    const countries = detail.countries as Json[];
    expect(countries.map((row) => row.slug)).toEqual([
      busy.slug,
      quiet.slug,
      listed.slug,
    ]);
    expect(countries.map((row) => row.courseCount)).toEqual([2, 1, 0]);
    expect(detail.availableCountryCount).toBe(2);
  });

  it('does the same for a specialization', async () => {
    const detail = record(
      await get(
        `/api/v1/subjects/${subjectSlug}/specializations/${branchSlug}`,
      ).expect(200),
    );
    const countries = detail.countries as Json[];
    expect(countries.map((row) => row.slug)).toEqual([
      busy.slug,
      quiet.slug,
      listed.slug,
    ]);
    expect(countries.map((row) => row.courseCount)).toEqual([2, 1, 0]);
    expect(detail.availableCountryCount).toBe(2);
  });

  it('gives a subject’s levels in the order a student climbs them', async () => {
    const detail = record(
      await get(`/api/v1/subjects/${subjectSlug}`).expect(200),
    );
    expect((detail.levels as Json[]).map((row) => row.code)).toEqual([
      'UG',
      'PHD',
    ]);
    expect(
      (detail.courseCountsByLevel as Json[]).map(
        (row) => (row.level as Json).code,
      ),
    ).toEqual(['UG', 'PHD']);
    const [branch] = detail.subSubjects as Json[];
    expect((branch.levels as Json[]).map((row) => row.code)).toEqual([
      'UG',
      'PHD',
    ]);
  });

  it('orders the levels on the flat specializations list too', async () => {
    const response = await get(
      `/api/v1/specializations?subject=${subjectSlug}`,
    ).expect(200);
    const [row] = (response.body as { data: Json[] }).data;
    expect((row.levels as Json[]).map((level) => level.code)).toEqual([
      'UG',
      'PHD',
    ]);
    expect(row.publishedCourseCount).toBe(2);
  });
});
