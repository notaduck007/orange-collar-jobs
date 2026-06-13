/**
 * E2E tests for GET /api/health
 *
 * OpenAPI contract: docs/api/openapi.yaml#/paths/~1api~1health
 * Controller: src/core/health/health.controller.ts (VERSION_NEUTRAL)
 *
 * Route: /api/health (no version segment — health is version-neutral)
 */
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { createTestApp, type TestApp } from '../helpers/create-test-app.js';

describe('Health endpoint (E2E)', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp(AppModule);
  }, 30_000);

  afterAll(async () => {
    await testApp.close();
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  it('GET /api/health → 200 with status:ok', async () => {
    const res = await request(testApp.app.getHttpServer())
      .get('/api/health')
      .expect(200);

    expect((res.body as { status: string }).status).toBe('ok');
  });

  it('response contains info with db, redis, and storage details', async () => {
    const res = await request(testApp.app.getHttpServer())
      .get('/api/health')
      .expect(200);

    const body = res.body as { info?: Record<string, unknown> };
    expect(body.info).toBeDefined();

    const expectedKeys = ['db', 'redis', 'storage'];
    // In production the heap check is also included
    if (process.env.NODE_ENV === 'production') {
      expectedKeys.push('memory_heap');
    }
    expect(Object.keys(body.info ?? {})).toEqual(expect.arrayContaining(expectedKeys));
  });

  it('no version segment in path — /api/v1/health → 404', async () => {
    await request(testApp.app.getHttpServer())
      .get('/api/v1/health')
      .expect(404);
  });

  it('response includes cache-control: no-cache (terminus default)', async () => {
    const res = await request(testApp.app.getHttpServer()).get('/api/health');
    expect(res.headers['cache-control']).toMatch(/no-cache/);
  });

  it('is publicly accessible — no Authorization header required', async () => {
    await request(testApp.app.getHttpServer())
      .get('/api/health')
      .expect(200);
  });
});
