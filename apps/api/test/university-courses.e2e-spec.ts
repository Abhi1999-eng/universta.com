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
  elsewhereTotal: number;
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

    /* A reload after "Load more" asks for the first three pages at once,
       past the fifty other lists stop at. */
    const run = await list('limit=54');
    expect(run.data).toHaveLength(54);
    expect(run.meta.total).toBe(55);
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
    expect(body.elsewhereTotal).toBe(1);
  });

  /* The list reads a university's whole catalogue before it filters and
     counts. It used to stop at 500 rows in whatever order the database gave
     them, so past that the counts and filters covered an arbitrary subset. */
  describe('a university with more than five hundred courses', () => {
    let large = { id: '', slug: '' };

    beforeAll(async () => {
      large = await prisma.university.create({
        data: {
          countryId: countryIds[0],
          name: `UC E2E Large ${suffix}`,
          slug: `uc-e2e-large-${suffix}`,
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
      });
      universityIds.push(large.id);
      await prisma.universityCourseOffering.createMany({
        data: Array.from({ length: 520 }, (_, index) => ({
          universityId: large.id,
          genericCourseId: courseIds[0],
          name: `UC E2E Large ${String(index).padStart(3, '0')} ${suffix}`,
          slug: `uc-e2e-large-${index}-${suffix}`,
          /* The last twenty, by the list's own order, are part time. */
          studyMode: index >= 500 ? 'PART_TIME' : 'FULL_TIME',
          status: 'PUBLISHED',
          publishedAt: new Date(),
        })),
      });
    });

    afterAll(async () => {
      await prisma.universityCourseOffering.deleteMany({
        where: { universityId: large.id },
      });
    });

    it('counts and filters every course, not the first five hundred read', async () => {
      const body = (
        await get(`/universities/${large.slug}/courses?limit=18`).expect(200)
      ).body.data as List;
      expect(body.catalogue.total).toBe(520);
      expect(body.meta.total).toBe(520);
      expect(
        body.facets.studyModes.find((o) => o.value === 'PART_TIME')?.count,
      ).toBe(20);
      const partTime = (
        await get(
          `/universities/${large.slug}/courses?studyMode=PART_TIME&sort=name`,
        ).expect(200)
      ).body.data as List;
      expect(partTime.meta.total).toBe(20);
      expect(partTime.data[0].name).toBe(`UC E2E Large 500 ${suffix}`);
    });
  });

  /* What a course page suggests is chosen in the database. The page used to
     read the first twenty-four rows by name and only then sort them by
     level and country, so a Master's page whose subject had more than
     twenty-four Bachelor's courses elsewhere -- "B" before "M" -- offered
     nothing but Bachelor's, and the course's own country could fall off the
     end of "Other universities offering this course". */
  describe('a course page’s neighbours', () => {
    const made = {
      countries: [] as string[],
      universities: [] as string[],
      courses: [] as string[],
      offerings: [] as string[],
      subject: '',
    };
    let reader = { university: '', course: '' };
    const expected: Record<string, string> = {};
    const hidden: string[] = [];

    beforeAll(async () => {
      const low = levels[0];
      const high = levels[1];
      /* A subject of its own, so no other course in the database can stand
         between these and the page. */
      made.subject = (
        await prisma.subject.create({
          data: {
            name: `UC E2E Neighbours ${suffix}`,
            slug: `uc-e2e-neighbours-${suffix}`,
            status: 'PUBLISHED',
            publishedAt: new Date(),
          },
        })
      ).id;
      const country = async (name: string) => {
        const row = await prisma.country.create({
          data: {
            name: `${name} ${suffix}`,
            slug: `uc-e2e-${name.toLowerCase()}-${suffix}`,
            status: 'PUBLISHED',
            publishedAt: new Date(),
          },
        });
        made.countries.push(row.id);
        return row.id;
      };
      const near = await country('Near');
      const far = await country('Far');
      const course = async (tag: string, levelId: string) => {
        const row = await prisma.course.create({
          data: {
            subjectId: made.subject,
            courseLevelId: levelId,
            name: `UC E2E ${tag} ${suffix}`,
            slug: `uc-e2e-${tag.toLowerCase()}-${suffix}`,
            status: 'PUBLISHED',
            publishedAt: new Date(),
          },
        });
        made.courses.push(row.id);
        return row.id;
      };
      /* The reader is on the higher of the two levels. */
      const read = await course('Reader', high.id);
      const bachelor = await course('Lower', low.id);
      const master = await course('Higher', high.id);
      const raisedHere = await course('Raised', low.id);
      const loweredHere = await course('Lowered', high.id);
      const university = async (
        tag: string,
        countryId: string,
        window: Record<string, Date> = {},
      ) => {
        const row = await prisma.university.create({
          data: {
            countryId,
            name: `UC E2E ${tag} ${suffix}`,
            slug: `uc-e2e-uni-${tag.toLowerCase().replace(/ /g, '-')}-${suffix}`,
            status: 'PUBLISHED',
            publishedAt: new Date(),
            ...window,
          },
        });
        made.universities.push(row.id);
        return row;
      };
      const offer = async (
        universityId: string,
        courseId: string,
        name: string,
        extra: Record<string, unknown> = {},
      ) => {
        const row = await prisma.universityCourseOffering.create({
          data: {
            universityId,
            genericCourseId: courseId,
            name,
            slug: `uc-e2e-${name.toLowerCase().replace(/ /g, '-')}-${suffix}`,
            status: 'PUBLISHED',
            publishedAt: new Date(),
            ...extra,
          },
        });
        made.offerings.push(row.id);
        return row.slug;
      };

      const home = await university('Reader', near);
      reader = {
        university: home.slug,
        course: await offer(home.id, read, 'Reader course'),
      };
      /* Twenty-five universities abroad, each with this course and a
         Bachelor's in the subject, all named to sort before anything else. */
      const abroad = await Promise.all(
        Array.from({ length: 25 }, (_, index) =>
          university(`Far ${String(index).padStart(2, '0')}`, far),
        ),
      );
      for (const [index, row] of abroad.entries()) {
        const tag = String(index).padStart(2, '0');
        const same = await offer(row.id, read, `A reader abroad ${tag}`);
        const lower = await offer(row.id, bachelor, `B lower abroad ${tag}`);
        if (index === 0) expected.firstAbroad = same;
        if (index === 0) expected.firstLower = lower;
      }
      /* The one Master's abroad, at the university and under the name that
         sort last. */
      expected.higherAbroad = await offer(
        abroad[24].id,
        master,
        'Z higher abroad',
      );
      /* At home: the same course, named to sort last, and two courses whose
         offering sets its own level over the generic course's. */
      const neighbour = await university('Near', near);
      expected.sameAtHome = await offer(neighbour.id, read, 'Z reader at home');
      expected.raisedAtHome = await offer(
        neighbour.id,
        raisedHere,
        'X raised at home',
        { courseLevelId: high.id },
      );
      expected.loweredAtHome = await offer(
        neighbour.id,
        loweredHere,
        'C lowered at home',
        { courseLevelId: low.id },
      );
      /* Published, but outside their publishing windows: their own pages
         are 404s, so nothing may lead there. */
      const day = 24 * 60 * 60 * 1000;
      const ended = await university('Ended', near, {
        publishEndsAt: new Date(Date.now() - day),
      });
      const later = await university('Later', near, {
        publishStartsAt: new Date(Date.now() + day),
      });
      for (const row of [ended, later]) {
        hidden.push(
          await offer(row.id, read, `A reader ${row.id.slice(0, 4)}`),
          await offer(row.id, master, `A higher ${row.id.slice(0, 4)}`),
        );
      }
    });

    afterAll(async () => {
      await prisma.universityCourseOffering.deleteMany({
        where: { id: { in: made.offerings } },
      });
      await prisma.course.deleteMany({ where: { id: { in: made.courses } } });
      await prisma.university.deleteMany({
        where: { id: { in: made.universities } },
      });
      await prisma.country.deleteMany({
        where: { id: { in: made.countries } },
      });
      await prisma.subject.deleteMany({ where: { id: made.subject } });
    });

    const detail = async () =>
      (
        await get(
          `/universities/${reader.university}/courses/${reader.course}`,
        ).expect(200)
      ).body.data as Detail;

    it('suggests the reader’s level first, at home then abroad, then the rest', async () => {
      const related = (await detail()).related.map((row) => row.slug);
      expect(related).toHaveLength(6);
      expect(related.slice(0, 4)).toEqual([
        expected.raisedAtHome,
        expected.higherAbroad,
        expected.loweredAtHome,
        expected.firstLower,
      ]);
    });

    it('lists the same course at home first, and counts every one', async () => {
      const body = await detail();
      expect(body.elsewhere).toHaveLength(6);
      expect(body.elsewhere[0].slug).toBe(expected.sameAtHome);
      expect(body.elsewhere[1].slug).toBe(expected.firstAbroad);
      expect(body.elsewhereTotal).toBe(26);
    });

    it('leaves out universities outside their publishing window', async () => {
      const body = await detail();
      const shown = [...body.related, ...body.elsewhere].map((row) => row.slug);
      for (const slug of hidden) expect(shown).not.toContain(slug);
    });
  });
});
