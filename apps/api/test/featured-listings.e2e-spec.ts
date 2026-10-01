import type { INestApplication } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';

type RecordValue = Record<string, unknown>;
function record(value: unknown): RecordValue {
  return value && typeof value === 'object' ? (value as RecordValue) : {};
}
function body(response: { body: unknown }): RecordValue {
  return record(response.body);
}
function arrayData(response: { body: unknown }): RecordValue[] {
  const value = body(response).data;
  return Array.isArray(value) ? (value as RecordValue[]) : [];
}
// The offerings-listing endpoint wraps its array under an extra `data.data`
// (alongside a `university` summary), unlike the flat resource-list envelope.
function offeringRows(response: { body: unknown }): RecordValue[] {
  const value = record(body(response).data).data;
  return Array.isArray(value) ? (value as RecordValue[]) : [];
}

describe('Featured listings and advanced filters (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const suffix = randomUUID().slice(0, 8);
  let countryId = '';
  const universityIds: string[] = [];
  let courseId = '';
  let courseLevelId = '';
  const offeringIds: string[] = [];

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
    if (!continent) throw new Error('A continent fixture is required');
    const country = await prisma.country.create({
      data: {
        continentId: continent.id,
        name: `Featured E2E Country ${suffix}`,
        pageHeading: `Study in Featured E2E Country ${suffix}`,
        slug: `featured-e2e-${suffix}`,
        shortDescription:
          'Fictional country used only for featured-listing e2e coverage.',
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
    countryId = country.id;

    const now = new Date();
    const past = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const future = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const expired = await prisma.university.create({
      data: {
        countryId,
        name: `Featured E2E Expired University ${suffix}`,
        slug: `featured-e2e-expired-university-${suffix}`,
        status: 'PUBLISHED',
        publishedAt: now,
        isFeatured: true,
        featuredUntil: past,
      },
    });
    const priorityTwo = await prisma.university.create({
      data: {
        countryId,
        name: `Featured E2E Priority Two University ${suffix}`,
        slug: `featured-e2e-priority-two-university-${suffix}`,
        status: 'PUBLISHED',
        publishedAt: now,
        isFeatured: true,
        featuredPriority: 2,
      },
    });
    const priorityOne = await prisma.university.create({
      data: {
        countryId,
        name: `Featured E2E Priority One University ${suffix}`,
        slug: `featured-e2e-priority-one-university-${suffix}`,
        status: 'PUBLISHED',
        publishedAt: now,
        isFeatured: true,
        featuredPriority: 1,
        featuredFrom: past,
        featuredUntil: future,
      },
    });
    const plain = await prisma.university.create({
      data: {
        countryId,
        name: `Featured E2E Plain University ${suffix}`,
        slug: `featured-e2e-plain-university-${suffix}`,
        status: 'PUBLISHED',
        publishedAt: now,
      },
    });
    universityIds.push(expired.id, priorityTwo.id, priorityOne.id, plain.id);

    const withCampus = await prisma.university.create({
      data: {
        countryId,
        name: `Featured E2E Campus University ${suffix}`,
        slug: `featured-e2e-campus-university-${suffix}`,
        status: 'PUBLISHED',
        publishedAt: now,
        campuses: {
          create: {
            name: `Featured E2E Campus ${suffix}`,
            slug: `featured-e2e-campus-${suffix}`,
            city: `Vancouver E2E ${suffix}`,
            state: `British Columbia E2E ${suffix}`,
            status: 'ACTIVE',
          },
        },
      },
    });
    universityIds.push(withCampus.id);

    const subject = await prisma.subject.findFirst({
      where: { deletedAt: null },
    });
    const level = await prisma.courseLevel.findFirst({});
    if (!subject || !level)
      throw new Error('Subject and CourseLevel fixtures are required');
    courseLevelId = level.id;
    const otherLevel = await prisma.courseLevel.findFirst({
      where: { id: { not: level.id } },
    });
    const course = await prisma.course.create({
      data: {
        subjectId: subject.id,
        courseLevelId: level.id,
        name: `Featured E2E Course ${suffix}`,
        slug: `featured-e2e-course-${suffix}`,
        status: 'PUBLISHED',
        publishedAt: now,
      },
    });
    courseId = course.id;

    const cheap = await prisma.universityCourseOffering.create({
      data: {
        universityId: plain.id,
        genericCourseId: courseId,
        name: `Featured E2E Cheap Offering ${suffix}`,
        slug: `featured-e2e-cheap-offering-${suffix}`,
        status: 'PUBLISHED',
        publishedAt: now,
        courseLevelId: level.id,
        tuitionMin: 1000,
        tuitionMax: 2000,
      },
    });
    const expensive = await prisma.universityCourseOffering.create({
      data: {
        universityId: plain.id,
        genericCourseId: courseId,
        name: `Featured E2E Expensive Offering ${suffix}`,
        slug: `featured-e2e-expensive-offering-${suffix}`,
        status: 'PUBLISHED',
        publishedAt: now,
        courseLevelId: otherLevel?.id ?? level.id,
        tuitionMin: 50000,
        tuitionMax: 60000,
      },
    });
    offeringIds.push(cheap.id, expensive.id);
  });

  afterAll(async () => {
    if (offeringIds.length)
      await prisma.universityCourseOffering.deleteMany({
        where: { id: { in: offeringIds } },
      });
    if (courseId) await prisma.course.deleteMany({ where: { id: courseId } });
    if (universityIds.length) {
      await prisma.universityCampus.deleteMany({
        where: { universityId: { in: universityIds } },
      });
      await prisma.university.deleteMany({
        where: { id: { in: universityIds } },
      });
    }
    if (countryId)
      await prisma.country.deleteMany({ where: { id: countryId } });
    await app.close();
  });

  it('lists universities in the catalogue\u2019s own order, whatever the old flag says', async () => {
    /* These fixtures still carry isFeatured, featuredPriority and a featured
       window, because the columns are still there. Nothing reads them now:
       the list is display order, then name. The fixtures share a display
       order, so this is the alphabetical fallback -- and a row that was once
       "priority 1" no longer jumps the queue. */
    const response = await request(app.getHttpServer())
      .get('/api/v1/phase1/universities')
      .query({ country: `featured-e2e-${suffix}`, limit: '20' })
      .expect(200);
    const names = arrayData(response).map((row) => String(row.name));
    const ours = names.filter(
      (name) => name.includes(`E2E`) && name.includes(suffix),
    );
    expect(ours.length).toBeGreaterThanOrEqual(3);
    expect(ours).toEqual([...ours].sort((a, b) => a.localeCompare(b)));
  });

  it('filters universities by campus city and state', async () => {
    const byCity = await request(app.getHttpServer())
      .get('/api/v1/phase1/universities')
      .query({ city: `Vancouver E2E ${suffix}` })
      .expect(200);
    expect(
      arrayData(byCity).some(
        (row) => row.name === `Featured E2E Campus University ${suffix}`,
      ),
    ).toBe(true);

    const byState = await request(app.getHttpServer())
      .get('/api/v1/phase1/universities')
      .query({ state: `British Columbia E2E ${suffix}` })
      .expect(200);
    expect(
      arrayData(byState).some(
        (row) => row.name === `Featured E2E Campus University ${suffix}`,
      ),
    ).toBe(true);

    const noMatch = await request(app.getHttpServer())
      .get('/api/v1/phase1/universities')
      .query({ city: `Nowhere E2E ${suffix}` })
      .expect(200);
    expect(
      arrayData(noMatch).some(
        (row) => row.name === `Featured E2E Campus University ${suffix}`,
      ),
    ).toBe(false);
  });

  it('filters offerings by tuition range and course level', async () => {
    const universitySlug = `featured-e2e-plain-university-${suffix}`;

    const cheapOnly = await request(app.getHttpServer())
      .get(`/api/v1/phase1/universities/${universitySlug}/courses`)
      .query({ tuitionMax: '5000' })
      .expect(200);
    const cheapNames = offeringRows(cheapOnly).map((row) => String(row.name));
    expect(cheapNames).toContain(`Featured E2E Cheap Offering ${suffix}`);
    expect(cheapNames).not.toContain(
      `Featured E2E Expensive Offering ${suffix}`,
    );

    const expensiveOnly = await request(app.getHttpServer())
      .get(`/api/v1/phase1/universities/${universitySlug}/courses`)
      .query({ tuitionMin: '40000' })
      .expect(200);
    const expensiveNames = offeringRows(expensiveOnly).map((row) =>
      String(row.name),
    );
    expect(expensiveNames).toContain(
      `Featured E2E Expensive Offering ${suffix}`,
    );
    expect(expensiveNames).not.toContain(
      `Featured E2E Cheap Offering ${suffix}`,
    );

    const byLevel = await request(app.getHttpServer())
      .get(`/api/v1/phase1/universities/${universitySlug}/courses`)
      .query({
        courseLevel: (
          await prisma.courseLevel.findUniqueOrThrow({
            where: { id: courseLevelId },
            select: { code: true },
          })
        ).code,
      })
      .expect(200);
    const levelNames = offeringRows(byLevel).map((row) => String(row.name));
    expect(levelNames).toContain(`Featured E2E Cheap Offering ${suffix}`);
  });
});
