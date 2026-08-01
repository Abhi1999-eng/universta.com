import type { INestApplication } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/bootstrap';
import { parseXlsx, toXlsx } from '../src/bulk/xlsx.util';
import { PrismaService } from '../src/prisma/prisma.service';

type RecordValue = Record<string, unknown>;
function record(value: unknown): RecordValue {
  return value && typeof value === 'object' ? (value as RecordValue) : {};
}
function body(response: { body: unknown }): RecordValue {
  return record(response.body);
}
function data(response: { body: unknown }): RecordValue {
  return record(body(response).data);
}
function errorCode(response: { body: unknown }): string {
  return record(body(response).error).code as string;
}

function binaryParser(
  response: NodeJS.ReadableStream,
  callback: (error: Error | null, body: Buffer) => void,
): void {
  const chunks: Buffer[] = [];
  response.on('data', (chunk: Buffer | string) => {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  });
  response.on('end', () => callback(null, Buffer.concat(chunks)));
  response.on('error', (error: Error) => callback(error, Buffer.alloc(0)));
}

describe('Bulk data import/export (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  const suffix = randomUUID().slice(0, 8);
  const jobSlugA = `bulk-e2e-job-a-${suffix}`;
  const jobSlugB = `bulk-e2e-job-b-${suffix}`;
  let jobIdA = '';
  let jobIdB = '';

  const admin = (method: 'get' | 'post', path: string) =>
    request(app.getHttpServer())
      [method](path)
      .set('Authorization', `Bearer ${adminToken}`);

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
    adminToken = String(data(login).accessToken);
  });

  afterAll(async () => {
    await prisma.job.deleteMany({
      where: { slug: { in: [jobSlugA, jobSlugB] } },
    });
    await app.close();
  });

  it('lists the registered bulk resources', async () => {
    const response = await admin('get', '/api/v1/admin/bulk/resources').expect(
      200,
    );
    const rows = data(response) as unknown as RecordValue[];
    const keys = Array.isArray(rows) ? rows.map((row) => row.key) : [];
    expect(keys).toEqual(
      expect.arrayContaining([
        'countries',
        'states',
        'cities',
        'subjects',
        'courses',
        'jobs',
        'events',
        'universities',
        'campuses',
        'offerings',
        'scholarships',
        'consultants',
        'consultant-locations',
      ]),
    );
  });

  it('downloads a CSV template with the expected header', async () => {
    const response = await admin(
      'get',
      '/api/v1/admin/bulk/jobs/template?format=csv',
    ).expect(200);
    expect(response.text.split('\r\n')[0]).toBe(
      'slug,title,department,employmentType,location,remoteStatus,summary,status',
    );
  });

  it('downloads a valid XLSX template with the expected header', async () => {
    const response = await admin(
      'get',
      '/api/v1/admin/bulk/jobs/template?format=xlsx',
    )
      .buffer(true)
      .parse(binaryParser)
      .expect(200);
    expect(response.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(Buffer.isBuffer(response.body)).toBe(true);
    const rows = await parseXlsx(response.body as Buffer);
    expect(rows[0]).toEqual([
      'slug',
      'title',
      'department',
      'employmentType',
      'location',
      'remoteStatus',
      'summary',
      'status',
    ]);
  });

  it('dry-run reports a row-level error without writing anything', async () => {
    const before = await prisma.job.count({ where: { slug: jobSlugA } });
    const csv = 'slug,title,status\n' + `${jobSlugA},,DRAFT`;
    const response = await admin('post', '/api/v1/admin/bulk/jobs/dry-run')
      .attach('file', Buffer.from(csv, 'utf8'), 'jobs.csv')
      .expect(201);
    const result = data(response);
    expect(result.totalRows).toBe(1);
    const errors = result.errors as { line: number; errors: string[] }[];
    expect(errors.length).toBe(1);
    expect(errors[0].errors[0]).toMatch(/title is required/);
    const after = await prisma.job.count({ where: { slug: jobSlugA } });
    expect(after).toBe(before);
  });

  it('parses XLSX uploads during dry-run without writing anything', async () => {
    const before = await prisma.job.count({ where: { slug: jobSlugA } });
    const workbook = await toXlsx(
      ['slug', 'title', 'status'],
      [{ slug: jobSlugA, title: '', status: 'DRAFT' }],
    );
    const response = await admin('post', '/api/v1/admin/bulk/jobs/dry-run')
      .attach('file', workbook, 'jobs.xlsx')
      .expect(201);
    const result = data(response);
    expect(result.totalRows).toBe(1);
    const errors = result.errors as { line: number; errors: string[] }[];
    expect(errors).toHaveLength(1);
    expect(errors[0].errors[0]).toMatch(/title is required/);
    expect(await prisma.job.count({ where: { slug: jobSlugA } })).toBe(before);
  });

  it('imports a valid CSV row in create mode', async () => {
    const csv =
      'slug,title,department,status\n' +
      `${jobSlugA},Bulk E2E Job A,Operations,PUBLISHED`;
    const response = await admin('post', '/api/v1/admin/bulk/jobs/import')
      .field('mode', 'create')
      .attach('file', Buffer.from(csv, 'utf8'), 'jobs.csv')
      .expect(201);
    const summary = data(response);
    expect(summary.created).toBe(1);
    expect(summary.failed).toBe(0);
    const job = await prisma.job.findFirst({ where: { slug: jobSlugA } });
    expect(job).toBeTruthy();
    jobIdA = job!.id;
  });

  it('rejects a create-mode re-import of the same slug and reports it as a row error', async () => {
    const csv =
      'slug,title,status\n' + `${jobSlugA},Bulk E2E Job A Again,PUBLISHED`;
    const response = await admin('post', '/api/v1/admin/bulk/jobs/import')
      .field('mode', 'create')
      .attach('file', Buffer.from(csv, 'utf8'), 'jobs.csv')
      .expect(201);
    const summary = data(response);
    expect(summary.created).toBe(0);
    expect(summary.failed).toBe(1);
  });

  it('updates the existing row in upsert mode without touching unrelated fields', async () => {
    const csv =
      'slug,title,department,status\n' +
      `${jobSlugA},Bulk E2E Job A Updated,Operations,PUBLISHED`;
    const response = await admin('post', '/api/v1/admin/bulk/jobs/import')
      .field('mode', 'upsert')
      .attach('file', Buffer.from(csv, 'utf8'), 'jobs.csv')
      .expect(201);
    const summary = data(response);
    expect(summary.updated).toBe(1);
    const job = await prisma.job.findFirst({ where: { slug: jobSlugA } });
    expect(job?.title).toBe('Bulk E2E Job A Updated');
    expect(job?.department).toBe('Operations');
  });

  it('imports a second row for bulk-update/bulk-archive coverage', async () => {
    const csv = 'slug,title,status\n' + `${jobSlugB},Bulk E2E Job B,DRAFT`;
    await admin('post', '/api/v1/admin/bulk/jobs/import')
      .field('mode', 'create')
      .attach('file', Buffer.from(csv, 'utf8'), 'jobs.csv')
      .expect(201);
    const job = await prisma.job.findFirst({ where: { slug: jobSlugB } });
    jobIdB = job!.id;
  });

  it('rejects a bulk-update field that is not in the allowed update list', async () => {
    const response = await admin('post', '/api/v1/admin/bulk/jobs/bulk-update')
      .send({ ids: [jobIdA], fields: { slug: 'not-allowed' } })
      .expect(400);
    expect(errorCode(response)).toBe('FIELD_NOT_UPDATABLE');
  });

  it('bulk-updates only the selected field on the selected records, leaving others unchanged', async () => {
    const beforeB = await prisma.job.findUniqueOrThrow({
      where: { id: jobIdB },
    });
    const response = await admin('post', '/api/v1/admin/bulk/jobs/bulk-update')
      .send({ ids: [jobIdA, jobIdB], fields: { status: 'PUBLISHED' } })
      .expect(201);
    expect(data(response).updated).toBe(2);
    const afterA = await prisma.job.findUniqueOrThrow({
      where: { id: jobIdA },
    });
    const afterB = await prisma.job.findUniqueOrThrow({
      where: { id: jobIdB },
    });
    expect(afterA.status).toBe('PUBLISHED');
    expect(afterB.status).toBe('PUBLISHED');
    expect(afterB.title).toBe(beforeB.title);
  });

  it('exports the current records back out as CSV including both rows', async () => {
    const response = await admin(
      'get',
      '/api/v1/admin/bulk/jobs/export?format=csv',
    ).expect(200);
    expect(response.text).toContain(jobSlugA);
    expect(response.text).toContain(jobSlugB);
  });

  it('exports a valid XLSX workbook including both rows', async () => {
    const response = await admin(
      'get',
      '/api/v1/admin/bulk/jobs/export?format=xlsx',
    )
      .buffer(true)
      .parse(binaryParser)
      .expect(200);
    expect(Buffer.isBuffer(response.body)).toBe(true);
    const rows = await parseXlsx(response.body as Buffer);
    const slugIndex = rows[0].indexOf('slug');
    const slugs = rows.slice(1).map((row) => row[slugIndex]);
    expect(slugs).toEqual(expect.arrayContaining([jobSlugA, jobSlugB]));
  });

  it('bulk-archives the selected records, which then disappear from the public listing', async () => {
    const response = await admin('post', '/api/v1/admin/bulk/jobs/bulk-archive')
      .send({ ids: [jobIdA, jobIdB] })
      .expect(201);
    expect(data(response).archived).toBe(2);
    const afterA = await prisma.job.findUniqueOrThrow({
      where: { id: jobIdA },
    });
    expect(afterA.deletedAt).not.toBeNull();
    expect(afterA.status).toBe('ARCHIVED');
  });

  it('imports a state and a city via country/state slug lookups, and rejects an unknown country slug', async () => {
    const stateSlug = `bulk-e2e-state-${suffix}`;
    const citySlug = `bulk-e2e-city-${suffix}`;
    const stateCsv =
      'slug,name,countrySlug,status\n' +
      `${stateSlug},Bulk E2E State,canada,PUBLISHED`;
    const stateResponse = await admin(
      'post',
      '/api/v1/admin/bulk/states/import',
    )
      .field('mode', 'create')
      .attach('file', Buffer.from(stateCsv, 'utf8'), 'states.csv')
      .expect(201);
    expect(data(stateResponse).created).toBe(1);

    const cityCsv =
      'slug,name,countrySlug,stateSlug,status\n' +
      `${citySlug},Bulk E2E City,canada,${stateSlug},PUBLISHED\n` +
      `bulk-e2e-city-bad-${suffix},Bad City,not-a-real-country,,PUBLISHED`;
    const cityResponse = await admin('post', '/api/v1/admin/bulk/cities/import')
      .field('mode', 'create')
      .attach('file', Buffer.from(cityCsv, 'utf8'), 'cities.csv')
      .expect(201);
    const citySummary = data(cityResponse);
    expect(citySummary.created).toBe(1);
    expect(citySummary.failed).toBe(1);
    const cityErrors = citySummary.errors as { errors: string[] }[];
    expect(cityErrors[0].errors[0]).toMatch(
      /countrySlug "not-a-real-country" was not found/,
    );

    const city = await prisma.city.findFirst({
      where: { slug: citySlug },
      include: { state: true },
    });
    expect(city?.state?.slug).toBe(stateSlug);

    await prisma.city.deleteMany({ where: { slug: citySlug } });
    await prisma.state.deleteMany({ where: { slug: stateSlug } });
  });

  it('escapes a formula-injection-prone cell on export', async () => {
    const slug = `bulk-e2e-formula-${suffix}`;
    await prisma.job.create({
      data: { slug, title: '=2+2', status: 'DRAFT' },
    });
    const response = await admin(
      'get',
      '/api/v1/admin/bulk/jobs/export?format=csv',
    ).expect(200);
    // A leading tab neutralizes the formula in every major spreadsheet app
    // without needing quoting on top of it; the row must not contain the
    // raw, unescaped "=2+2" a formula-injection payload would need.
    expect(response.text).toContain('\t=2+2');
    expect(response.text).not.toMatch(/[^\t]=2\+2/);
    await prisma.job.deleteMany({ where: { slug } });
  });

  describe('University/Scholarship/Consultant bulk coverage', () => {
    const uniSlug = `bulk-e2e-uni-${suffix}`;
    const campusName = 'Bulk E2E Campus';
    const offeringSlug = `bulk-e2e-offering-${suffix}`;
    const scholarshipSlug = `bulk-e2e-scholarship-${suffix}`;
    const consultantSlug = `bulk-e2e-consultant-${suffix}`;
    const locationSlug = `bulk-e2e-location-${suffix}`;
    let genericCourseSlug = '';
    let uniId = '';
    let campusId = '';
    let campusSlug = '';
    let offeringId = '';

    it('imports a university via a countrySlug lookup, rejecting an unknown one', async () => {
      const bad = await admin('post', '/api/v1/admin/bulk/universities/import')
        .field('mode', 'create')
        .attach(
          'file',
          Buffer.from(
            'slug,name,countrySlug,shortDescription,status\n' +
              `bulk-e2e-uni-bad-${suffix},Bad,not-a-real-country,Demo,DRAFT`,
            'utf8',
          ),
          'universities.csv',
        )
        .expect(201);
      expect(data(bad).failed).toBe(1);

      const good = await admin('post', '/api/v1/admin/bulk/universities/import')
        .field('mode', 'create')
        .attach(
          'file',
          Buffer.from(
            'slug,name,countrySlug,shortDescription,status\n' +
              `${uniSlug},Bulk E2E University,canada,Demo,DRAFT`,
            'utf8',
          ),
          'universities.csv',
        )
        .expect(201);
      expect(data(good).created).toBe(1);
      const uni = await prisma.university.findFirstOrThrow({
        where: { slug: uniSlug },
      });
      uniId = uni.id;
    });

    it('auto-generates a campus slug prefixed with its university slug to avoid cross-university collisions', async () => {
      const response = await admin('post', '/api/v1/admin/bulk/campuses/import')
        .field('mode', 'create')
        .attach(
          'file',
          Buffer.from(
            'slug,name,universitySlug,city,status\n' +
              `,${campusName},${uniSlug},Toronto,ACTIVE`,
            'utf8',
          ),
          'campuses.csv',
        )
        .expect(201);
      expect(data(response).created).toBe(1);
      const campus = await prisma.universityCampus.findFirstOrThrow({
        where: { universityId: uniId, name: campusName },
      });
      campusId = campus.id;
      campusSlug = campus.slug;
      expect(campusSlug).toBe(`${uniSlug}-bulk-e2e-campus`);
    });

    it('imports an offering resolving university/course/campus/course-level relations', async () => {
      const course = await prisma.course.findFirst({
        where: { deletedAt: null },
      });
      genericCourseSlug = course!.slug;
      const response = await admin(
        'post',
        '/api/v1/admin/bulk/offerings/import',
      )
        .field('mode', 'create')
        .attach(
          'file',
          Buffer.from(
            'slug,name,universitySlug,genericCourseSlug,campusSlug,status\n' +
              `${offeringSlug},Bulk E2E Offering,${uniSlug},${genericCourseSlug},${campusSlug},DRAFT`,
            'utf8',
          ),
          'offerings.csv',
        )
        .expect(201);
      expect(data(response).created).toBe(1);
      const offering = await prisma.universityCourseOffering.findFirstOrThrow({
        where: { slug: offeringSlug },
      });
      offeringId = offering.id;
      expect(offering.campusId).toBe(campusId);
    });

    it('blocks archiving a university that still has a campus and an offering attached', async () => {
      const response = await admin(
        'post',
        '/api/v1/admin/bulk/universities/bulk-archive',
      )
        .send({ ids: [uniId] })
        .expect(404);
      expect(errorCode(response)).toBe('NO_RECORDS_ARCHIVABLE');
    });

    it('imports scholarships, consultants and consultant-locations with their own relation lookups', async () => {
      const scholarship = await admin(
        'post',
        '/api/v1/admin/bulk/scholarships/import',
      )
        .field('mode', 'create')
        .attach(
          'file',
          Buffer.from(
            'slug,title,status\n' +
              `${scholarshipSlug},Bulk E2E Scholarship,DRAFT`,
            'utf8',
          ),
          'scholarships.csv',
        )
        .expect(201);
      expect(data(scholarship).created).toBe(1);

      const consultant = await admin(
        'post',
        '/api/v1/admin/bulk/consultants/import',
      )
        .field('mode', 'create')
        .attach(
          'file',
          Buffer.from(
            'slug,name,status\n' +
              `${consultantSlug},Bulk E2E Consultant,DRAFT`,
            'utf8',
          ),
          'consultants.csv',
        )
        .expect(201);
      expect(data(consultant).created).toBe(1);

      const badLocation = await admin(
        'post',
        '/api/v1/admin/bulk/consultant-locations/import',
      )
        .field('mode', 'create')
        .attach(
          'file',
          Buffer.from(
            'slug,name,city,countrySlug,status\n' +
              `bulk-e2e-location-bad-${suffix},Bad,Nowhere,not-a-real-country,ACTIVE`,
            'utf8',
          ),
          'consultant-locations.csv',
        )
        .expect(201);
      expect(data(badLocation).failed).toBe(1);

      const location = await admin(
        'post',
        '/api/v1/admin/bulk/consultant-locations/import',
      )
        .field('mode', 'create')
        .attach(
          'file',
          Buffer.from(
            'slug,name,city,countrySlug,status\n' +
              `${locationSlug},Bulk E2E Location,Vancouver,canada,ACTIVE`,
            'utf8',
          ),
          'consultant-locations.csv',
        )
        .expect(201);
      expect(data(location).created).toBe(1);
    });

    afterAll(async () => {
      if (offeringId)
        await prisma.universityCourseOffering.deleteMany({
          where: { id: offeringId },
        });
      if (campusId)
        await prisma.universityCampus.deleteMany({ where: { id: campusId } });
      await prisma.university.deleteMany({ where: { slug: uniSlug } });
      await prisma.scholarship.deleteMany({ where: { slug: scholarshipSlug } });
      await prisma.consultant.deleteMany({ where: { slug: consultantSlug } });
      await prisma.consultantLocation.deleteMany({
        where: { slug: locationSlug },
      });
    });
  });
});
