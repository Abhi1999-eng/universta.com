import type { INestApplication } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/bootstrap';
import { parseCsv, toCsv } from '../src/bulk/csv.util';
import { bulkResource } from '../src/bulk/bulk-resources';
import { PrismaService } from '../src/prisma/prisma.service';

function data(response: { body: unknown }) {
  return (response.body as { data: Record<string, unknown> }).data;
}

describe('Whole programme bulk import (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token = '';
  let universityId = '';
  let courseSlug = '';
  const suffix = randomUUID().slice(0, 8);
  const universitySlug = `whole-programme-uni-${suffix}`;
  const offeringSlug = `${universitySlug}-msc-data-science`;
  const row = {
    slug: offeringSlug,
    name: 'MSc Data Science',
    universitySlug,
    genericCourseSlug: '',
    campusSlug: '',
    courseLevelCode: 'PG',
    studyMode: 'FULL_TIME',
    currencyCode: 'GBP',
    tuitionMin: '28000',
    tuitionMax: '28000',
    status: 'PUBLISHED',
    courseCode: 'DS01',
    shortDescription: 'Study data science with a relevant prior degree.',
    overview: 'An imported programme overview.',
    durationMin: '1',
    durationMax: '1',
    durationUnit: 'YEARS',
    tuitionPeriod: 'PER_YEAR',
    applicationUrl: 'https://example.edu/programmes/data-science',
    sourceReference: 'https://example.edu/programmes/data-science',
    verifiedAt: '2026-10-06',
    intakes: '9:2027-01-15;1',
    ieltsMinimum: '6.5',
    toeflMinimum: '90',
    pteMinimum: '65',
    academicRequirement: 'A relevant honours degree.',
  };
  const admin = (method: 'get' | 'post', path: string) =>
    request(app.getHttpServer())
      [method](`/api/v1/admin/bulk/${path}`)
      .set('Authorization', `Bearer ${token}`);
  const upload = (values: Record<string, string>) =>
    admin('post', 'offerings/import')
      .field('mode', 'upsert')
      .attach(
        'file',
        Buffer.from(toCsv(Object.keys(values), [values])),
        'offerings.csv',
      )
      .expect(201);

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = fixture.createNestApplication(new ExpressAdapter());
    configureApplication(app);
    await app.init();
    prisma = app.get(PrismaService);
    const login = await request(app.getHttpServer())
      .post('/api/v1/admin/auth/login')
      .send({
        email: process.env.SEED_ADMIN_EMAIL,
        password: process.env.SEED_ADMIN_PASSWORD,
      })
      .expect(200);
    token = String(data(login).accessToken);
    const country = await prisma.country.findFirstOrThrow({
      where: { slug: 'canada', status: 'PUBLISHED', deletedAt: null },
    });
    const course = await prisma.course.findFirstOrThrow({
      where: { deletedAt: null },
    });
    courseSlug = course.slug;
    row.genericCourseSlug = courseSlug;
    universityId = (
      await prisma.university.create({
        data: {
          slug: universitySlug,
          name: `Whole programme university ${suffix}`,
          countryId: country.id,
          status: 'PUBLISHED',
        },
      })
    ).id;
  });

  afterAll(async () => {
    if (universityId) {
      await prisma.universityCourseOffering.deleteMany({
        where: { universityId },
      });
      await prisma.university.deleteMany({ where: { id: universityId } });
    }
    await app.close();
  });

  it('imports the complete sheet twice and exposes the same intakes and test requirements publicly', async () => {
    expect(bulkResource('offerings').columns).toEqual(Object.keys(row));
    expect(data(await upload(row))).toMatchObject({
      created: 1,
      failed: 0,
      errors: [],
    });
    const first = await prisma.universityCourseOffering.findUniqueOrThrow({
      where: { slug: offeringSlug },
      include: { intakes: true, requirements: true },
    });
    expect(data(await upload(row))).toMatchObject({
      created: 0,
      updated: 0,
      unchanged: 1,
      failed: 0,
      errors: [],
    });
    const second = await prisma.universityCourseOffering.findUniqueOrThrow({
      where: { slug: offeringSlug },
      include: { intakes: { include: { intake: true } }, requirements: true },
    });
    expect(second.intakes.map((entry) => entry.id).sort()).toEqual(
      first.intakes.map((entry) => entry.id).sort(),
    );
    expect(second.requirements.map((entry) => entry.id).sort()).toEqual(
      first.requirements.map((entry) => entry.id).sort(),
    );
    expect(second.requirements).toHaveLength(4);
    expect(second.intakes).toHaveLength(2);
    expect(second.courseCode).toBe('DS01');
    expect(Number(second.durationMin)).toBe(1);
    expect(second.tuitionPeriod).toBe('PER_YEAR');
    expect(second.verifiedAt?.toISOString().slice(0, 10)).toBe('2026-10-06');
    expect(
      second.intakes
        .find((entry) => entry.intake.startMonth === 9)
        ?.deadline?.toISOString()
        .slice(0, 10),
    ).toBe('2027-01-15');
    const response = await request(app.getHttpServer())
      .get(`/api/v1/phase1/universities/${universitySlug}/courses`)
      .expect(200);
    const publicRows = data(response).data as Record<string, unknown>[];
    expect(publicRows).toHaveLength(1);
    expect(publicRows[0]).toMatchObject({
      slug: offeringSlug,
      durationMin: '1',
      tuitionPeriod: 'PER_YEAR',
      applicationUrl: row.applicationUrl,
    });
    expect(publicRows[0].requirements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'ENGLISH_TEST',
          title: 'IELTS',
          minimumScore: '6.5',
        }),
      ]),
    );
    expect(publicRows[0].intakes).toHaveLength(2);
  });

  it('exports the new fields in a sheet that re-imports without adding children', async () => {
    const response = await admin('get', 'offerings/export?format=csv').expect(
      200,
    );
    const rows = parseCsv(response.text);
    const headers = rows[0];
    const ownRow = rows.find(
      (values) =>
        values[headers.indexOf('Name')] === row.name &&
        values[headers.indexOf('University')] ===
          `Whole programme university ${suffix}`,
    );
    expect(ownRow).toBeDefined();
    expect(ownRow![headers.indexOf('Intakes')]).toBe('1;9:2027-01-15');
    expect(ownRow![headers.indexOf('Ielts Minimum')]).toBe('6.5');
    expect(ownRow![headers.indexOf('Duration Min')]).toBe('1');
    expect(ownRow![headers.indexOf('Tuition Min')]).toBe('28000');
    const response2 = await admin('post', 'offerings/import')
      .field('mode', 'upsert')
      .attach(
        'file',
        Buffer.from(
          toCsv(headers, [
            Object.fromEntries(
              headers.map((header, index) => [header, ownRow![index]]),
            ),
          ]),
        ),
        'offerings.csv',
      )
      .expect(201);
    expect(data(response2)).toMatchObject({ created: 0, failed: 0 });
    expect(
      await prisma.universityCourseRequirement.count({
        where: { offering: { slug: offeringSlug } },
      }),
    ).toBe(4);
  });

  it('replaces nonblank intakes, updates a test and preserves blank optional relations', async () => {
    expect(
      data(
        await upload({
          ...row,
          intakes: 'january:2027-02-01',
          ieltsMinimum: '7',
        }),
      ),
    ).toMatchObject({ updated: 1, failed: 0 });
    const before = await prisma.universityCourseOffering.findUniqueOrThrow({
      where: { slug: offeringSlug },
      include: { intakes: true, requirements: true },
    });
    expect(before.intakes).toHaveLength(1);
    expect(
      Number(
        before.requirements.find((entry) => entry.title === 'IELTS')
          ?.minimumScore,
      ),
    ).toBe(7);
    const legacy = {
      slug: offeringSlug,
      name: row.name,
      universitySlug,
      genericCourseSlug: courseSlug,
      status: 'PUBLISHED',
      intakes: '',
      ieltsMinimum: '',
      academicRequirement: '',
    };
    expect(data(await upload(legacy))).toMatchObject({ failed: 0 });
    const after = await prisma.universityCourseOffering.findUniqueOrThrow({
      where: { slug: offeringSlug },
      include: { intakes: true, requirements: true },
    });
    expect(after.durationUnit).toBe('YEARS');
    expect(after.intakes).toEqual(before.intakes);
    expect(after.requirements).toEqual(before.requirements);
  });

  it('rejects invalid rows before any scalar or relation is written', async () => {
    const response = await upload({
      ...row,
      courseCode: 'SHOULD-NOT-LAND',
      durationUnit: 'DAYS',
      verifiedAt: '2027-02-29',
      intakes: 'unknown-intake',
      ieltsMinimum: '10',
    });
    expect(data(response)).toMatchObject({ updated: 0, failed: 1 });
    expect(
      (
        await prisma.universityCourseOffering.findUniqueOrThrow({
          where: { slug: offeringSlug },
        })
      ).courseCode,
    ).toBe('DS01');
  });

  it('bulk-updates child columns through the same validator and reconciler', async () => {
    const offering = await prisma.universityCourseOffering.findUniqueOrThrow({
      where: { slug: offeringSlug },
    });
    const response = await admin('post', 'offerings/bulk-update')
      .send({
        ids: [offering.id],
        fields: {
          durationMin: '2',
          durationMax: '2',
          intakes: '9:2027-05-01',
          ieltsMinimum: '6',
        },
      })
      .expect(201);
    expect(data(response).updated).toBe(1);
    const saved = await prisma.universityCourseOffering.findUniqueOrThrow({
      where: { id: offering.id },
      include: { intakes: true, requirements: true },
    });
    expect(Number(saved.durationMin)).toBe(2);
    expect(saved.intakes).toHaveLength(1);
    expect(
      Number(
        saved.requirements.find((entry) => entry.title === 'IELTS')
          ?.minimumScore,
      ),
    ).toBe(6);
    await admin('post', 'offerings/bulk-update')
      .send({ ids: [offering.id], fields: { ieltsMinimum: '99' } })
      .expect(400);
    expect(
      await prisma.universityCourseRequirement.count({
        where: { offeringId: offering.id },
      }),
    ).toBe(4);
  });
  it('splits an old combined test title into one requirement per imported test', async () => {
    const offering = await prisma.universityCourseOffering.findUniqueOrThrow({
      where: { slug: offeringSlug },
    });
    await prisma.universityCourseRequirement.deleteMany({
      where: {
        offeringId: offering.id,
        category: 'ENGLISH_TEST',
        title: { in: ['IELTS', 'TOEFL'] },
      },
    });
    await prisma.universityCourseRequirement.create({
      data: {
        offeringId: offering.id,
        category: 'ENGLISH_TEST',
        title: 'IELTS or TOEFL',
        minimumScore: 6.5,
      },
    });
    expect(data(await upload(row))).toMatchObject({ updated: 1, failed: 0 });
    expect(data(await upload(row))).toMatchObject({ unchanged: 1, failed: 0 });
    const requirements = await prisma.universityCourseRequirement.findMany({
      where: { offeringId: offering.id },
    });
    expect(requirements).toHaveLength(4);
    expect(
      requirements.filter((entry) => entry.title === 'IELTS'),
    ).toHaveLength(1);
    expect(
      requirements.filter((entry) => entry.title === 'TOEFL'),
    ).toHaveLength(1);
    expect(
      Number(
        requirements.find((entry) => entry.title === 'IELTS')?.minimumScore,
      ),
    ).toBe(6.5);
    expect(
      Number(
        requirements.find((entry) => entry.title === 'TOEFL')?.minimumScore,
      ),
    ).toBe(90);
  });
});
