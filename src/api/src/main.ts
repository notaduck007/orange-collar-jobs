import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { GlobalExceptionFilter } from './core/error/global-exception.filter.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // ── Structured logging (Pino) ────────────────────────────────────────────
  app.useLogger(app.get(Logger));

  // ── Global pipes ─────────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  // ── Global exception filter ──────────────────────────────────────────────
  app.useGlobalFilters(new GlobalExceptionFilter());

  // ── CORS ─────────────────────────────────────────────────────────────────
  app.enableCors({
    origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:5173',
    credentials: true,
  });

  // ── API prefix ───────────────────────────────────────────────────────────
  app.setGlobalPrefix('api', { exclude: ['api/health'] });

  // ── Versioning ───────────────────────────────────────────────────────────
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // ── Swagger UI (dev only) ─────────────────────────────────────────────────
  if (process.env['NODE_ENV'] !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('WarehouseJobs.com API')
      .setDescription('REST API — see docs/api/openapi.yaml for the authoritative contract')
      .setVersion('1.0.1')
      .addBearerAuth()
      .addApiKey({ type: 'apiKey', in: 'header', name: 'X-Api-Key' }, 'ApiKeyAuth')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = parseInt(process.env['PORT'] ?? '3001', 10);
  await app.listen(port);
  app.get(Logger).log(`API running on http://localhost:${port}/api/health`);
}

void bootstrap();
