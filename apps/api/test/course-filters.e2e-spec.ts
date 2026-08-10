import { ExpressAdapter } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/bootstrap';

type Option = {
  value: string;
  label: string;
  count: number;
};
type PublicCourse = {
  id: string;
  name: string;
  subject: { slug: string };
  courseLevel: { code: string };
  studyModes: Array<{ code: string }>;
  selectedCountry: { slug: string } | null;
  selectedTuition: {
    min: string | null;
    currencyCode: string | null;
  } | null;
  scholarshipAvailable: boolean | null;
};

function envelope(response: { body: unknown }) {
  return response.body as {
    data: unknown;
    meta: { page: number; limit: number; total: number; totalPages: number };
    error: { code: string; message: string } | null;
  };
}

function courses(response: { body: unknown }) {
  return envelope(response).data as PublicCourse[];
}

function options(response: { body: unknown }) {
  return envelope(response).data as {
    levels: Option[];
    countries: Array<Option & { currencyCode: string | null }>;
    subjects: Option[];
    subSubjects: Array<Option & { subject: { slug: string } }>;
    studyModes: Option[];
    intakes: Array<
      Option & { startMonth: number | null; endMonth: number | null }
    >;
    englishTests: Option[];
    extras: Option[];
    sorts: Array<{ value: string; label: string }>;
    tuition: {
      enabled: boolean;
      country: string | null;
      currencyCode: string | null;
    };
  };
}

describe('public course filter contract (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = fixture.createNestApplication(new ExpressAdapter());
    configureApplication(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('publishes only data-backed filter options and supported sort modes', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/courses/filter-options?pageSize=12')
      .expect(200);
    const filters = options(response);

    for (const group of [
      filters.levels,
      filters.countries,
      filters.subjects,
      filters.subSubjects,
      filters.studyModes,
      filters.intakes,
      filters.englishTests,
      filters.extras,
    ]) {
      expect(group.length).toBeGreaterThan(0);
      expect(group.every((option) => option.count > 0)).toBe(true);
    }
    expect(filters.englishTests.map((option) => option.value)).toEqual([
      'IELTS',
    ]);
    expect(filters.extras.map((option) => option.value)).toEqual(
      expect.arrayContaining([
        'scholarshipAvailable',
        'postStudyWorkAvailable',
      ]),
    );
    expect(filters.sorts.map((sort) => sort.value)).toEqual(
      expect.arrayContaining(['featured', 'popularity', 'name', 'newest']),
    );
    expect(filters.sorts.map((sort) => sort.value)).not.toEqual(
      expect.arrayContaining([
        'top-ranked',
        'budget-friendly',
        'highest-salary',
      ]),
    );
    expect(filters.tuition).toEqual({
      enabled: false,
      country: null,
      currencyCode: null,
    });
  });

  it.each([
    ['level', 'UG'],
    ['country', 'canada'],
    ['subject', 'computer-science'],
    ['subSubject', 'cybersecurity'],
    ['studyMode', 'FULL_TIME'],
    ['intake', 'january'],
    ['englishTest', 'IELTS'],
  ])('applies the supported %s filter', async (key, value) => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/courses?${key}=${value}&pageSize=100`)
      .expect(200);

    expect(envelope(response).meta.total).toBeGreaterThan(0);
    expect(courses(response).length).toBe(envelope(response).meta.total);
    expect(new Set(courses(response).map((course) => course.id)).size).toBe(
      courses(response).length,
    );
  });

  it('uses OR within a dimension and AND across different dimensions', async () => {
    const response = await request(app.getHttpServer())
      .get(
        '/api/v1/courses?subject=computer-science,business-management&level=UG,DIPLOMA&country=canada&pageSize=100',
      )
      .expect(200);
    const rows = courses(response);

    expect(rows.length).toBeGreaterThan(0);
    expect(
      rows.every((course) =>
        ['computer-science', 'business-management'].includes(
          course.subject.slug,
        ),
      ),
    ).toBe(true);
    expect(
      rows.every((course) =>
        ['UG', 'DIPLOMA'].includes(course.courseLevel.code),
      ),
    ).toBe(true);
    expect(
      rows.every((course) => course.selectedCountry?.slug === 'canada'),
    ).toBe(true);
  });

  it('supports keyword, scholarship, verified-work, and zero-result queries', async () => {
    const keyword = await request(app.getHttpServer())
      .get('/api/v1/courses?q=cyber&pageSize=100')
      .expect(200);
    expect(courses(keyword).some((course) => /cyber/i.test(course.name))).toBe(
      true,
    );

    const scholarships = await request(app.getHttpServer())
      .get('/api/v1/courses?scholarshipAvailable=true&pageSize=100')
      .expect(200);
    expect(courses(scholarships).length).toBeGreaterThan(0);
    expect(
      courses(scholarships).every(
        (course) => course.scholarshipAvailable === true,
      ),
    ).toBe(true);

    const postStudyWork = await request(app.getHttpServer())
      .get('/api/v1/courses?postStudyWorkAvailable=true&pageSize=100')
      .expect(200);
    expect(courses(postStudyWork).length).toBeGreaterThan(0);

    const empty = await request(app.getHttpServer())
      .get('/api/v1/courses?q=no-such-published-course-zzzz&pageSize=100')
      .expect(200);
    expect(courses(empty)).toEqual([]);
    expect(envelope(empty).meta.total).toBe(0);
  });

  it('enables comparable tuition filtering for exactly one destination', async () => {
    const filterResponse = await request(app.getHttpServer())
      .get('/api/v1/courses/filter-options?country=canada&pageSize=12')
      .expect(200);
    expect(options(filterResponse).tuition).toMatchObject({
      enabled: true,
      country: 'canada',
      currencyCode: 'CAD',
    });
    expect(options(filterResponse).sorts.map((sort) => sort.value)).toContain(
      'tuition-low',
    );

    const sorted = await request(app.getHttpServer())
      .get('/api/v1/courses?country=canada&sort=tuition-low&pageSize=100')
      .expect(200);
    const amounts = courses(sorted)
      .map((course) => Number(course.selectedTuition?.min))
      .filter(Number.isFinite);
    expect(amounts.length).toBeGreaterThan(1);
    expect(amounts).toEqual([...amounts].sort((left, right) => left - right));

    const minimum = amounts[0];
    const maximum = amounts[amounts.length - 1];
    const ranged = await request(app.getHttpServer())
      .get(
        `/api/v1/courses?country=canada&minTuition=${minimum}&maxTuition=${maximum}&pageSize=100`,
      )
      .expect(200);
    expect(courses(ranged).length).toBeGreaterThan(0);
    expect(
      courses(ranged).every((course) => {
        const amount = Number(course.selectedTuition?.min);
        return amount >= minimum && amount <= maximum;
      }),
    ).toBe(true);

    const withoutCountry = await request(app.getHttpServer()).get(
      '/api/v1/courses?minTuition=1000',
    );
    expect(withoutCountry.status).toBe(400);
    expect(envelope(withoutCountry).error?.code).toBe(
      'COURSE_TUITION_COUNTRY_REQUIRED',
    );

    const multipleCountries = await request(app.getHttpServer()).get(
      '/api/v1/courses?country=canada,united-kingdom&sort=tuition-low',
    );
    expect(multipleCountries.status).toBe(400);
    expect(envelope(multipleCountries).error?.code).toBe(
      'COURSE_TUITION_COUNTRY_REQUIRED',
    );
  });

  it('paginates and orders deterministically without duplicate records', async () => {
    const first = await request(app.getHttpServer())
      .get('/api/v1/courses?sort=name&page=1&pageSize=3')
      .expect(200);
    const second = await request(app.getHttpServer())
      .get('/api/v1/courses?sort=name&page=2&pageSize=3')
      .expect(200);
    const firstRows = courses(first);
    const secondRows = courses(second);
    const names = [...firstRows, ...secondRows].map((course) => course.name);

    expect(envelope(first).meta).toMatchObject({ page: 1, limit: 3 });
    expect(envelope(second).meta).toMatchObject({ page: 2, limit: 3 });
    expect(
      new Set([...firstRows, ...secondRows].map((course) => course.id)).size,
    ).toBe(firstRows.length + secondRows.length);
    expect(names).toEqual(
      [...names].sort((left, right) => left.localeCompare(right)),
    );
  });

  it.each([
    [
      '/api/v1/courses?subject=not-a-published-subject',
      'COURSE_FILTER_OPTION_INVALID',
    ],
    ['/api/v1/courses?scholarshipAvailable=maybe', 'VALIDATION_ERROR'],
    ['/api/v1/courses?sort=highest-salary', 'VALIDATION_ERROR'],
    [
      '/api/v1/courses?minTuition=5000&maxTuition=1000&country=canada',
      'COURSE_TUITION_RANGE_INVALID',
    ],
    ['/api/v1/courses?unknownFilter=true', 'VALIDATION_ERROR'],
  ])('rejects malformed or unsupported query %s', async (path, code) => {
    const response = await request(app.getHttpServer()).get(path);
    expect(response.status).toBe(400);
    expect(envelope(response).error?.code).toBe(code);
  });
});
