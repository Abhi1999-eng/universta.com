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
 * Programmes across every university, as the course finder reads them.
 *
 * A programme is listed only while it, its university and its university's
 * destination are all live; the University and City lists follow the
 * countries chosen while every other count stays catalogue-wide; the
 * "with scholarships" flag counts only live awards; the English score
 * filter reads listed minimums; and a programme compares, and a bare
 * /courses/<slug> resolves to it, under the same rule.
 */

type Option = { value: string; label: string; count: number };
type List = {
  data: Array<{
    slug: string;
    university: { slug: string; country: { slug: string } };
    genericCourse: Record<string, unknown> & {
      subject: Record<string, unknown>;
      courseLevel: Record<string, unknown>;
    };
  }>;
  meta: { total: number; sort: string; ignored: string[] };
  facets: Record<string, Option[]> & {
    tuition: { currencyCode: string | null; count: number } | null;
  };
  summary: Record<string, number>;
};

describe('programmes across universities (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  /* Letters only, so a search for the suffix matches nothing else. */
  const suffix = randomUUID()
    .replace(/[^a-f]/g, '')
    .slice(0, 10)
    .padEnd(10, 'b');
  const countryIds: string[] = [];
  const universityIds: string[] = [];
  const courseIds: string[] = [];
  const subjectIds: string[] = [];
  const offeringIds: string[] = [];
  const scholarshipIds: string[] = [];
  const slugs: Record<string, string> = {};
  let home = '';
  let away = '';
  let empty = '';
  let untaught = '';
  let unlisted = '';

  const get = (path: string) =>
    request(app.getHttpServer()).get(`/api/v1/phase1${path}`);
  const list = async (query: string) =>
    (await get(`/programmes?${query}`).expect(200)).body.data as List;

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = fixture.createNestApplication(new ExpressAdapter());
    configureApplication(app);
    await app.init();
    prisma = app.get(PrismaService);

    const level = await prisma.courseLevel.findFirst({
      orderBy: { educationOrder: 'asc' },
    });
    const subject = await prisma.subject.findFirst({
      where: { deletedAt: null },
    });
    if (!level || !subject)
      throw new Error('A level and a subject are required');
    const continent = await prisma.continent.findFirst({
      where: { deletedAt: null },
    });
    const country = async (name: string, status: string) => {
      const row = await prisma.country.create({
        data: {
          continentId: continent?.id ?? null,
          name: `PR ${name} ${suffix}`,
          slug: `pr-e2e-${name.toLowerCase()}-${suffix}`,
          status,
          publishedAt: new Date(),
        },
      });
      countryIds.push(row.id);
      return row;
    };
    const live = await country('Home', 'PUBLISHED');
    const elsewhere = await country('Away', 'PUBLISHED');
    const gone = await country('Gone', 'DRAFT');
    /* Published, with nothing listed in it. */
    const bare = await country('Empty', 'PUBLISHED');
    home = live.slug;
    away = elsewhere.slug;
    empty = bare.slug;

    const university = async (
      name: string,
      countryId: string,
      status = 'PUBLISHED',
    ) => {
      const row = await prisma.university.create({
        data: {
          countryId,
          name: `PR E2E ${name} ${suffix}`,
          slug: `pr-e2e-${name.toLowerCase()}-${suffix}`,
          status,
          publishedAt: new Date(),
          campuses: {
            create: {
              name: `${name} campus`,
              slug: `${name.toLowerCase()}-campus`,
              city: `${name}ton ${suffix}`,
              status: 'ACTIVE',
            },
          },
        },
      });
      universityIds.push(row.id);
      return row;
    };
    const north = await university('North', live.id);
    const south = await university('South', live.id);
    const abroad = await university('Abroad', elsewhere.id);
    const draft = await university('Draft', live.id, 'DRAFT');
    const hidden = await university('Hidden', gone.id);

    const generic = await prisma.course.create({
      data: {
        subjectId: subject.id,
        courseLevelId: level.id,
        name: `PR E2E Course ${suffix}`,
        slug: `pr-e2e-course-${suffix}`,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
    courseIds.push(generic.id);

    /* A published subject and a published course guide that no programme
       is filed under. */
    const quiet = await prisma.subject.create({
      data: {
        name: `PR E2E Subject ${suffix}`,
        slug: `pr-e2e-subject-${suffix}`,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
    subjectIds.push(quiet.id);
    unlisted = quiet.slug;
    const idle = await prisma.course.create({
      data: {
        subjectId: subject.id,
        courseLevelId: level.id,
        name: `PR E2E Untaught ${suffix}`,
        slug: `pr-e2e-untaught-${suffix}`,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
    courseIds.push(idle.id);
    untaught = idle.slug;

    const offer = async (key: string, universityId: string, extra = {}) => {
      const row = await prisma.universityCourseOffering.create({
        data: {
          universityId,
          genericCourseId: generic.id,
          name: `PR E2E ${key} ${suffix}`,
          slug: `pr-e2e-${key.toLowerCase()}-${suffix}`,
          status: 'PUBLISHED',
          publishedAt: new Date(),
          ...extra,
        },
      });
      offeringIds.push(row.id);
      slugs[key] = row.slug;
      return row;
    };
    /* Fees in the home country: two in its dollars by the year, and one
       in another currency that is lower in figures alone. */
    const fee = (tuitionMin: number, currencyCode: string) => ({
      tuitionMin,
      tuitionMax: tuitionMin,
      currencyCode,
      tuitionPeriod: 'PER_YEAR',
    });
    const scored = await offer('Scored', north.id, {
      ...fee(30000, 'CAD'),
      requirements: {
        create: {
          category: 'ENGLISH_TEST',
          title: 'IELTS',
          minimumScore: 6.5,
          status: 'ACTIVE',
        },
      },
    });
    const funded = await offer('Funded', south.id, fee(20000, 'CAD'));
    const drafted = await offer('Drafted', south.id, fee(10000, 'AUD'));
    await offer('Abroad', abroad.id);
    await offer('AtDraft', draft.id);
    await offer('AtHidden', hidden.id);

    /* One live award and one draft, each on its own programme. */
    const award = (title: string, status: string, offeringId: string) =>
      prisma.scholarship.create({
        data: {
          title: `${title} ${suffix}`,
          slug: `pr-e2e-${title.toLowerCase()}-${suffix}`,
          status,
          publishedAt: new Date(),
          offerings: { create: { offeringId } },
        },
      });
    scholarshipIds.push(
      (await award('Live', 'PUBLISHED', funded.id)).id,
      (await award('Draft', 'DRAFT', drafted.id)).id,
    );
    void scored;
  });

  afterAll(async () => {
    await prisma.scholarshipUniversityCourseOffering.deleteMany({
      where: { scholarshipId: { in: scholarshipIds } },
    });
    await prisma.scholarship.deleteMany({
      where: { id: { in: scholarshipIds } },
    });
    await prisma.universityCourseRequirement.deleteMany({
      where: { offeringId: { in: offeringIds } },
    });
    await prisma.universityCourseOffering.deleteMany({
      where: { id: { in: offeringIds } },
    });
    await prisma.course.deleteMany({ where: { id: { in: courseIds } } });
    await prisma.subject.deleteMany({ where: { id: { in: subjectIds } } });
    await prisma.universityCampus.deleteMany({
      where: { universityId: { in: universityIds } },
    });
    await prisma.university.deleteMany({
      where: { id: { in: universityIds } },
    });
    await prisma.country.deleteMany({ where: { id: { in: countryIds } } });
    await app.close();
  });

  it('lists only programmes at live universities in published destinations', async () => {
    const body = await list(`q=${suffix}&limit=50`);
    expect(body.data.map((row) => row.slug).sort()).toEqual(
      [slugs.Scored, slugs.Funded, slugs.Drafted, slugs.Abroad].sort(),
    );
    expect(body.meta.total).toBe(4);
  });

  it('narrows the University and City lists to the chosen country, and nothing else', async () => {
    const all = await list(`q=${suffix}`);
    const chosen = await list(`q=${suffix}&country=${home}`);
    expect(chosen.meta.total).toBe(3);
    expect(
      chosen.data.every((row) => row.university.country.slug === home),
    ).toBe(true);
    const ours = (options: Option[]) =>
      options
        .filter((option) => option.value.includes(suffix))
        .map((o) => o.value);
    expect(ours(chosen.facets.universities).sort()).toEqual([
      `pr-e2e-north-${suffix}`,
      `pr-e2e-south-${suffix}`,
    ]);
    expect(ours(chosen.facets.cities).sort()).toEqual([
      `northton-${suffix}`,
      `southton-${suffix}`,
    ]);
    expect(chosen.facets.levels).toEqual(all.facets.levels);
    expect(
      chosen.facets.countries.find((option) => option.value === away)?.count,
    ).toBe(1);
  });

  it('finds a programme by its university and its city', async () => {
    expect(
      (await list(`q=north ${suffix}`)).data.map((row) => row.slug),
    ).toEqual([slugs.Scored]);
    expect(
      (await list(`q=southton ${suffix}`)).data.map((row) => row.slug).sort(),
    ).toEqual([slugs.Funded, slugs.Drafted].sort());
  });

  it('counts only live scholarships', async () => {
    const funded = await list(`q=${suffix}&scholarship=true`);
    expect(funded.data.map((row) => row.slug)).toEqual([slugs.Funded]);
  });

  it('reads a listed English minimum against the score given', async () => {
    expect((await list(`q=${suffix}&ielts=6`)).meta.total).toBe(0);
    expect(
      (await list(`q=${suffix}&ielts=7`)).data.map((row) => row.slug),
    ).toEqual([slugs.Scored]);
  });

  it('answers without what it does not know, and narrows to nothing for a slug nothing carries', async () => {
    const odd = await list(
      `q=${suffix}&sort=bogus&level=nope&pageSize=500&studyMode=nope`,
    );
    expect(odd.meta.total).toBe(4);
    expect(odd.meta.ignored).toEqual(
      expect.arrayContaining([
        'sort=bogus',
        'level=nope',
        'pageSize=500',
        'studyMode=nope',
      ]),
    );
    expect((await list('country=atlantis')).meta.total).toBe(0);
    const fee = await list(`q=${suffix}&sort=fee`);
    expect(fee.meta.sort).toBe('relevance');
    expect((await list(`q=${suffix}&sort=fee&country=${home}`)).meta.sort).toBe(
      'fee',
    );
  });

  /* "Amounts in CAD": ten thousand Australian dollars is not the lowest
     fee in a country whose range is in Canadian dollars. */
  it('orders fees in the range’s currency and puts the rest after', async () => {
    const body = await list(`q=${suffix}&country=${home}&sort=fee`);
    expect(body.facets.tuition).toEqual({ currencyCode: 'CAD', count: 2 });
    expect(body.data.map((row) => row.slug)).toEqual([
      slugs.Funded,
      slugs.Scored,
      slugs.Drafted,
    ]);
  });

  /* Its chip read the bare slug; it is named from the catalogue now. */
  it('names a chosen destination, subject or course nothing is listed under', async () => {
    const body = await list(
      `country=${empty}&subject=${unlisted}&course=${untaught}`,
    );
    expect(body.meta.total).toBe(0);
    expect(body.facets.countries).toContainEqual(
      expect.objectContaining({
        value: empty,
        label: `PR Empty ${suffix}`,
        count: 0,
      }),
    );
    expect(body.facets.subjects).toContainEqual({
      value: unlisted,
      label: `PR E2E Subject ${suffix}`,
      count: 0,
    });
    expect(body.facets.courses).toEqual([
      { value: untaught, label: `PR E2E Untaught ${suffix}`, count: 0 },
    ]);
    /* A slug the catalogue does not publish is not named. */
    const typed = await list(`country=atlantis-${suffix}`);
    expect(
      typed.facets.countries.some((option) =>
        option.value.startsWith('atlantis'),
      ),
    ).toBe(false);
  });

  /* The card links "Course guide" only while the guide's page answers,
     which it reads from these. */
  it('carries the state each card’s course guide is answered on', async () => {
    const [row] = (await list(`q=${suffix}&limit=1`)).data;
    expect(row.genericCourse).toMatchObject({
      status: 'PUBLISHED',
      deletedAt: null,
      subject: { status: expect.any(String), deletedAt: null },
      courseLevel: { status: expect.any(String) },
    });
  });

  it('compares live programmes only, with their university’s country', async () => {
    const body = (
      await get(
        `/compare/courses?items=${[slugs.Scored, slugs.AtDraft, slugs.AtHidden, slugs.Abroad, slugs.Funded].join(',')}`,
      ).expect(200)
    ).body.data as {
      items: Array<{ slug: string; university: { country: { slug: string } } }>;
      invalid: string[];
    };
    expect(body.items.map((row) => row.slug)).toEqual([
      slugs.Scored,
      slugs.Abroad,
    ]);
    expect(body.items[0].university.country.slug).toBe(home);
    /* Four are kept, the fifth is not asked about at all. */
    expect(body.invalid).toEqual([slugs.AtDraft, slugs.AtHidden]);
  });

  it('resolves a bare /courses/<slug> to a live programme, and nothing else', async () => {
    const found = await get(`/course-slugs/${slugs.Scored}`).expect(200);
    expect(found.body.data).toEqual({
      kind: 'programme',
      path: `/study-abroad/${home}/universities/pr-e2e-north-${suffix}/courses/${slugs.Scored}`,
    });
    await get(`/course-slugs/${slugs.AtHidden}`).expect(404);
    await get(`/course-slugs/nothing-${suffix}`).expect(404);
  });

  it('suggests the university and lists the addresses of live programmes', async () => {
    const suggestions = (
      await get(`/programmes/suggestions?q=PR E2E North ${suffix}`).expect(200)
    ).body.data as Array<{ label: string; kind: string; href: string }>;
    expect(suggestions).toContainEqual({
      label: `PR E2E North ${suffix}`,
      kind: 'university',
      href: `/courses?university=pr-e2e-north-${suffix}`,
    });
    const addresses = await get('/programmes/addresses?limit=5000').expect(200);
    const ours = (addresses.body.data as Array<{ slug: string }>)
      .map((row) => row.slug)
      .filter((slug) => slug.includes(suffix));
    expect(ours.sort()).toEqual(
      [slugs.Scored, slugs.Funded, slugs.Drafted, slugs.Abroad].sort(),
    );
  });
});
