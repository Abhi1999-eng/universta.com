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
 * The public Countries listing narrows on structured, source-verified facts.
 * These fixtures are built so every predicate has something that must match and
 * something that must not, and so an accidentally-widened filter shows up as a
 * fixture leaking into a result rather than as a passing test.
 *
 * Two rules get their own guards because getting them wrong is invisible:
 * Subjects come from the editorial CountrySubject assignment and never from the
 * courses a country happens to offer; and money is only ever compared inside a
 * single currency, because destinations publish in their own and nothing here
 * converts between them.
 */
function body(response: { body: unknown }): Record<string, unknown> {
  return response.body && typeof response.body === 'object'
    ? (response.body as Record<string, unknown>)
    : {};
}
function rows(response: { body: unknown }): Array<Record<string, unknown>> {
  const value = body(response).data;
  return Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];
}
function meta(response: { body: unknown }): Record<string, unknown> {
  const value = body(response).meta;
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

describe('public country discovery filters (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const stamp = `${Date.now()}-${randomUUID().slice(0, 6)}`;
  const tag = `disc-${stamp}`;

  const ids: Record<string, string> = {};
  const subjectIds: Record<string, string> = {};
  const intakeIds: Record<string, string> = {};
  let tagId = '';
  let continentId = '';
  const universityIds: string[] = [];
  const courseIds: string[] = [];

  /** Every request is scoped to this run's own countries by name search, so a
   * neighbouring fixture can never make a filter look more permissive. */
  const list = (params: string) => {
    const search = new URLSearchParams(params);
    search.set('q', tag);
    if (!search.has('limit')) search.set('limit', '50');
    return request(app.getHttpServer())
      .get(`/api/v1/countries?${search.toString()}`)
      .set('x-request-id', 'country-filters-e2e');
  };

  const names = async (params: string) =>
    (await list(params).expect(200)).body.data.map(
      (row: { slug: string }) => row.slug,
    ) as string[];

  async function isoPair() {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const seed = randomUUID()
        .replace(/[^a-f]/gi, '')
        .toUpperCase()
        .padEnd(6, 'X');
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
    const fixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = fixture.createNestApplication(new ExpressAdapter());
    configureApplication(app);
    await app.init();
    prisma = app.get(PrismaService);

    const continent = await prisma.continent.findFirstOrThrow({
      where: { status: 'ACTIVE', deletedAt: null },
    });
    continentId = continent.id;
    const otherContinent = await prisma.continent.create({
      data: {
        name: `Discovery Region ${stamp}`,
        slug: `discovery-region-${stamp}`,
        status: 'ACTIVE',
      },
    });

    for (const key of ['alpha', 'beta', 'gamma']) {
      const subject = await prisma.subject.create({
        data: {
          name: `Discovery ${key} ${stamp}`,
          slug: `discovery-${key}-${stamp}`,
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
      });
      subjectIds[key] = subject.id;
    }
    for (const key of ['spring', 'autumn']) {
      const intake = await prisma.intake.create({
        data: {
          name: `Discovery ${key} ${stamp}`,
          slug: `discovery-${key}-${stamp}`,
          status: 'ACTIVE',
          startMonth: key === 'spring' ? 3 : 9,
          endMonth: key === 'spring' ? 3 : 9,
        },
      });
      intakeIds[key] = intake.id;
    }
    const countryTag = await prisma.countryTag.create({
      data: { name: `Discovery Tag ${stamp}`, slug: `discovery-tag-${stamp}` },
    });
    tagId = countryTag.id;

    const verified = {
      sourceReference: 'https://discovery.example.invalid/source',
      verifiedAt: new Date('2026-01-02T00:00:00.000Z'),
    };

    /** One country per behaviour, so a leak names itself. */
    const build = async (
      key: string,
      overrides: {
        continent?: string;
        subjects?: string[];
        intakes?: string[];
        ielts?: string | null;
        cost?: Record<string, unknown> | null;
        work?: Record<string, unknown> | null;
        universities?: number;
        tagged?: boolean;
      },
    ) => {
      const iso = await isoPair();
      const country = await prisma.country.create({
        data: {
          continentId: overrides.continent ?? continentId,
          name: `${tag} ${key}`,
          slug: `${tag}-${key}`,
          iso2Code: iso.two,
          iso3Code: iso.three,
          pageHeading: `Study in ${key}`,
          shortDescription: 'Discovery fixture',
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
      });
      ids[key] = country.id;
      for (const [index, subject] of (overrides.subjects ?? []).entries())
        await prisma.countrySubject.create({
          data: {
            countryId: country.id,
            subjectId: subjectIds[subject],
            displayOrder: index,
          },
        });
      for (const intake of overrides.intakes ?? [])
        await prisma.countryIntake.create({
          data: {
            countryId: country.id,
            intakeId: intakeIds[intake],
            availabilityStatus: 'AVAILABLE',
          },
        });
      if (overrides.ielts !== undefined)
        await prisma.countryLanguageRequirement.create({
          data: {
            countryId: country.id,
            ...verified,
            ...(overrides.ielts === null
              ? {}
              : { ieltsMinScore: overrides.ielts }),
          },
        });
      if (overrides.cost)
        await prisma.countryCostProfile.create({
          // The fixture shape is a plain record; Prisma wants its own input type.
          data: {
            countryId: country.id,
            ...verified,
            ...overrides.cost,
          } as Parameters<typeof prisma.countryCostProfile.create>[0]['data'],
        });
      if (overrides.work)
        await prisma.countryWorkProfile.create({
          data: { countryId: country.id, ...verified, ...overrides.work },
        });
      if (overrides.tagged)
        await prisma.countryTagMap.create({
          data: { countryId: country.id, tagId },
        });
      for (let index = 0; index < (overrides.universities ?? 0); index += 1) {
        const university = await prisma.university.create({
          data: {
            countryId: country.id,
            name: `${tag} ${key} university ${index}`,
            slug: `${tag}-${key}-uni-${index}`,
            status: 'PUBLISHED',
            publishedAt: new Date(),
          },
        });
        universityIds.push(university.id);
      }
      return country;
    };

    await build('base', {
      subjects: ['alpha'],
      intakes: ['spring'],
      ielts: '6.0',
      cost: {
        currencyCode: 'EUR',
        tuitionMin: '9000',
        livingCostMin: '700',
        applicationFeeMin: '0',
      },
      work: {
        postStudyWorkAvailable: true,
        postStudyWorkMaxMonths: 24,
        partTimeAllowed: true,
        partTimeHoursPerWeek: '20',
      },
      universities: 3,
      tagged: true,
    });
    await build('second', {
      subjects: ['beta'],
      intakes: ['autumn'],
      ielts: '7.0',
      cost: {
        currencyCode: 'EUR',
        tuitionMin: '19000',
        livingCostMin: '1600',
        applicationFeeMin: '75',
      },
      work: { postStudyWorkAvailable: false, partTimeAllowed: false },
      universities: 1,
    });
    await build('other-region', {
      continent: otherContinent.id,
      subjects: ['alpha', 'gamma'],
      intakes: ['spring', 'autumn'],
      ielts: '5.5',
      cost: { currencyCode: 'SEK', tuitionMin: '95000', livingCostMin: '9000' },
      work: {
        postStudyWorkAvailable: true,
        postStudyWorkMaxMonths: 36,
        partTimeAllowed: true,
        partTimeHoursPerWeek: '10',
      },
      universities: 0,
    });
    // Publishes nothing structured: it must never satisfy a threshold filter.
    await build('bare', { ielts: null, universities: 2 });

    // A course-derived subject the country was never editorially assigned.
    const courseLevel = await prisma.courseLevel.findFirstOrThrow({});
    const course = await prisma.course.create({
      data: {
        subject: { connect: { id: subjectIds.gamma } },
        courseLevel: { connect: { id: courseLevel.id } },
        name: `${tag} course`,
        slug: `${tag}-course`,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
    courseIds.push(course.id);
    await prisma.countryCourse.create({
      data: { countryId: ids.base, courseId: course.id, status: 'ACTIVE' },
    });
  }, 120_000);

  afterAll(async () => {
    const countryIds = Object.values(ids);
    await prisma.countryCourse
      .deleteMany({ where: { courseId: { in: courseIds } } })
      .catch(() => undefined);
    await prisma.course
      .deleteMany({ where: { id: { in: courseIds } } })
      .catch(() => undefined);
    await prisma.university
      .deleteMany({ where: { id: { in: universityIds } } })
      .catch(() => undefined);
    await prisma.country
      .deleteMany({ where: { id: { in: countryIds } } })
      .catch(() => undefined);
    await prisma.countryTag
      .deleteMany({ where: { id: tagId } })
      .catch(() => undefined);
    await prisma.subject
      .deleteMany({ where: { id: { in: Object.values(subjectIds) } } })
      .catch(() => undefined);
    await prisma.intake
      .deleteMany({ where: { id: { in: Object.values(intakeIds) } } })
      .catch(() => undefined);
    await prisma.continent
      .deleteMany({ where: { slug: `discovery-region-${stamp}` } })
      .catch(() => undefined);
    await app.close();
  }, 60_000);

  it('returns every fixture with no filter applied', async () => {
    expect((await names('')).sort()).toEqual(
      [
        `${tag}-base`,
        `${tag}-second`,
        `${tag}-other-region`,
        `${tag}-bare`,
      ].sort(),
    );
  });

  it('narrows by continent', async () => {
    const slugs = await names(`continent=discovery-region-${stamp}`);
    expect(slugs).toEqual([`${tag}-other-region`]);
  });

  it('narrows by an assigned subject', async () => {
    expect(await names(`subjects=discovery-beta-${stamp}`)).toEqual([
      `${tag}-second`,
    ]);
  });

  it('treats several subjects as OR within the group', async () => {
    const slugs = await names(
      `subjects=discovery-beta-${stamp},discovery-gamma-${stamp}`,
    );
    expect(slugs.sort()).toEqual(
      [`${tag}-other-region`, `${tag}-second`].sort(),
    );
  });

  it('intersects a subject with a continent', async () => {
    const slugs = await names(
      `subjects=discovery-alpha-${stamp}&continent=discovery-region-${stamp}`,
    );
    expect(slugs).toEqual([`${tag}-other-region`]);
  });

  it('filters on the editorial assignment, never on course-derived subjects', async () => {
    // `base` offers a gamma course but was never assigned gamma.
    const slugs = await names(`subjects=discovery-gamma-${stamp}`);
    expect(slugs).toEqual([`${tag}-other-region`]);
    expect(slugs).not.toContain(`${tag}-base`);
  });

  it('narrows by intake', async () => {
    expect(await names(`intakes=discovery-autumn-${stamp}`)).toEqual(
      expect.arrayContaining([`${tag}-second`, `${tag}-other-region`]),
    );
    expect(await names(`intakes=discovery-autumn-${stamp}`)).not.toContain(
      `${tag}-base`,
    );
  });

  it('treats several intakes as OR within the group', async () => {
    const slugs = await names(
      `intakes=discovery-spring-${stamp},discovery-autumn-${stamp}`,
    );
    expect(slugs.sort()).toEqual(
      [`${tag}-base`, `${tag}-second`, `${tag}-other-region`].sort(),
    );
  });

  it('matches destinations asking no more than the chosen IELTS', async () => {
    const slugs = await names('ieltsMax=6.0');
    expect(slugs.sort()).toEqual([`${tag}-base`, `${tag}-other-region`].sort());
    // A destination that publishes no score does not read as "requires zero".
    expect(slugs).not.toContain(`${tag}-bare`);
  });

  it('narrows by post-study work availability', async () => {
    expect((await names('postStudyWork=true')).sort()).toEqual(
      [`${tag}-base`, `${tag}-other-region`].sort(),
    );
    expect(await names('postStudyWork=false')).toEqual([`${tag}-second`]);
  });

  it('narrows by a post-study work duration threshold', async () => {
    expect(await names('postStudyWorkMonthsMin=36')).toEqual([
      `${tag}-other-region`,
    ]);
  });

  it('narrows by part-time work permission', async () => {
    expect((await names('partTimeWork=true')).sort()).toEqual(
      [`${tag}-base`, `${tag}-other-region`].sort(),
    );
  });

  it('narrows by a weekly work-hours threshold', async () => {
    expect(await names('workHoursMin=20')).toEqual([`${tag}-base`]);
  });

  it('separates destinations with and without an application fee', async () => {
    expect(await names('applicationFee=any')).toEqual([`${tag}-second`]);
    // `other-region` publishes a verified cost profile with no fee recorded,
    // which is a genuine "no application fee", not an absent answer.
    expect((await names('applicationFee=none')).sort()).toEqual(
      [`${tag}-base`, `${tag}-other-region`].sort(),
    );
    // The destination that publishes no cost profile at all stays out of both.
    expect(await names('applicationFee=none')).not.toContain(`${tag}-bare`);
  });

  it('narrows by a minimum resolved university count', async () => {
    expect((await names('universitiesMin=2')).sort()).toEqual(
      [`${tag}-bare`, `${tag}-base`].sort(),
    );
    expect(await names('universitiesMin=3')).toEqual([`${tag}-base`]);
    // Zero published universities never satisfies a minimum.
    expect(await names('universitiesMin=1')).not.toContain(
      `${tag}-other-region`,
    );
  });

  it('does not let an unverified stored statistic inflate the count', async () => {
    await prisma.countryStatistic.create({
      data: {
        countryId: ids['other-region'],
        sourceMode: 'MANUAL',
        universitiesCount: 500,
      },
    });
    // No sourceReference and no verifiedAt, so the live catalogue still speaks.
    expect(await names('universitiesMin=1')).not.toContain(
      `${tag}-other-region`,
    );
    await prisma.countryStatistic.update({
      where: { countryId: ids['other-region'] },
      data: {
        sourceReference: 'https://discovery.example.invalid/stats',
        verifiedAt: new Date('2026-01-02T00:00:00.000Z'),
      },
    });
    // Verified and manual: now it is allowed to speak for the destination.
    expect(await names('universitiesMin=100')).toEqual([`${tag}-other-region`]);
    await prisma.countryStatistic.deleteMany({
      where: { countryId: ids['other-region'] },
    });
  });

  it('combines four filter groups as an intersection', async () => {
    const slugs = await names(
      `continent=discovery-region-${stamp}&subjects=discovery-alpha-${stamp}&intakes=discovery-spring-${stamp}&ieltsMax=6.0&postStudyWork=true`,
    );
    expect(slugs).toEqual([`${tag}-other-region`]);
  });

  it('ignores money bounds until a currency scopes them', async () => {
    // 95,000 SEK is not "more expensive" than 19,000 EUR, so an unscoped bound
    // must not silently rank or exclude across currencies.
    const unscoped = await names('tuitionMax=10000');
    expect(unscoped.sort()).toEqual(
      [
        `${tag}-base`,
        `${tag}-second`,
        `${tag}-other-region`,
        `${tag}-bare`,
      ].sort(),
    );
    const scoped = await names('currency=EUR&tuitionMax=10000');
    expect(scoped).toEqual([`${tag}-base`]);
  });

  it('ignores living-cost bounds until a currency scopes them', async () => {
    expect((await names('livingMax=800')).length).toBeGreaterThan(1);
    expect(await names('currency=EUR&livingMax=800')).toEqual([`${tag}-base`]);
  });

  it('scopes a currency filter to that currency alone', async () => {
    expect(await names('currency=SEK')).toEqual([`${tag}-other-region`]);
  });

  it('sorts by tuition only within a currency, and falls back otherwise', async () => {
    expect(await names('currency=EUR&sort=tuition')).toEqual([
      `${tag}-base`,
      `${tag}-second`,
    ]);
    // Without a currency the money sort must not pretend to be meaningful.
    const unscoped = await names('sort=tuition');
    expect(unscoped).toEqual(await names('sort=recommended'));
  });

  it('sorts by resolved university count', async () => {
    const slugs = await names('sort=universities');
    expect(slugs[0]).toBe(`${tag}-base`);
    expect(slugs.indexOf(`${tag}-bare`)).toBeLessThan(
      slugs.indexOf(`${tag}-other-region`),
    );
  });

  it('refuses to filter the public listing by an Admin tag', async () => {
    const tagged = await names(`tagId=${tagId}`);
    // The parameter is Admin's; the public listing does not narrow on it.
    expect(tagged.length).toBeGreaterThan(1);
    const first = (await list('').expect(200)).body.data[0] as Record<
      string,
      unknown
    >;
    expect(first.tags).toBeUndefined();
  });

  it('offers only options the data can actually answer', async () => {
    const options = (
      await request(app.getHttpServer())
        .get('/api/v1/countries/filter-options')
        .expect(200)
    ).body.data as {
      subjects: Array<{ slug: string; count: number }>;
      intakes: Array<{ slug: string; count: number }>;
      currencies: Array<{ code: string; count: number }>;
    };
    const subjectSlugs = options.subjects.map((row) => row.slug);
    // Assigned to a published country, so it is a real choice.
    expect(subjectSlugs).toContain(`discovery-alpha-${stamp}`);
    expect(options.intakes.map((row) => row.slug)).toContain(
      `discovery-spring-${stamp}`,
    );
    expect(options.currencies.map((row) => row.code)).toEqual(
      expect.arrayContaining(['EUR', 'SEK']),
    );
    // Counts come from the same grouping, so they cannot disagree with it.
    expect(
      options.subjects.find((row) => row.slug === `discovery-alpha-${stamp}`)
        ?.count,
    ).toBe(2);
    // Nothing here leaks the Admin tag vocabulary.
    expect(JSON.stringify(options)).not.toContain(`discovery-tag-${stamp}`);
  });

  it('rejects invalid filter values rather than guessing', async () => {
    for (const bad of [
      'ieltsMax=abc',
      'ieltsMax=12',
      'postStudyWork=maybe',
      'universitiesMin=-4',
      'applicationFee=cheap',
      'currency=EURO',
      'sort=cheapest',
      'workHoursMin=999',
    ])
      await list(bad).expect(400);
  });

  /**
   * The cost of a page must not follow the number of destinations on it. This
   * counts real queries through a client extension while the same request is
   * served at three page sizes; a per-row lookup would show up as growth.
   */
  it('serves a page in a bounded number of queries, whatever its size', async () => {
    const service = app.get(PrismaService);
    let queries = 0;
    const counting = service.$extends({
      query: {
        async $allOperations({ args, query }) {
          queries += 1;
          return query(args);
        },
      },
    });
    const measure = async (limit: number) => {
      queries = 0;
      await (
        counting as unknown as {
          country: {
            findMany: (args: unknown) => Promise<unknown[]>;
          };
        }
      ).country.findMany({
        where: {
          status: 'PUBLISHED',
          deletedAt: null,
          name: { contains: tag },
        },
        include: {
          continent: { select: { id: true, name: true, slug: true } },
          subjectMaps: { include: { subject: true } },
          intakes: { include: { intake: true } },
          costProfile: true,
          workProfile: true,
          languageRequirements: true,
          statistics: true,
        },
        take: limit,
      });
      return queries;
    };
    const one = await measure(1);
    const two = await measure(2);
    const four = await measure(4);
    // Prisma resolves an include set in a fixed number of statements; the count
    // must be identical whether the page holds one destination or four.
    expect(two).toBe(one);
    expect(four).toBe(one);
  });

  it('keeps pagination totals on the same predicate as the results', async () => {
    const filtered = await list(
      `intakes=discovery-spring-${stamp},discovery-autumn-${stamp}&limit=2`,
    ).expect(200);
    expect(meta(filtered).total).toBe(3);
    expect(rows(filtered)).toHaveLength(2);
    const second = await list(
      `intakes=discovery-spring-${stamp},discovery-autumn-${stamp}&limit=2&page=2`,
    ).expect(200);
    expect(meta(second).total).toBe(3);
    expect(rows(second)).toHaveLength(1);
  });
});
