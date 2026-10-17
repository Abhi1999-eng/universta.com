import { ExpressAdapter } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/bootstrap';

/**
 * Publishing a subject publishes only the subject. A draft specialization
 * under it stays a draft -- in the admin and off the site -- until it is
 * published itself. The subject editor used to publish every draft
 * specialization with the subject; this goes through the admin HTTP API,
 * the way the editor does, so the subject's publish never reaches them.
 */

type Json = Record<string, unknown>;

const record = (response: { body: unknown }): Json => {
  const value = (response.body as { data?: unknown } | null)?.data;
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Json)
    : {};
};

describe('publishing a subject (e2e)', () => {
  let app: INestApplication<App>;
  let token = '';
  let subjectId = '';
  const stamp = randomUUID().slice(0, 8);
  const subjectSlug = `publish-scope-${stamp}`;
  const branchSlug = `publish-scope-branch-${stamp}`;

  const admin = (
    method: 'get' | 'post' | 'delete',
    path: string,
    payload?: Json,
  ) => {
    const call = request(app.getHttpServer())
      [method](path)
      .set('Authorization', `Bearer ${token}`)
      .set('x-request-id', 'subject-publish-scope-e2e');
    return payload ? call.send(payload) : call;
  };

  /** Asserts a status and, when it differs, says what the API objected to. */
  async function expectStatus(
    call: PromiseLike<{ status: number; body: unknown }>,
    status: number,
  ) {
    const response = await call;
    if (response.status !== status)
      throw new Error(
        `Expected ${status}, got ${response.status}: ${JSON.stringify(
          response.body,
        )}`,
      );
    return response;
  }

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = fixture.createNestApplication(new ExpressAdapter());
    configureApplication(app);
    await app.init();

    const email =
      process.env.SEED_ADMIN_EMAIL ??
      process.env.SUPER_ADMIN_EMAIL ??
      'admin@universta.local';
    const password =
      process.env.SEED_ADMIN_PASSWORD ?? process.env.SUPER_ADMIN_PASSWORD;
    if (!password) throw new Error('A local Super Admin password is required');
    const login = await request(app.getHttpServer())
      .post('/api/v1/admin/auth/login')
      .send({ email, password })
      .expect(200);
    token = String(record(login).accessToken);
  }, 60_000);

  afterAll(async () => {
    /* Deleting a subject removes it for good, with its specializations. */
    if (subjectId)
      await admin('delete', `/api/v1/admin/subjects/${subjectId}`, {}).catch(
        () => undefined,
      );
    await app?.close();
  });

  it('leaves a draft specialization a draft, in the admin and off the site', async () => {
    subjectId = String(
      record(
        await expectStatus(
          admin('post', '/api/v1/admin/subjects', {
            name: `Publish Scope ${stamp}`,
            slug: subjectSlug,
            shortDescription: 'A subject whose specialization stays a draft.',
          }),
          201,
        ),
      ).id,
    );
    const branchId = String(
      record(
        await expectStatus(
          admin('post', `/api/v1/admin/subjects/${subjectId}/sub-subjects`, {
            name: `Publish Scope Branch ${stamp}`,
            slug: branchSlug,
          }),
          201,
        ),
      ).id,
    );

    const published = record(
      await expectStatus(
        admin('post', `/api/v1/admin/subjects/${subjectId}/publish`, {}),
        201,
      ),
    );
    expect(published.status).toBe('PUBLISHED');
    expect(published.subSubjects).toEqual([
      expect.objectContaining({ id: branchId, status: 'DRAFT' }),
    ]);

    const branch = record(
      await expectStatus(
        admin('get', `/api/v1/admin/specializations/${branchId}`),
        200,
      ),
    );
    expect(branch.status).toBe('DRAFT');
    expect(branch.publishedAt).toBeNull();

    const publicPath = `/api/v1/subjects/${subjectSlug}/specializations/${branchSlug}`;
    await expectStatus(request(app.getHttpServer()).get(publicPath), 404);

    /* Published on its own, it reaches the site. */
    await expectStatus(
      admin(
        'post',
        `/api/v1/admin/subjects/${subjectId}/sub-subjects/${branchId}/publish`,
        {},
      ),
      201,
    );
    await expectStatus(request(app.getHttpServer()).get(publicPath), 200);
  });
});
