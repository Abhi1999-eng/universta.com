import type { INestApplication } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
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

// A minimal valid 1x1 PNG, used as fictional local test fixture content.
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

describe('Media library (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  let mediaId = '';

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
    if (mediaId) await prisma.mediaAsset.deleteMany({ where: { id: mediaId } });
    await app.close();
  });

  it('rejects an upload with no file', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/media')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
  });

  it('rejects an unsupported file type', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/media')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', Buffer.from('<svg onload="alert(1)"/>'), {
        filename: 'evil.svg',
        contentType: 'image/svg+xml',
      })
      .expect(400);
  });

  it('uploads a valid image and persists real metadata', async () => {
    const uploaded = await request(app.getHttpServer())
      .post('/api/v1/admin/media')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('title', 'Fictional demo media asset')
      .field('altText', 'A 1x1 fictional test pixel')
      .attach('file', PNG_BYTES, {
        filename: 'test-pixel.png',
        contentType: 'image/png',
      })
      .expect(201);
    mediaId = String(data(uploaded).id);
    expect(data(uploaded).mimeType).toBe('image/png');
    expect(data(uploaded).storageProvider).toBe('LOCAL');
    expect(data(uploaded).publicUrl).toMatch(/^\/media\/[\w-]+\.png$/);
    expect(data(uploaded).altText).toBe('A 1x1 fictional test pixel');
  });

  it('is servable from the public media endpoint with a real image content type', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/v1/admin/media')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const rows = (body(list).data as RecordValue[]) ?? [];
    const mine = rows.find((row) => row.id === mediaId);
    expect(mine).toBeTruthy();
    const publicPath = String(mine?.publicUrl).replace(
      '/media/',
      '/api/v1/media/',
    );
    const served = await request(app.getHttpServer()).get(publicPath);
    expect(served.status).toBe(200);
    expect(served.headers['content-type']).toBe('image/png');
  });

  it('rejects a filename outside the generated-name pattern on the public media endpoint', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/media/not%20a%20real%20filename.png')
      .expect(400);
  });

  it('appears in the list, unused', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/v1/admin/media')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const rows = (body(list).data as RecordValue[]) ?? [];
    const mine = rows.find((row) => row.id === mediaId);
    expect(mine?.inUse).toBe(false);
  });

  it('updates metadata', async () => {
    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/admin/media/${mediaId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ altText: 'Updated fictional alt text', folder: 'demo-folder' })
      .expect(200);
    expect(data(updated).altText).toBe('Updated fictional alt text');
    expect(data(updated).folder).toBe('demo-folder');
  });

  it('is blocked from archiving while a real record references it, then archives once free', async () => {
    const university = await prisma.university.findFirst({
      where: { deletedAt: null },
    });
    if (!university) throw new Error('Expected at least one seeded university');
    await prisma.university.update({
      where: { id: university.id },
      data: { featuredMediaId: mediaId },
    });
    await request(app.getHttpServer())
      .delete(`/api/v1/admin/media/${mediaId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409);

    await prisma.university.update({
      where: { id: university.id },
      data: { featuredMediaId: null },
    });
    await request(app.getHttpServer())
      .delete(`/api/v1/admin/media/${mediaId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('rejects requests without an admin token', async () => {
    await request(app.getHttpServer()).get('/api/v1/admin/media').expect(401);
  });
});
