import type { INestApplication } from '@nestjs/common';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { GlobalExceptionFilter } from './core/error/global-exception.filter.js';

/**
 * Applies the canonical NestJS application configuration shared by main.ts and
 * the test harness. Keeping this in a single place ensures that tests are
 * always exercising the same pipeline as production:
 *
 *   prefix  : api
 *   version : URI-based  (api/v1/…, api/v2/…)
 *   pipes   : ValidationPipe (whitelist + transform)
 *   filters : GlobalExceptionFilter
 *
 * Health is VERSION_NEUTRAL so it lives at /api/health with no version segment.
 *
 * Call configureApp(app) BEFORE app.init() / app.listen().
 */
export function configureApp(app: INestApplication): void {
  // Global validation — all incoming DTOs are stripped and validated
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  // Typed error responses for all unhandled exceptions
  app.useGlobalFilters(new GlobalExceptionFilter());

  // All routes share the /api prefix. Health's VERSION_NEUTRAL attribute keeps
  // it at /api/health — no version segment is inserted. No need to exclude health
  // from the prefix; the version-neutral attribute is sufficient.
  app.setGlobalPrefix('api');

  // URI versioning: bump defaultVersion to '2' when introducing a breaking
  // change — v1 consumers continue to work without any changes on their side.
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
}
