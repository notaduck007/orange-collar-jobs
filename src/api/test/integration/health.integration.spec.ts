/**
 * Integration smoke test — verifies the health endpoint wires up correctly.
 * Requires: postgres + redis + minio running (docker compose up -d)
 */
import { Test, type TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';

describe('GET /api/health (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it('returns 200 when all dependencies are healthy', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok' });
  });
});
