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
 * The universities list, as the public directories read it: each campus's
 * city for the card and the city filter, the subjects each university
 * teaches for the card's subject row, and the ranked-first order the lists
 * open in -- against a real database, because "nulls last" is the kind of
 * ordering a test double would agree to whatever MySQL does.
 */

type RecordValue = Record<string, unknown>;
const rows = (response: { body: unknown }): RecordValue[] => {
  const data = (response.body as RecordValue).data;
  return Array.isArray(data) ? (data as RecordValue[]) : [];
};

describe('The universities list for directory cards (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const suffix = randomUUID().slice(0, 8);
  const countrySlug = `cards-e2e-${suffix}`;
  let countryId = '';
  let cityId = '';
  const universityIds: string[] = [];
  const courseIds: string[] = [];
  const subjectIds: string[] = [];

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

    const country = await prisma.country.create({
      data: {
        continentId: continent.id,
        name: `Cards E2E Country ${suffix}`,
        pageHeading: `Study in Cards E2E Country ${suffix}`,
        slug: countrySlug,
        shortDescription: 'Fictional country used only for list e2e coverage.',
        status: 'PUBLISHED',
        publishedAt: now,
      },
    });
    countryId = country.id;
    const city = await prisma.city.create({
      data: {
        countryId,
        name: `Catalogue City ${suffix}`,
        slug: `catalogue-city-${suffix}`,
        status: 'PUBLISHED',
      },
    });
    cityId = city.id;

    const subject = (name: string, status: string) =>
      prisma.subject.create({
        data: {
          name: `${name} ${suffix}`,
          slug: `${name.toLowerCase()}-${suffix}`,
          status,
          publishedAt: status === 'PUBLISHED' ? now : null,
        },
      });
    const law = await subject('Law', 'PUBLISHED');
    const history = await subject('History', 'PUBLISHED');
    const draft = await subject('Draft', 'DRAFT');
    subjectIds.push(law.id, history.id, draft.id);

    const course = async (subjectId: string, name: string) => {
      const created = await prisma.course.create({
        data: {
          subjectId,
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
    const lawCourse = await course(law.id, 'Cards Law');
    const historyCourse = await course(history.id, 'Cards History');
    const draftCourse = await course(draft.id, 'Cards Draft');

    const unranked = await prisma.university.create({
      data: {
        countryId,
        name: `Aardvark Cards University ${suffix}`,
        slug: `aardvark-cards-university-${suffix}`,
        status: 'PUBLISHED',
        publishedAt: now,
        campuses: {
          create: [
            {
              name: 'Second campus',
              slug: `second-${suffix}`,
              city: null,
              cityId,
              status: 'ACTIVE',
              displayOrder: 2,
            },
            {
              name: 'Main campus',
              slug: `main-${suffix}`,
              city: `Typed City ${suffix}`,
              status: 'ACTIVE',
              displayOrder: 1,
            },
          ],
        },
      },
    });
    const ranked = await prisma.university.create({
      data: {
        countryId,
        name: `Zebra Cards University ${suffix}`,
        slug: `zebra-cards-university-${suffix}`,
        status: 'PUBLISHED',
        publishedAt: now,
        qsRanking: 42,
      },
    });
    universityIds.push(unranked.id, ranked.id);

    const offering = (
      genericCourseId: string,
      name: string,
      status = 'PUBLISHED',
      window: { publishStartsAt?: Date; publishEndsAt?: Date } = {},
    ) =>
      prisma.universityCourseOffering.create({
        data: {
          universityId: unranked.id,
          genericCourseId,
          name: `${name} ${suffix}`,
          slug: `${name.toLowerCase().replaceAll(' ', '-')}-${suffix}`,
          status,
          publishedAt: status === 'PUBLISHED' ? now : null,
          courseLevelId: level.id,
          ...window,
        },
      });
    /* Two hours either side of now: closer than any time-zone offset, so a
       subject count that compared the window in local time rather than in
       the time the rows are stored in would count the wrong ones. */
    const hours = (count: number) =>
      new Date(now.getTime() + count * 60 * 60 * 1000);
    await offering(historyCourse, 'History One');
    await offering(historyCourse, 'History Two');
    await offering(historyCourse, 'History Opened', 'PUBLISHED', {
      publishStartsAt: hours(-2),
    });
    await offering(historyCourse, 'History Not Yet', 'PUBLISHED', {
      publishStartsAt: hours(2),
    });
    await offering(historyCourse, 'History Closed', 'PUBLISHED', {
      publishEndsAt: hours(-2),
    });
    await offering(lawCourse, 'Law One');
    await offering(lawCourse, 'Law Draft Offering', 'DRAFT');
    await offering(draftCourse, 'Under A Draft Subject');
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
    if (subjectIds.length)
      await prisma.subject.deleteMany({ where: { id: { in: subjectIds } } });
    if (cityId) await prisma.city.deleteMany({ where: { id: cityId } });
    if (countryId)
      await prisma.country.deleteMany({ where: { id: countryId } });
    await app.close();
  });

  const list = (query: Record<string, string>) =>
    request(app.getHttpServer())
      .get('/api/v1/phase1/universities')
      .query({ country: countrySlug, limit: '20', ...query })
      .expect(200);

  it('gives each campus its city, main campus first', async () => {
    const response = await list({});
    const row = rows(response).find((entry) =>
      String(entry.slug).startsWith('aardvark'),
    );
    expect(row?.campuses).toEqual([
      expect.objectContaining({ city: `Typed City ${suffix}` }),
      /* No typed city: the catalogue city it is filed under. */
      expect.objectContaining({ city: `Catalogue City ${suffix}` }),
    ]);
  });

  it('names the subjects it teaches by published programmes, under published subjects only', async () => {
    const response = await list({});
    const row = rows(response).find((entry) =>
      String(entry.slug).startsWith('aardvark'),
    );
    expect(row?.subjects).toEqual([
      /* One, Two and the one whose window has opened; not the one still
         to open or the one that has closed. */
      { name: `History ${suffix}`, slug: `history-${suffix}`, offerings: 3 },
      { name: `Law ${suffix}`, slug: `law-${suffix}`, offerings: 1 },
    ]);
  });

  it('counts subjects over the same programmes as the card’s programme count', async () => {
    /* The subjects are counted in SQL and the programme figure by Prisma.
       Both must take the same programmes as live: the four above, plus
       the one filed under a draft subject, which has a programme but no
       subject a card may name. */
    const response = await list({});
    const row = rows(response).find((entry) =>
      String(entry.slug).startsWith('aardvark'),
    );
    expect((row?._count as RecordValue | undefined)?.offerings).toBe(5);
  });

  it('finds a university by a subject it teaches', async () => {
    const slugs = (response: { body: unknown }) =>
      rows(response).map((entry) => String(entry.slug).split('-')[0]);
    expect(slugs(await list({ subject: `law-${suffix}` }))).toEqual([
      'aardvark',
    ]);
    expect(
      (await list({ subject: `law-${suffix}`, limit: '1' })).body,
    ).toMatchObject({ meta: { total: 1 } });
  });

  it('lists ranked universities first, then the unranked by name', async () => {
    const names = rows(await list({ sort: 'ranking' })).map((entry) =>
      String(entry.name),
    );
    expect(names).toEqual([
      `Zebra Cards University ${suffix}`,
      `Aardvark Cards University ${suffix}`,
    ]);
  });
});
