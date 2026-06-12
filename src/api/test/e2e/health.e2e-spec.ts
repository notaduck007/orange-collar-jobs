import { Test, type TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';

describe('Health endpoint (E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api', { exclude: ['api/health'] });
    await app.init();
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health → 200 with status:ok', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect((res: request.Response) => {
        expect((res.body as { status: string }).status).toBe('ok');
      });
  });

  it('GET /api/health → has db, redis, storage, memory_heap details', async () => {
    const res = await request(app.getHttpServer()).get('/api/health');
    const info = res.body as { info?: Record<string, unknown> };
    expect(info.info).toBeDefined();
    expect(Object.keys(info.info ?? {})).toEqual(
      expect.arrayContaining(['db', 'redis', 'storage', 'memory_heap']),
    );
  });
});
