import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { configureApp } from './app.factory.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Structured logging (Pino) — must be set before configureApp logs anything
  app.useLogger(app.get(Logger));

  // CORS — allow the frontend origin set in .env
  app.enableCors({
    origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:5173',
    credentials: true,
  });

  // Shared pipeline: validation, exception filter, prefix, URI versioning
  configureApp(app);

  // Swagger UI (dev only) — reflects the live route tree after configureApp
  if (process.env['NODE_ENV'] !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('WarehouseJobs.com API')
      .setDescription(
        'REST API — see docs/api/openapi.yaml for the authoritative contract.\n\n' +
          'All endpoints live under `/api/v1/` (URI versioning). Health is at `/api/health`.',
      )
      .setVersion('1.0.1')
      .addBearerAuth()
      .addApiKey({ type: 'apiKey', in: 'header', name: 'X-Api-Key' }, 'ApiKeyAuth')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = parseInt(process.env['PORT'] ?? '3001', 10);
  await app.listen(port);
  app
    .get(Logger)
    .log(`API running on http://localhost:${port} — health: /api/health  docs: /api/docs`);
}

void bootstrap();
