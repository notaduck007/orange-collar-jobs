/**
 * E2E tests for GET /api/v1/me
 *
 * OpenAPI contract: docs/api/openapi.yaml#/paths/~1api~1v1~1me
 * Controller: src/core/auth/me.controller.ts  (version: '1')
 *
 * Route:  GET /api/v1/me
 * Auth:   JwtAuthGuard (Bearer token) — applied globally
 *
 * Happy-path (user exists in DB) lives in test/integration/auth.integration.spec.ts
 * because it requires a live Prisma connection to seed a user row.
 */
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../../src/app.module.js';
import { createTestApp, type TestApp } from '../helpers/create-test-app.js';

describe('GET /api/v1/me (E2E)', () => {
  let testApp: TestApp;
  let jwtService: JwtService;

  beforeAll(async () => {
    testApp = await createTestApp(AppModule);
    jwtService = testApp.app.get(JwtService);
  }, 30_000);

  afterAll(async () => {
    await testApp.close();
  });

  // ── 401 — no token ─────────────────────────────────────────────────────────

  it('returns 401 when no Authorization header is provided', async () => {
    await request(testApp.app.getHttpServer())
      .get('/api/v1/me')
      .expect(401);
  });

  it('returns 401 when Authorization scheme is Basic (not Bearer)', async () => {
    await request(testApp.app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', 'Basic dXNlcjpwYXNz')
      .expect(401);
  });

  it('returns 401 when token is malformed garbage', async () => {
    await request(testApp.app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', 'Bearer not.a.valid.jwt')
      .expect(401);
  });

  it('returns 401 when token is signed with the wrong secret', async () => {
    // Sign with a different secret — signature validation will fail
    const badService = new JwtService({ secret: 'wrong-secret-that-is-at-least-32-chars-x' });
    const badToken = badService.sign({ sub: 'x', email: 'x@x.com', role: 'WORKER' });

    await request(testApp.app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${badToken}`)
      .expect(401);
  });

  it('returns 401 when token is expired', async () => {
    const expiredToken = jwtService.sign(
      { sub: 'test-id', email: 'a@b.com', role: 'WORKER' },
      { expiresIn: '0s' },
    );

    await request(testApp.app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${expiredToken}`)
      .expect(401);
  });

  // ── 401 — valid JWT, user not in DB ────────────────────────────────────────

  it('returns 401 when token is cryptographically valid but user does not exist in DB', async () => {
    // JwtStrategy.validate() calls prisma.user.findUnique; this user does not exist
    const token = jwtService.sign({ sub: 'non-existent-uuid', email: 'ghost@test.com', role: 'WORKER' });

    await request(testApp.app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  // ── Route contract ─────────────────────────────────────────────────────────

  it('returns 404 for unversioned path /api/me', async () => {
    const token = jwtService.sign({ sub: 'id', email: 'a@b.com', role: 'WORKER' });
    await request(testApp.app.getHttpServer())
      .get('/api/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('returns 404 for /api/v2/me (version does not exist)', async () => {
    const token = jwtService.sign({ sub: 'id', email: 'a@b.com', role: 'WORKER' });
    await request(testApp.app.getHttpServer())
      .get('/api/v2/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });
});
