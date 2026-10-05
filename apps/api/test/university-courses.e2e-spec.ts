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
 * A university's courses, and one course, as the pages under the country
 * read them.
 *
 * The list is searched and narrowed by level, subject, specialization,
 * duration, intake and study mode, every option counted over the whole of
 * the university's published courses -- not over the page shown, and not
 * over the first fifty -- and ordered by study level then name unless asked
 * otherwise. A course comes with the university's other courses and the
 * same course at other universities, each with enough of its university to
 * link to it under that university's own country.
 */

type Option = { value: string; label: string; count: number };
type Row = {
  name: string;
  slug: string;
  university?: { slug: string; country: { slug: string } };
};
type List = {
  university: {
    slug: string;
    websiteUrl: string | null;
    country: { slug: string; name: string };
    campuses: Array<{ city: string | null }>;
  };
  data: Row[];
  meta: { page: number; limit: number; total: number; totalPages: number };
  facets: Record<
    | 'levels'
    | 'subjects'
    | 'specializations'
    | 'durations'
    | 'intakes'
    | 'studyModes',
    Option[]
  >;
  catalogue: { total: number; deadlines: Array<{ deadline: string | null }> };
};
type Detail = Row & {
  university: { slug: string; country: { slug: string } };
  related: Row[];
  elsewhere: Row[];
  moreAtUniversity: { total: number; rows: Row[] };
};

describe('a university’s courses (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  /* Letters only: a digit in here would turn up in every course name and
     make a search for "07" match all of them. */
  const suffix = randomUUID()
    .replace(/[^a-f]/g, '')
    .slice(0, 8)
    .padEnd(8, 'a');
  const countryIds: string[] = [];
  const universityIds: string[] = [];
  const courseIds: string[] = [];
  const offeringIds: string[] = [];
  let home = '';
  let away = '';
  let hidden = '';
  let levels: Array<{ id: string; code: string; educationOrder: number }> = [];
  let subjects: Array<{ id: string; slug: string }> = [];
  let branch: { id: string; slug: string; subjectId: string } | null = null;
  let intake: { id: string; slug: string } | null = null;

  const get = (path: string) =>
    request(app.getHttpServer()).get(`/api/v1/phase1${path}`);
  const list = async (query = '') =>
    (await get(`/universities/${home}/courses?${query}`).expect(200)).body
      .data as List;

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = fixture.createNestApplication(new ExpressAdapter());
    configureApplication(app);
    await app.init();
    prisma = app.get(PrismaService);

    levels = await prisma.courseLevel.findMany({
      orderBy: { educationOrder: 'asc' },
      take: 2,
    });
    branch = await prisma.subSubject.findFirst({
      where: { deletedAt: null },
      select: { id: true, slug: true, subjectId: true },
    });
    const others = await prisma.subject.findMany({
      where: { deletedAt: null, id: { not: branch?.subjectId } },
      take: 1,
      select: { id: true, slug: true },
    });
    intake = await prisma.intake.findFirst({
      select: { id: true, slug: true },
    });
    if (levels.length < 2 || !branch || !others.length || !intake)
      throw new Error(
        'Levels, a specialization, a subject and an intake are required',
      );
    subjects = [
      {
        id: branch.subjectId,
        slug: (
          await prisma.subject.findUniqueOrThrow({
            where: { id: branch.subjectId },
          })
        ).slug,
      },
      others[0],
    ];

    const continent = await prisma.continent.findFirst({
      where: { deletedAt: null },
    });
    const country = (name: string, status: string) =>
      prisma.country.create({
        data: {
          continentId: continent?.id ?? null,
          name: `${name} ${suffix}`,
          slug: `uc-e2e-${name.toLowerCase()}-${suffix}`,
          status,
          publishedAt: new Date(),
        },
      });
    const live = await country('Home', 'PUBLISHED');
    const elsewhere = await country('Away', 'PUBLISHED');
    const gone = await country('Gone', 'DRAFT');
    countryIds.push(live.id, elsewhere.id, gone.id);

    const university = (name: string, countryId: string) =>
      prisma.university.create({
        data: {
          countryId,
          name: `UC E2E ${name} ${suffix}`,
          slug: `uc-e2e-${name.toLowerCase()}-${suffix}`,
          websiteUrl: 'https://example.invalid/',
          status: 'PUBLISHED',
          publishedAt: new Date(),
          campuses: {
            create: {
              name: `${name} campus`,
              slug: `${name.toLowerCase()}-campus`,
              city: `${name}ville`,
              status: 'ACTIVE',
            },
          },
        },
      });
    const [homeUni, awayUni, hiddenUni] = await Promise.all([
      university('Home', live.id),
      university('Away', elsewhere.id),
      university('Hidden', gone.id),
    ]);
    universityIds.push(homeUni.id, awayUni.id, hiddenUni.id);
    home = homeUni.slug;
    away = awayUni.slug;
    hidden = hiddenUni.slug;

    /* Fifty-five courses at one university: more than one page of the
       list's largest page, which is the case the counts used to get wrong. */
    const generic = await Promise.all(
      Array.from({ length: 55 }, (_, index) =>
        prisma.course.create({
          data: {
            subjectId: subjects[index % 2].id,
            subSubjectId: index % 2 === 0 && index < 10 ? branch!.id : null,
            courseLevelId: levels[index % 2].id,
            name: `UC E2E Course ${String(index).padStart(2, '0')} ${suffix}`,
            slug: `uc-e2e-course-${index}-${suffix}`,
            status: 'PUBLISHED',
            publishedAt: new Date(),
            durationMin: index % 2 === 0 ? 3 : 1,
            durationUnit: 'YEARS',
          },
        }),
      ),
    );
    courseIds.push(...generic.map((row) => row.id));
    const offer = (
      universityId: string,
      index: number,
      extra: Record<string, unknown> = {},
    ) =>
      prisma.universityCourseOffering.create({
        data: {
          universityId,
          genericCourseId: generic[index].id,
          name: generic[index].name,
          slug: `${generic[index].slug}-at-${universityId.slice(0, 6)}`,
          status: 'PUBLISHED',
          publishedAt: new Date(),
          ...extra,
        },
      });
    for (let index = 0; index < 55; index += 1) {
      const row = await offer(homeUni.id, index, {
        studyMode: index < 5 ? 'PART_TIME' : 'FULL_TIME',
        ...(index === 3
          ? {
              intakes: {
                create: {
                  intakeId: intake.id,
                  deadline: new Date('2099-01-31'),
                  status: 'ACTIVE',
                },
              },
            }
          : {}),
      });
      offeringIds.push(row.id);
    }
    offeringIds.push(
      (await offer(awayUni.id, 0)).id,
      (await offer(hiddenUni.id, 0)).id,
    );
  });

  afterAll(async () => {
    await prisma.universityCourseIntake.deleteMany({
      where: { offeringId: { in: offeringIds } },
    });
    await prisma.universityCourseOffering.deleteMany({
      where: { id: { in: offeringIds } },
    });
    await prisma.course.deleteMany({ where: { id: { in: courseIds } } });
    await prisma.universityCampus.deleteMany({
      where: { universityId: { in: universityIds } },
    });
    await prisma.university.deleteMany({
      where: { id: { in: universityIds } },
    });
    await prisma.country.deleteMany({ where: { id: { in: countryIds } } });
    await app.close();
  });

  it('names the university’s country and campus cities with its list', async () => {
    const body = await list('limit=18');
    expect(body.university.slug).toBe(home);
    expect(body.university.country.slug).toBe(`uc-e2e-home-${suffix}`);
    expect(body.university.campuses.map((campus) => campus.city)).toEqual([
      'Homeville',
    ]);
    expect(body.university.websiteUrl).toBe('https://example.invalid/');
  });

  it('pages the list but counts every course, past the first fifty', async () => {
    const first = await list('limit=18');
    expect(first.data).toHaveLength(18);
    expect(first.meta).toEqual({
      page: 1,
      limit: 18,
      total: 55,
      totalPages: 4,
    });
    expect(first.catalogue.total).toBe(55);
    const byLevel = Object.fromEntries(
      first.facets.levels.map((option) => [option.value, option.count]),
    );
    expect(byLevel).toEqual({ [levels[0].code]: 28, [levels[1].code]: 27 });

    const last = await list('limit=18&page=4');
    expect(last.data).toHaveLength(1);
  });

  it('orders by study level, then name, by default', async () => {
    const body = await list('limit=50');
    const names = body.data.map((row) => row.name);
    expect(names[0]).toBe(`UC E2E Course 00 ${suffix}`);
    expect(names[1]).toBe(`UC E2E Course 02 ${suffix}`);
    /* Twenty-eight at the first level, A to Z, then the second level. */
    expect(names[27]).toBe(`UC E2E Course 54 ${suffix}`);
    expect(names[28]).toBe(`UC E2E Course 01 ${suffix}`);
    const byName = await list('limit=3&sort=name');
    expect(byName.data.map((row) => row.name)).toEqual([
      `UC E2E Course 00 ${suffix}`,
      `UC E2E Course 01 ${suffix}`,
      `UC E2E Course 02 ${suffix}`,
    ]);
  });

  it('narrows by search, subject, specialization, duration, intake and mode, keeping the counts whole', async () => {
    expect((await list('q=course 07')).meta.total).toBe(1);
    expect((await list(`subject=${subjects[1].slug}`)).meta.total).toBe(27);
    expect((await list(`specialization=${branch!.slug}`)).meta.total).toBe(5);
    expect((await list('duration=12')).meta.total).toBe(27);
    expect((await list('duration=25')).meta.total).toBe(28);
    expect((await list(`intake=${intake!.slug}`)).meta.total).toBe(1);
    expect((await list('studyMode=PART_TIME')).meta.total).toBe(5);
    const both = await list(
      `level=${levels[0].code},${levels[1].code}&studyMode=PART_TIME`,
    );
    expect(both.meta.total).toBe(5);
    /* The options stay counted over everything, so removing a filter is
       always a step back to a number the reader has already seen. */
    expect(
      both.facets.studyModes.find((o) => o.value === 'FULL_TIME')?.count,
    ).toBe(50);
    expect(both.catalogue.deadlines).toEqual([
      expect.objectContaining({ deadline: '2099-01-31', count: 1 }),
    ]);
    expect((await list('q=nothing-matches-this')).meta.total).toBe(0);
  });

  it('serves no list for a university whose country is gone', async () => {
    await get(`/universities/${hidden}/courses`).expect(404);
  });

  it('gives a course its university’s other courses and the same course elsewhere', async () => {
    const first = (await list('limit=1')).data[0];
    const body = (
      await get(`/universities/${home}/courses/${first.slug}`).expect(200)
    ).body.data as Detail;
    expect(body.university.country.slug).toBe(`uc-e2e-home-${suffix}`);
    expect(body.moreAtUniversity.total).toBe(55);
    expect(body.moreAtUniversity.rows.length).toBeGreaterThan(0);
    /* The same course at the live university abroad, and not at the one
       whose destination was withdrawn. */
    expect(body.elsewhere.map((row) => row.university?.slug)).toEqual([away]);
    expect(body.elsewhere[0].university?.country.slug).toBe(
      `uc-e2e-away-${suffix}`,
    );
    const related = body.related.map((row) => row.slug);
    expect(related).not.toContain(first.slug);
    expect(related).not.toContain(body.elsewhere[0].slug);
    const more = body.moreAtUniversity.rows.map((row) => row.slug);
    expect(more.some((slug) => related.includes(slug))).toBe(false);
  });
});
