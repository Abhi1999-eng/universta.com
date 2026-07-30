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
function errorCode(response: { body: unknown }): string {
  const value = body(response).error;
  return value && typeof value === 'object'
    ? String((value as RecordValue).code ?? '')
    : '';
}

describe('Redirect management admin screen (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  const suffix = randomUUID().slice(0, 8);
  const createdIds: string[] = [];

  const admin = (
    method: 'get' | 'post' | 'patch' | 'delete',
    path: string,
  ) =>
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
    if (createdIds.length)
      await prisma.redirect.deleteMany({ where: { id: { in: createdIds } } });
    await app.close();
  });

  it('rejects unauthenticated access', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/redirects')
      .expect(401);
  });

  it('creates, lists, searches and edits a redirect', async () => {
    const sourcePath = `/redirect-admin-e2e-${suffix}`;
    const targetPath = `/careers`;
    const created = await admin('post', '/api/v1/admin/redirects')
      .send({ sourcePath, targetPath, httpStatusCode: 302 })
      .expect(201);
    const id = String(data(created).id);
    createdIds.push(id);
    expect(data(created)).toMatchObject({
      sourcePath,
      targetPath,
      httpStatusCode: 302,
      isActive: true,
      hitCount: 0,
    });

    const list = await admin(
      'get',
      `/api/v1/admin/redirects?q=${encodeURIComponent(suffix)}`,
    ).expect(200);
    const rows = body(list).data as RecordValue[];
    expect(rows.some((row) => row.id === id)).toBe(true);

    const updated = await admin('patch', `/api/v1/admin/redirects/${id}`)
      .send({ targetPath: '/scholarships' })
      .expect(200);
    expect(data(updated).targetPath).toBe('/scholarships');

    const publicLookup = await request(app.getHttpServer())
      .get(`/api/v1/phase1/redirects?path=${encodeURIComponent(sourcePath)}`)
      .expect(200);
    expect(data(publicLookup).targetPath).toBe('/scholarships');
  });

  it('rejects an external target as an open-redirect risk', async () => {
    const res = await admin('post', '/api/v1/admin/redirects').send({
      sourcePath: `/redirect-admin-e2e-external-${suffix}`,
      targetPath: 'https://example.com/phish',
    });
    expect(res.status).toBe(400);
    expect(errorCode(res)).toBe('REDIRECT_PATH_NOT_INTERNAL');
  });

  it('rejects a protocol-relative target as an open-redirect risk', async () => {
    const res = await admin('post', '/api/v1/admin/redirects').send({
      sourcePath: `/redirect-admin-e2e-protorel-${suffix}`,
      targetPath: '//example.com/phish',
    });
    expect(res.status).toBe(400);
    expect(errorCode(res)).toBe('REDIRECT_PATH_NOT_INTERNAL');
  });

  it('rejects a self-loop', async () => {
    const path = `/redirect-admin-e2e-loop-${suffix}`;
    const res = await admin('post', '/api/v1/admin/redirects').send({
      sourcePath: path,
      targetPath: path,
    });
    expect(res.status).toBe(400);
    expect(errorCode(res)).toBe('REDIRECT_SELF_LOOP');
  });

  it('rejects a duplicate source path with a friendly conflict', async () => {
    const sourcePath = `/redirect-admin-e2e-dup-${suffix}`;
    const first = await admin('post', '/api/v1/admin/redirects')
      .send({ sourcePath, targetPath: '/careers' })
      .expect(201);
    createdIds.push(String(data(first).id));
    const dup = await admin('post', '/api/v1/admin/redirects').send({
      sourcePath,
      targetPath: '/events',
    });
    expect(dup.status).toBe(409);
    expect(errorCode(dup)).toBe('REDIRECT_SOURCE_CONFLICT');
  });

  it('rejects chaining onto another active redirect and detects loops across two hops', async () => {
    const a = `/redirect-admin-e2e-chain-a-${suffix}`;
    const b = `/redirect-admin-e2e-chain-b-${suffix}`;
    const first = await admin('post', '/api/v1/admin/redirects')
      .send({ sourcePath: a, targetPath: b })
      .expect(201);
    createdIds.push(String(data(first).id));

    const chained = await admin('post', '/api/v1/admin/redirects').send({
      sourcePath: b,
      targetPath: '/careers',
    });
    expect(chained.status).toBe(400);
    expect(errorCode(chained)).toBe('REDIRECT_CHAIN_NOT_ALLOWED');

    const loop = await admin('post', '/api/v1/admin/redirects').send({
      sourcePath: b,
      targetPath: a,
    });
    expect(loop.status).toBe(400);
    expect(errorCode(loop)).toBe('REDIRECT_LOOP_DETECTED');
  });

  it('disables and re-enables a redirect, which stops and resumes public resolution', async () => {
    const sourcePath = `/redirect-admin-e2e-toggle-${suffix}`;
    const created = await admin('post', '/api/v1/admin/redirects')
      .send({ sourcePath, targetPath: '/careers' })
      .expect(201);
    const id = String(data(created).id);
    createdIds.push(id);

    await admin('post', `/api/v1/admin/redirects/${id}/disable`).expect(201);
    const whileDisabled = await request(app.getHttpServer())
      .get(`/api/v1/phase1/redirects?path=${encodeURIComponent(sourcePath)}`)
      .expect(200);
    expect(data(whileDisabled)).toEqual({});

    await admin('post', `/api/v1/admin/redirects/${id}/enable`).expect(201);
    const afterEnable = await request(app.getHttpServer())
      .get(`/api/v1/phase1/redirects?path=${encodeURIComponent(sourcePath)}`)
      .expect(200);
    expect(data(afterEnable).targetPath).toBe('/careers');
  });

  it('archives (permanently removes) a redirect', async () => {
    const sourcePath = `/redirect-admin-e2e-archive-${suffix}`;
    const created = await admin('post', '/api/v1/admin/redirects')
      .send({ sourcePath, targetPath: '/careers' })
      .expect(201);
    const id = String(data(created).id);

    await admin('delete', `/api/v1/admin/redirects/${id}`).expect(200);
    await admin('get', `/api/v1/admin/redirects/${id}`).expect(404);
  });
});
