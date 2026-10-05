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
 * A university's public record carries what its page shows: the city of its
 * campus, the specialization of each course, and three more universities
 * from the same country, best ranked first.
 *
 * Built through the admin API where an editor would build it, and checked
 * through the public endpoint the page reads, against a real database:
 * the ranking order depends on how MySQL sorts the unranked rows, which a
 * mocked client cannot say.
 */
function record(response: { body: unknown }): Record<string, unknown> {
  const value = (response.body as { data?: unknown } | null)?.data;
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

describe('a university’s public record (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token = '';
  const stamp = `${Date.now()}-${randomUUID().slice(0, 6)}`;
  const slug = (label: string) => `udp-${label}-${stamp}`;

  const admin = (
    method: 'get' | 'post' | 'patch' | 'put',
    path: string,
    payload?: Record<string, unknown>,
  ) => {
    const call = request(app.getHttpServer())
      [method](path)
      .set('Authorization', `Bearer ${token}`)
      .set('x-request-id', 'university-detail-page-e2e');
    return payload ? call.send(payload) : call;
  };

  async function expectStatus(call: request.Test, status: number) {
    const response = await call;
    if (response.status !== status)
      throw new Error(
        `Expected ${status}, got ${response.status}: ${JSON.stringify(response.body)}`,
      );
    return response;
  }

  async function makeUniversity(
    label: string,
    countryId: string,
    {
      qsRanking,
      publish = true,
    }: { qsRanking?: number; publish?: boolean } = {},
  ) {
    const response = await expectStatus(
      admin('post', '/api/v1/admin/phase1/universities', {
        countryId,
        name: `UDP ${label} University ${stamp}`,
        slug: slug(label),
        shortDescription: 'University page fixture',
      }),
      201,
    );
    const id = String(record(response).id);
    if (qsRanking)
      await prisma.university.update({ where: { id }, data: { qsRanking } });
    if (publish)
      await expectStatus(
        admin('post', `/api/v1/admin/phase1/universities/${id}/publish`, {}),
        201,
      );
    return id;
  }

  let mainSlug = '';
  let subSubjectSlug = '';
  let ownLevelCode = '';

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

    const continentId = (
      await prisma.continent.findFirstOrThrow({
        where: { status: 'ACTIVE', deletedAt: null },
      })
    ).id;
    const courseLevelId = (
      await prisma.courseLevel.findFirstOrThrow({ where: { status: 'ACTIVE' } })
    ).id;

    const country = await expectStatus(
      admin('post', '/api/v1/admin/countries', {
        continentId,
        name: `UDP ${stamp}`,
        slug: slug('country'),
        pageHeading: 'Study in UDP',
        shortDescription: 'University page fixture',
      }),
      201,
    );
    const countryId = String(record(country).id);
    await expectStatus(
      admin('post', `/api/v1/admin/countries/${countryId}/publish`, {}),
      201,
    );

    const subject = await expectStatus(
      admin('post', '/api/v1/admin/subjects', {
        name: `UDP Subject ${stamp}`,
        slug: slug('subject'),
        shortDescription: 'University page fixture subject',
      }),
      201,
    );
    const subjectId = String(record(subject).id);
    subSubjectSlug = slug('spec');
    const specialization = await prisma.subSubject.create({
      data: {
        subjectId,
        name: `UDP Spec ${stamp}`,
        slug: subSubjectSlug,
        status: 'PUBLISHED',
      },
    });
    const course = await expectStatus(
      admin('post', '/api/v1/admin/courses', {
        subjectId,
        courseLevelId,
        name: `UDP Course ${stamp}`,
        slug: slug('course'),
        shortDescription: 'University page fixture course',
      }),
      201,
    );
    const courseId = String(record(course).id);
    await prisma.course.update({
      where: { id: courseId },
      data: { subSubjectId: specialization.id },
    });

    /* The university the page is about, with a campus whose city is typed. */
    const mainId = await makeUniversity('main', countryId);
    mainSlug = slug('main');
    await prisma.universityCampus.create({
      data: {
        universityId: mainId,
        name: 'Main campus',
        slug: slug('campus'),
        city: 'Testville',
      },
    });
    const offering = await expectStatus(
      admin('post', '/api/v1/admin/phase1/offerings', {
        universityId: mainId,
        genericCourseId: courseId,
        name: `UDP Offering ${stamp}`,
        slug: slug('offering'),
      }),
      201,
    );
    await expectStatus(
      admin(
        'post',
        `/api/v1/admin/phase1/offerings/${String(record(offering).id)}/publish`,
        {},
      ),
      201,
    );
    /* An editor files this university's course under another level than
       the generic course's, as the catalogue lets them. */
    const ownLevel = await prisma.courseLevel.findFirstOrThrow({
      where: { status: 'ACTIVE', id: { not: courseLevelId } },
    });
    ownLevelCode = ownLevel.code;
    await prisma.universityCourseOffering.update({
      where: { id: String(record(offering).id) },
      data: { courseLevelId: ownLevel.id },
    });

    /* Its neighbours: two ranked (in the wrong order of creation), two not,
       and one still in draft that must not be offered. */
    await makeUniversity('zulu', countryId);
    await makeUniversity('ranked-40', countryId, { qsRanking: 40 });
    await makeUniversity('alpha', countryId);
    await makeUniversity('ranked-7', countryId, { qsRanking: 7 });
    await makeUniversity('draft', countryId, { publish: false });
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  const detail = async () =>
    record(
      await request(app.getHttpServer())
        .get(`/api/v1/phase1/universities/${mainSlug}`)
        .expect(200),
    );

  it('offers three others from its country, ranked first, then A to Z', async () => {
    const others = (await detail()).otherUniversities as {
      total: number;
      data: Array<{
        slug: string;
        campuses: unknown[];
        _count: { offerings: number };
      }>;
    };
    /* Four published neighbours; the draft and the university itself are
       left out. */
    expect(others.total).toBe(4);
    expect(others.data.map((other) => other.slug)).toEqual([
      slug('ranked-7'),
      slug('ranked-40'),
      slug('alpha'),
    ]);
    expect(others.data[0]?._count).toEqual({ offerings: 0 });
  });

  it('names the city of its campus', async () => {
    const campuses = (await detail()).campuses as Array<{
      city: string | null;
      cityRef: unknown;
    }>;
    expect(campuses[0]).toMatchObject({ city: 'Testville', cityRef: null });
  });

  it('names the specialization of each course', async () => {
    const offerings = (await detail()).offerings as Array<{
      genericCourse: { subSubject: { slug: string } | null };
    }>;
    expect(offerings[0]?.genericCourse.subSubject?.slug).toBe(subSubjectSlug);
  });

  /* The course list and the course page read the level set on the course
     first; the university page reads this record, so the level has to be
     in it for the three pages to agree. */
  it('carries the level set on each course alongside the generic course’s', async () => {
    const offerings = (await detail()).offerings as Array<{
      courseLevel: { code: string } | null;
      genericCourse: { courseLevel: { code: string } | null };
    }>;
    expect(offerings[0]?.courseLevel?.code).toBe(ownLevelCode);
    expect(offerings[0]?.genericCourse.courseLevel?.code).not.toBe(
      ownLevelCode,
    );
  });
});
