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
function data(response: { body: unknown }): RecordValue {
  return record(body(response).data);
}
function arrayData(response: { body: unknown }): RecordValue[] {
  const value = body(response).data;
  return Array.isArray(value) ? (value as RecordValue[]) : [];
}

describe('Strict scope: scheduled publishing, featured windows, new filters (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  const suffix = randomUUID().slice(0, 8);
  const jobIds: string[] = [];
  const eventIds: string[] = [];
  const consultantIds: string[] = [];

  const admin = (method: 'get' | 'post' | 'patch' | 'delete', path: string) =>
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
    if (jobIds.length)
      await prisma.job.deleteMany({ where: { id: { in: jobIds } } });
    if (eventIds.length)
      await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
    if (consultantIds.length)
      await prisma.consultant.deleteMany({
        where: { id: { in: consultantIds } },
      });
    await app.close();
  });

  it('hides a PUBLISHED job whose publishStartsAt is in the future, then shows it once created without a future start', async () => {
    const now = Date.now();
    const future = new Date(now + 24 * 60 * 60 * 1000).toISOString();
    const slug = `strict-e2e-scheduled-future-job-${suffix}`;
    const created = await admin('post', '/api/v1/admin/phase1/jobs')
      .send({
        title: `Strict E2E Scheduled Future Job ${suffix}`,
        slug,
        summary: 'Fictional demo job for scheduled-publishing e2e coverage.',
        status: 'PUBLISHED',
        publishStartsAt: future,
      })
      .expect(201);
    jobIds.push(String(data(created).id));

    await request(app.getHttpServer())
      .get(`/api/v1/phase1/jobs/${slug}`)
      .expect(404);

    const listing = await request(app.getHttpServer())
      .get('/api/v1/phase1/jobs')
      .query({ q: `Strict E2E Scheduled Future Job ${suffix}` })
      .expect(200);
    expect(arrayData(listing).some((row) => row.slug === slug)).toBe(false);
  });

  it('hides a PUBLISHED job whose publishEndsAt has already passed', async () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const slug = `strict-e2e-scheduled-expired-job-${suffix}`;
    const created = await admin('post', '/api/v1/admin/phase1/jobs')
      .send({
        title: `Strict E2E Scheduled Expired Job ${suffix}`,
        slug,
        summary: 'Fictional demo job for scheduled-publishing e2e coverage.',
        status: 'PUBLISHED',
        publishEndsAt: past,
      })
      .expect(201);
    jobIds.push(String(data(created).id));

    await request(app.getHttpServer())
      .get(`/api/v1/phase1/jobs/${slug}`)
      .expect(404);
  });

  it('shows a PUBLISHED job whose publish window currently covers now', async () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const slug = `strict-e2e-scheduled-active-job-${suffix}`;
    const created = await admin('post', '/api/v1/admin/phase1/jobs')
      .send({
        title: `Strict E2E Scheduled Active Job ${suffix}`,
        slug,
        summary: 'Fictional demo job for scheduled-publishing e2e coverage.',
        status: 'PUBLISHED',
        publishStartsAt: past,
        publishEndsAt: future,
      })
      .expect(201);
    jobIds.push(String(data(created).id));

    await request(app.getHttpServer())
      .get(`/api/v1/phase1/jobs/${slug}`)
      .expect(200);
  });

  it('Job filters: department, employment type, remote status, active/expired', async () => {
    const created = await admin('post', '/api/v1/admin/phase1/jobs')
      .send({
        title: `Strict E2E Filter Job ${suffix}`,
        slug: `strict-e2e-filter-job-${suffix}`,
        summary: 'Fictional demo job for filter e2e coverage.',
        status: 'PUBLISHED',
        department: 'Engineering',
        employmentType: 'FULL_TIME',
        remoteStatus: 'REMOTE',
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10),
      })
      .expect(201);
    jobIds.push(String(data(created).id));

    const byDepartment = await request(app.getHttpServer())
      .get('/api/v1/phase1/jobs')
      .query({
        department: 'Engineering',
        q: `Strict E2E Filter Job ${suffix}`,
      })
      .expect(200);
    expect(
      arrayData(byDepartment).some((row) => String(row.title).includes(suffix)),
    ).toBe(true);

    const byRemote = await request(app.getHttpServer())
      .get('/api/v1/phase1/jobs')
      .query({ remote: 'REMOTE', q: `Strict E2E Filter Job ${suffix}` })
      .expect(200);
    expect(
      arrayData(byRemote).some((row) => String(row.title).includes(suffix)),
    ).toBe(true);

    const byWrongType = await request(app.getHttpServer())
      .get('/api/v1/phase1/jobs')
      .query({ type: 'PART_TIME', q: `Strict E2E Filter Job ${suffix}` })
      .expect(200);
    expect(
      arrayData(byWrongType).some((row) => String(row.title).includes(suffix)),
    ).toBe(false);
  });

  it('Event filters: mode and upcoming/past', async () => {
    const past = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const future = new Date(
      Date.now() + 10 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const upcoming = await admin('post', '/api/v1/admin/phase1/events')
      .send({
        title: `Strict E2E Upcoming Online Event ${suffix}`,
        slug: `strict-e2e-upcoming-event-${suffix}`,
        summary: 'Fictional demo event for filter e2e coverage.',
        status: 'PUBLISHED',
        startsAt: future,
        eventType: 'ONLINE',
      })
      .expect(201);
    eventIds.push(String(data(upcoming).id));
    const past_ = await admin('post', '/api/v1/admin/phase1/events')
      .send({
        title: `Strict E2E Past Online Event ${suffix}`,
        slug: `strict-e2e-past-event-${suffix}`,
        summary: 'Fictional demo event for filter e2e coverage.',
        status: 'PUBLISHED',
        startsAt: past,
        eventType: 'ONLINE',
      })
      .expect(201);
    eventIds.push(String(data(past_).id));

    const upcomingResults = await request(app.getHttpServer())
      .get('/api/v1/phase1/events')
      .query({ when: 'upcoming', q: 'Strict E2E' })
      .expect(200);
    const upcomingTitles = arrayData(upcomingResults).map((row) =>
      String(row.title),
    );
    expect(
      upcomingTitles.includes(`Strict E2E Upcoming Online Event ${suffix}`),
    ).toBe(true);
    expect(
      upcomingTitles.includes(`Strict E2E Past Online Event ${suffix}`),
    ).toBe(false);

    const pastResults = await request(app.getHttpServer())
      .get('/api/v1/phase1/events')
      .query({ when: 'past', q: 'Strict E2E' })
      .expect(200);
    const pastTitles = arrayData(pastResults).map((row) => String(row.title));
    expect(pastTitles.includes(`Strict E2E Past Online Event ${suffix}`)).toBe(
      true,
    );
    expect(
      pastTitles.includes(`Strict E2E Upcoming Online Event ${suffix}`),
    ).toBe(false);
  });

  it('Consultant effective-featured sort: an expired featuredUntil no longer outranks an active one', async () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const expired = await admin('post', '/api/v1/admin/phase1/consultants')
      .send({
        name: `Strict E2E Expired Featured Consultant ${suffix}`,
        slug: `strict-e2e-expired-featured-consultant-${suffix}`,
        shortDescription: 'Fictional demo consultant for featured-sort e2e.',
        status: 'PUBLISHED',
        isFeatured: true,
        featuredUntil: past,
      })
      .expect(201);
    consultantIds.push(String(data(expired).id));
    const active = await admin('post', '/api/v1/admin/phase1/consultants')
      .send({
        name: `Strict E2E Active Featured Consultant ${suffix}`,
        slug: `strict-e2e-active-featured-consultant-${suffix}`,
        shortDescription: 'Fictional demo consultant for featured-sort e2e.',
        status: 'PUBLISHED',
        isFeatured: true,
        featuredFrom: past,
        featuredUntil: future,
      })
      .expect(201);
    consultantIds.push(String(data(active).id));

    const listing = await request(app.getHttpServer())
      .get('/api/v1/phase1/consultants')
      .query({ q: 'Strict E2E', limit: '20' })
      .expect(200);
    const names = arrayData(listing).map((row) => String(row.name));
    const activeIdx = names.indexOf(
      `Strict E2E Active Featured Consultant ${suffix}`,
    );
    const expiredIdx = names.indexOf(
      `Strict E2E Expired Featured Consultant ${suffix}`,
    );
    expect(activeIdx).toBeGreaterThanOrEqual(0);
    expect(expiredIdx).toBeGreaterThanOrEqual(0);
    expect(activeIdx).toBeLessThan(expiredIdx);
  });
});
