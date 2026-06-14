/**
 * Phase 1 backwards-compatibility against real Postgres + Redis + MinIO.
 */
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { createTestApp, type TestApp } from '../helpers/create-test-app.js';

describe('Phase 1 backwards compatibility (integration)', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp(AppModule, 60_000);
  }, 70_000);

  afterAll(async () => {
    await testApp.close();
  });

  it('GET /api/health → 200 with live dependencies', async () => {
    const res = await request(testApp.app.getHttpServer()).get('/api/health').expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.info?.db?.status).toBe('up');
    expect(res.body.info?.redis?.status).toBe('up');
    expect(res.body.info?.storage?.status).toBe('up');
  });
});
