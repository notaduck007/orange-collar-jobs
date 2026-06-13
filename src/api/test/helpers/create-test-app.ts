/**
 * Shared test-app factory used by all E2E and integration specs.
 *
 * By delegating to configureApp() — the same function used by main.ts — we
 * guarantee that versioning, pipes, and filters are identical between the live
 * server and the test harness. This prevents "works in prod, fails in test"
 * divergence.
 */
import type { INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { configureApp } from '../../src/app.factory.js';

export interface TestApp {
  app: INestApplication;
  close: () => Promise<void>;
}

/**
 * Bootstrap a NestJS application for testing.
 *
 * @param rootModule  The module to bootstrap (usually AppModule)
 * @param timeoutMs   How long to wait for app.init() — default 30 s
 */
export async function createTestApp(
  rootModule: Type,
  timeoutMs = 30_000,
): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [rootModule] })
    .compile();

  const app = moduleRef.createNestApplication();

  // Apply the same configuration as production
  configureApp(app);

  await Promise.race([
    app.init(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`app.init() timed out after ${timeoutMs}ms`)), timeoutMs),
    ),
  ]);

  return {
    app,
    close: () => app.close(),
  };
}

/**
 * Build a signed JWT for a synthetic test user — avoids DB round-trips in
 * unit/E2E tests that just need a valid token shape.
 *
 * Usage:
 *   const token = signTestToken(app, { sub: 'user-id', email: 'a@b.com', role: 'WORKER' });
 */
import { JwtService } from '@nestjs/jwt';
import type { JwtPayload } from '../../src/core/auth/jwt.strategy.js';

export function signTestToken(app: INestApplication, payload: JwtPayload): string {
  const jwt = app.get(JwtService);
  return jwt.sign(payload);
}
