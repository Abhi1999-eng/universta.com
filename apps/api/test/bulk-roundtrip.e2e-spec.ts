import type { INestApplication } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/bootstrap';
import { parseCsv, toCsv } from '../src/bulk/csv.util';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Every bulk template, as an admin downloads it, imports -- and every export
 * imports back.
 *
 * Two promises the bulk screen makes and no test held it to. The templates'
 * example rows referenced each other by slugs the examples never produced
 * (an offering pointed at a course slug no course example derives), and the
 * export wrote relations as names while most importers looked them up by
 * slug alone, so an exported file could not be edited and uploaded again.
 *
 * The examples are imported in dependency order with "Demo" swapped for a
 * run token, which keeps them chained to each other and owned by this run.
 */

type RecordValue = Record<string, unknown>;
type RowError = { line: number; errors: string[] };

const ORDER = [
  'countries',
  'states',
  'cities',
  'subjects',
  'courses',
  'universities',
  'campuses',
  'offerings',
  'scholarships',
  'consultants',
  'consultant-locations',
  'jobs',
  'events',
] as const;

function data(response: { body: unknown }): RecordValue {
  const body = response.body as { data?: unknown } | null;
  return (body?.data ?? {}) as RecordValue;
}

describe('Bulk templates and exports round-trip (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken = '';
  const token = `bulkrt${randomUUID().replace(/-/g, '').slice(0, 8)}`;
  const own = { contains: token };

  const admin = (method: 'get' | 'post', path: string) =>
    request(app.getHttpServer())
      [method](`/api/v1/admin/bulk/${path}`)
      .set('Authorization', `Bearer ${adminToken}`);

  const upload = (resource: string, step: string, csv: string, mode = '') => {
    const call = admin('post', `${resource}/${step}`);
    if (mode) void call.field('mode', mode);
    return call
      .attach('file', Buffer.from(csv, 'utf8'), `${resource}.csv`)
      .expect(201);
  };

  /** The downloaded template, with the example made this run's own. */
  async function ownedTemplate(resource: string): Promise<string> {
    const response = await admin(
      'get',
      `${resource}/template?format=csv`,
    ).expect(200);
    return response.text
      .replaceAll('Demo', token[0].toUpperCase() + token.slice(1))
      .replaceAll('demo-', `${token}-`);
  }

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
    // Children first: offerings hold their course and campus, courses hold
    // their subject, and states, cities and campuses cascade from parents.
    await prisma.universityCourseOffering.deleteMany({ where: { slug: own } });
    await prisma.universityCampus.deleteMany({ where: { slug: own } });
    await prisma.university.deleteMany({ where: { slug: own } });
    await prisma.course.deleteMany({ where: { slug: own } });
    await prisma.subject.deleteMany({ where: { slug: own } });
    await prisma.scholarship.deleteMany({ where: { slug: own } });
    await prisma.consultantLocation.deleteMany({ where: { slug: own } });
    await prisma.consultant.deleteMany({ where: { slug: own } });
    await prisma.job.deleteMany({ where: { slug: own } });
    await prisma.event.deleteMany({ where: { slug: own } });
    await prisma.city.deleteMany({ where: { slug: own } });
    await prisma.state.deleteMany({ where: { slug: own } });
    await prisma.country.deleteMany({ where: { slug: own } });
    await app.close();
  });

  it.each(ORDER)(
    'imports the %s template example as downloaded',
    async (resource) => {
      const csv = await ownedTemplate(resource);
      const dryRun = data(await upload(resource, 'dry-run', csv));
      expect(dryRun.errors as RowError[]).toEqual([]);
      const summary = data(await upload(resource, 'import', csv, 'create'));
      expect(summary.errors as RowError[]).toEqual([]);
      expect(summary.created).toBe(1);
    },
  );

  it.each(ORDER)(
    're-imports its own %s export in upsert mode',
    async (resource) => {
      const exported = await admin('get', `${resource}/export?format=csv`)
        .buffer(true)
        .expect(200);
      const [header, ...rows] = parseCsv(exported.text);
      const mine = rows
        .filter((cells) =>
          cells.some((cell) => cell.toLowerCase().includes(token)),
        )
        .map((cells) =>
          Object.fromEntries(header.map((column, i) => [column, cells[i]])),
        );
      expect(mine).toHaveLength(1);
      const summary = data(
        await upload(resource, 'import', toCsv(header, mine), 'upsert'),
      );
      expect(summary.errors as RowError[]).toEqual([]);
      expect(summary).toMatchObject({ created: 0, updated: 1, failed: 0 });
    },
  );

  it('keeps every relation of a re-imported offering where it was', async () => {
    const offering = await prisma.universityCourseOffering.findFirst({
      where: { slug: own },
      include: {
        university: { select: { slug: true } },
        genericCourse: { select: { slug: true } },
        courseLevel: { select: { code: true } },
      },
    });
    expect(offering?.university.slug).toBe(`${token}-university`);
    expect(offering?.genericCourse.slug).toBe(`${token}-course`);
    expect(offering?.courseLevel?.code).toBe('UG');
  });

  it('reads a CSV saved with a byte-order mark, as Excel writes it', async () => {
    const csv = await ownedTemplate('subjects');
    const response = data(
      await upload('subjects', 'dry-run', String.fromCharCode(0xfeff) + csv),
    );
    expect(response.errors as RowError[]).toEqual([]);
  });
});
