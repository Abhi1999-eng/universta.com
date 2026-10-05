import type { INestApplication } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * The universities that teach one specialization, in one destination when
 * asked -- against a real database.
 *
 * A specialization's page in a destination could only name the universities
 * teaching its whole subject there, because the university list narrows to
 * a subject and not to a branch of one. Here two universities in one
 * destination teach the subject, only one of them teaches the branch, and a
 * third, in another destination, teaches the branch too.
 */

type Json = Record<string, unknown>;
const body = (response: { body: unknown }): Json =>
  (response.body ?? {}) as Json;
const rows = (response: { body: unknown }): Json[] => {
  const data = body(response).data;
  return Array.isArray(data) ? (data as Json[]) : [];
};

describe('the universities teaching a specialization (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const suffix = randomUUID().slice(0, 8);
  const here = `spec-unis-here-${suffix}`;
  const there = `spec-unis-there-${suffix}`;
  const subjectSlug = `spec-unis-subject-${suffix}`;
  const branch = `spec-unis-branch-${suffix}`;
  const countryIds: string[] = [];
  const universityIds: string[] = [];
  const courseIds: string[] = [];
  let subjectId = '';

  const get = (path: string, query: Record<string, string> = {}) =>
    request(app.getHttpServer())
      .get(path)
      .query(query)
      .set('x-request-id', `spec-unis-${suffix}`);
  const address = `/api/v1/subjects/${subjectSlug}/specializations/${branch}/universities`;

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = fixture.createNestApplication(new ExpressAdapter());
    configureApplication(app);
    await app.init();
    prisma = app.get(PrismaService);

    const continent = await prisma.continent.findFirst({
      where: { deletedAt: null },
    });
    const level = await prisma.courseLevel.findFirst({});
    if (!continent || !level)
      throw new Error('Continent and CourseLevel fixtures are required');
    const now = new Date();

    for (const slug of [here, there]) {
      const country = await prisma.country.create({
        data: {
          continentId: continent.id,
          name: `Spec Unis ${slug}`,
          pageHeading: `Study in ${slug}`,
          slug,
          shortDescription: 'Fictional country used only for e2e coverage.',
          status: 'PUBLISHED',
          publishedAt: now,
        },
      });
      countryIds.push(country.id);
    }

    const subject = await prisma.subject.create({
      data: {
        name: `Spec Unis Subject ${suffix}`,
        slug: subjectSlug,
        status: 'PUBLISHED',
        publishedAt: now,
      },
    });
    subjectId = subject.id;
    const specialization = await prisma.subSubject.create({
      data: {
        subjectId,
        name: `Spec Unis Branch ${suffix}`,
        slug: branch,
        status: 'PUBLISHED',
        publishedAt: now,
      },
    });

    const course = async (name: string, subSubjectId: string | null) => {
      const created = await prisma.course.create({
        data: {
          subjectId,
          subSubjectId,
          courseLevelId: level.id,
          name: `${name} ${suffix}`,
          slug: `${name.toLowerCase().replaceAll(' ', '-')}-${suffix}`,
          status: 'PUBLISHED',
          publishedAt: now,
        },
      });
      courseIds.push(created.id);
      return created.id;
    };
    const inBranch = await course('Spec Unis Branch Course', specialization.id);
    const subjectOnly = await course('Spec Unis Subject Course', null);

    const university = async (
      countryId: string,
      name: string,
      extra: { qsRanking?: number; city?: string } = {},
    ) => {
      const created = await prisma.university.create({
        data: {
          countryId,
          name: `${name} ${suffix}`,
          slug: `${name.toLowerCase().replaceAll(' ', '-')}-${suffix}`,
          status: 'PUBLISHED',
          publishedAt: now,
          qsRanking: extra.qsRanking ?? null,
          ...(extra.city
            ? {
                campuses: {
                  create: [
                    {
                      name: 'Main campus',
                      slug: `main-${name.toLowerCase().replaceAll(' ', '-')}-${suffix}`,
                      city: extra.city,
                      status: 'ACTIVE',
                      displayOrder: 1,
                    },
                  ],
                },
              }
            : {}),
        },
      });
      universityIds.push(created.id);
      return created.id;
    };
    const offering = (
      universityId: string,
      genericCourseId: string,
      name: string,
      status = 'PUBLISHED',
    ) =>
      prisma.universityCourseOffering.create({
        data: {
          universityId,
          genericCourseId,
          name: `${name} ${suffix}`,
          slug: `${name.toLowerCase().replaceAll(' ', '-')}-${suffix}`,
          status,
          publishedAt: status === 'PUBLISHED' ? now : null,
          courseLevelId: level.id,
        },
      });

    /* Here: one teaches the branch, one only the subject, one has the branch
       in draft. Unranked "Alpha" sorts after ranked "Zulu". */
    const alpha = await university(countryIds[0], 'Alpha Spec Unis', {
      city: 'Harbour Town',
    });
    const zulu = await university(countryIds[0], 'Zulu Spec Unis', {
      qsRanking: 12,
    });
    const subjectOnlyUni = await university(countryIds[0], 'Broad Spec Unis');
    const draftUni = await university(countryIds[0], 'Draft Spec Unis');
    await offering(alpha, inBranch, 'Alpha Branch Offering');
    await offering(zulu, inBranch, 'Zulu Branch Offering');
    await offering(subjectOnlyUni, subjectOnly, 'Broad Subject Offering');
    await offering(draftUni, inBranch, 'Draft Branch Offering', 'DRAFT');
    /* There: one more teaching the branch. */
    const far = await university(countryIds[1], 'Far Spec Unis');
    await offering(far, inBranch, 'Far Branch Offering');
  });

  afterAll(async () => {
    if (universityIds.length) {
      await prisma.universityCourseOffering.deleteMany({
        where: { universityId: { in: universityIds } },
      });
      await prisma.universityCampus.deleteMany({
        where: { universityId: { in: universityIds } },
      });
      await prisma.university.deleteMany({
        where: { id: { in: universityIds } },
      });
    }
    if (courseIds.length)
      await prisma.course.deleteMany({ where: { id: { in: courseIds } } });
    if (subjectId) {
      await prisma.subSubject.deleteMany({ where: { subjectId } });
      await prisma.subject.deleteMany({ where: { id: subjectId } });
    }
    if (countryIds.length)
      await prisma.country.deleteMany({ where: { id: { in: countryIds } } });
    await app.close();
  });

  it('names only the universities teaching the branch in that destination', async () => {
    const response = await get(address, { country: here }).expect(200);
    expect(rows(response).map((row) => row.name)).toEqual([
      /* Ranked first, then A to Z. Not the one teaching only the subject,
         not the one whose offering is a draft, not the one elsewhere. */
      `Zulu Spec Unis ${suffix}`,
      `Alpha Spec Unis ${suffix}`,
    ]);
    expect(body(response).meta).toEqual({ total: 2, limit: 6 });
  });

  it("gives each one's address and city", async () => {
    const response = await get(address, { country: here }).expect(200);
    const alpha = rows(response).find((row) =>
      String(row.slug).startsWith('alpha'),
    );
    expect(alpha).toMatchObject({
      slug: `alpha-spec-unis-${suffix}`,
      city: 'Harbour Town',
      qsRanking: null,
    });
  });

  it('counts every destination when none is named', async () => {
    const response = await get(address).expect(200);
    expect(body(response).meta).toMatchObject({ total: 3 });
  });

  it('names as many as asked, and still counts them all', async () => {
    const response = await get(address, { country: here, limit: '1' }).expect(
      200,
    );
    expect(rows(response)).toHaveLength(1);
    expect(body(response).meta).toEqual({ total: 2, limit: 1 });
  });

  it('is empty, not an error, for a destination teaching none of it', async () => {
    const response = await get(address, {
      country: `nowhere-${suffix}`,
    }).expect(200);
    expect(rows(response)).toEqual([]);
    expect(body(response).meta).toMatchObject({ total: 0 });
  });

  it('404s for a branch that is not under this subject', async () => {
    const response = await get(
      `/api/v1/subjects/${subjectSlug}/specializations/not-a-branch-${suffix}/universities`,
    ).expect(404);
    expect((body(response).error as Json).code).toBe(
      'SPECIALIZATION_NOT_FOUND',
    );
  });

  it('refuses a destination that is not a slug', async () => {
    await get(address, { country: 'Not A Slug' }).expect(400);
  });

  it('leaves the specialization itself where it was', async () => {
    /* The longer address is declared first; the shorter one still answers. */
    const response = await get(
      `/api/v1/subjects/${subjectSlug}/specializations/${branch}`,
    ).expect(200);
    expect((body(response).data as Json).slug).toBe(branch);
  });
});
