import { Body, Controller, Get, INestApplication, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { ExpressAdapter } from '@nestjs/platform-express';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString } from 'class-validator';
import { jest } from '@jest/globals';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApplication, configureSwagger } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { RuntimeConfigService } from '../src/config/runtime-config.service';
import type { ValidatedEnvironment } from '../src/config/environment';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function responseBody(response: { body: unknown }): Record<string, unknown> {
  return asRecord(response.body);
}

class ValidationDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @Type(() => Number)
  @IsInt()
  age!: number;
}

@Controller('test-validation')
class TestValidationController {
  @Post()
  validate(@Body() body: ValidationDto): ValidationDto {
    return body;
  }
}

@Controller('test-errors')
class TestErrorsController {
  @Get('unexpected')
  unexpected(): never {
    throw new Error('DATABASE_URL=mysql://user:password@localhost/universta');
  }
}

async function createTestApp(
  prismaOverride?: Partial<PrismaService>,
  swaggerEnabledOverride?: boolean,
): Promise<INestApplication<App>> {
  const builder = Test.createTestingModule({
    imports: [AppModule],
    controllers: [TestValidationController, TestErrorsController],
  });

  if (prismaOverride) {
    builder.overrideProvider(PrismaService).useValue(prismaOverride);
  }

  if (swaggerEnabledOverride !== undefined) {
    builder.overrideProvider(RuntimeConfigService).useFactory({
      inject: [ConfigService],
      factory: (configService: ConfigService<ValidatedEnvironment, true>) => ({
        ...new RuntimeConfigService(configService).value,
        swaggerEnabled: swaggerEnabledOverride,
      }),
    });
  }

  const moduleFixture: TestingModule = await builder.compile();
  const app = moduleFixture.createNestApplication(new ExpressAdapter());
  configureApplication(app);
  await app.init();
  configureSwagger(app);
  return app;
}

describe('API foundation (e2e)', () => {
  let app: INestApplication<App>;
  const previousSwaggerSetting = process.env.SWAGGER_ENABLED;

  beforeAll(async () => {
    process.env.SWAGGER_ENABLED = 'true';
    app = await createTestApp();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (previousSwaggerSetting === undefined) {
      delete process.env.SWAGGER_ENABLED;
    } else {
      process.env.SWAGGER_ENABLED = previousSwaggerSetting;
    }
  });

  it('returns database health outside the versioned prefix', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(responseBody(response)).toMatchObject({
      status: 'ok',
      database: 'up',
    });
    expect(responseBody(response).timestamp).toEqual(expect.any(String));
    expect(response.headers['x-request-id']).toEqual(expect.any(String));
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['referrer-policy']).toBe(
      'strict-origin-when-cross-origin',
    );
    expect(response.headers['permissions-policy']).toBe(
      'camera=(), microphone=(), geolocation=()',
    );
  });

  it('allows the public and admin origins but omits the header for an unknown origin', async () => {
    await request(app.getHttpServer())
      .get('/health')
      .set('Origin', 'http://localhost:3000')
      .expect('access-control-allow-origin', 'http://localhost:3000');
    await request(app.getHttpServer())
      .get('/health')
      .set('Origin', 'http://localhost:3001')
      .expect('access-control-allow-origin', 'http://localhost:3001');

    const unknownOrigin = await request(app.getHttpServer())
      .get('/health')
      .set('Origin', 'http://unknown.example');
    expect(
      unknownOrigin.headers['access-control-allow-origin'],
    ).toBeUndefined();
    await request(app.getHttpServer()).get('/health').expect(200);
  });

  it('preserves a safe incoming request ID and replaces an invalid one', async () => {
    const safeId = await request(app.getHttpServer())
      .get('/health')
      .set('x-request-id', 'safe-request-123')
      .expect(200);
    expect(safeId.headers['x-request-id']).toBe('safe-request-123');

    const invalidId = await request(app.getHttpServer())
      .get('/health')
      .set('x-request-id', 'x'.repeat(101))
      .expect(200);
    expect(invalidId.headers['x-request-id']).not.toBe('x'.repeat(101));
    expect(invalidId.headers['x-request-id']).toEqual(expect.any(String));
  });

  it('returns stable validation and not-found envelopes', async () => {
    const valid = await request(app.getHttpServer())
      .post('/api/v1/test-validation')
      .send({ name: 'Example', age: '21' })
      .expect(201);
    expect(responseBody(valid)).toEqual({ name: 'Example', age: 21 });

    const invalid = await request(app.getHttpServer())
      .post('/api/v1/test-validation')
      .send({ name: 'Example', age: 21, unexpected: true })
      .expect(400);
    expect(responseBody(invalid)).toMatchObject({
      data: null,
      meta: null,
      error: { code: 'VALIDATION_ERROR', message: 'Request validation failed' },
    });
    const invalidBody = responseBody(invalid);
    expect(asRecord(invalidBody.error).details).toEqual(expect.any(Array));
    expect(invalidBody.requestId).toEqual(invalid.headers['x-request-id']);
    expect(invalidBody.timestamp).toEqual(expect.any(String));

    const notFound = await request(app.getHttpServer())
      .get('/api/v1/route-that-does-not-exist')
      .expect(404);
    expect(responseBody(notFound)).toMatchObject({
      data: null,
      error: { code: 'NOT_FOUND', message: 'Route not found' },
    });
    expect(responseBody(notFound).requestId).toEqual(
      notFound.headers['x-request-id'],
    );
  });

  it('does not expose unexpected error details or secrets', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/test-errors/unexpected')
      .expect(500);

    expect(responseBody(response)).toMatchObject({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
    expect(JSON.stringify(responseBody(response))).not.toContain(
      'DATABASE_URL',
    );
    expect(JSON.stringify(responseBody(response))).not.toContain('password');
  });

  it('serves Swagger UI and its JSON document when enabled', async () => {
    await request(app.getHttpServer()).get('/api/docs').expect(200);
    const document = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);
    expect(asRecord(responseBody(document).info)).toMatchObject({
      title: 'Universta API',
      version: '1.0',
    });
    expect(asRecord(responseBody(document).paths)['/health']).toBeDefined();
  });
});

describe('API foundation failure modes (e2e)', () => {
  it('returns HTTP 503 without database details when the database health check fails', async () => {
    process.env.SWAGGER_ENABLED = 'false';
    const app = await createTestApp(
      {
        checkDatabaseConnection: jest
          .fn()
          .mockRejectedValue(new Error('database connection details')),
      },
      false,
    );

    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(503);
    await app.close();

    const degradedBody = responseBody(response);
    expect(degradedBody).toMatchObject({
      status: 'degraded',
      database: 'down',
    });
    expect(typeof degradedBody.timestamp).toBe('string');
    expect(JSON.stringify(responseBody(response))).not.toContain(
      'database connection details',
    );
  });

  it('does not register Swagger routes when disabled', async () => {
    process.env.SWAGGER_ENABLED = 'false';
    const app = await createTestApp(
      {
        checkDatabaseConnection: jest.fn().mockResolvedValue(undefined),
      },
      false,
    );

    await request(app.getHttpServer()).get('/api/docs').expect(404);
    await app.close();
  });
});
