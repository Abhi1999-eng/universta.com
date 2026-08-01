import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import type { INestApplication } from '@nestjs/common';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import type { NextFunction, Request, Response } from 'express';
import { AppExceptionFilter } from './common/app-exception.filter';
import { redactSensitiveFields } from './common/structured-logger.service';
import { createGlobalValidationPipe } from './common/validation';
import { RuntimeConfigService } from './config/runtime-config.service';

export function configureApplication(app: INestApplication): void {
  const runtimeConfig = app.get(RuntimeConfigService);

  const express = app.getHttpAdapter().getInstance() as {
    disable(setting: string): void;
  };
  express.disable('x-powered-by');
  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=()',
    );
    next();
  });

  app.setGlobalPrefix('api/v1', { exclude: ['health'] });
  app.enableShutdownHooks();
  app.use(cookieParser());
  const corsOptions: CorsOptions = {
    credentials: true,
    origin: (origin, callback) => {
      callback(null, !origin || runtimeConfig.corsOrigins.includes(origin));
    },
  };
  app.enableCors(corsOptions);
  app.useGlobalPipes(createGlobalValidationPipe());
  app.useGlobalFilters(app.get(AppExceptionFilter));

  configureSwagger(app, runtimeConfig);
}

export function configureSwagger(
  app: INestApplication,
  runtimeConfig = app.get(RuntimeConfigService),
): void {
  if (runtimeConfig.swaggerEnabled) {
    const documentConfig = new DocumentBuilder()
      .setTitle('Universta API')
      .setDescription('Universta Phase 1 API')
      .setVersion('1.0')
      .addBearerAuth()
      .addCookieAuth('admin-refresh-cookie', {
        type: 'apiKey',
        in: 'cookie',
        name: runtimeConfig.authRefreshCookieName,
      })
      .build();
    const document = SwaggerModule.createDocument(app, documentConfig);
    SwaggerModule.setup('api/docs', app, document, {
      useGlobalPrefix: false,
      jsonDocumentUrl: 'api/docs-json',
      swaggerOptions: { persistAuthorization: false },
    });
  }
}

export function safeStartupMessage(error: unknown): string {
  return error instanceof Error
    ? String(redactSensitiveFields(error.message))
    : 'Unknown startup error';
}
