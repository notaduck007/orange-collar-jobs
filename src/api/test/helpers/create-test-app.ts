/**
 * Shared test-app factory used by all E2E and integration specs.
 *
 * By delegating to configureApp() — the same function used by main.ts — we
 * guarantee that versioning, pipes, and filters are identical between the live
 * server and the test harness. This prevents "works in prod, fails in test"
 * divergence.
 */
import type { INestApplication, Type } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { getQueueToken } from "@nestjs/bull";
import type { Queue } from "bull";
import { configureApp } from "../../src/app.factory.js";
import {
  QUEUE_BATCH_INGEST,
  QUEUE_NOTIFICATIONS,
  QUEUE_JOB_ALERTS,
} from "../../src/core/queue/queue.module.js";

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
export async function createTestApp(rootModule: Type, timeoutMs = 60_000): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [rootModule] }).compile();

  const app = moduleRef.createNestApplication();

  // Apply the same configuration as production
  configureApp(app);

  try {
    await Promise.race([
      app.init(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`app.init() timed out after ${timeoutMs}ms`)), timeoutMs),
      ),
    ]);
  } catch (err) {
    // Ensure NestJS cleans up listeners and connections even when init fails,
    // so the Jest worker process can exit cleanly rather than hanging.
    await app.close().catch(() => undefined);
    throw err;
  }

  return {
    app,
    close: () => drainQueuesAndClose(app),
  };
}

/**
 * Drain all known Bull queues and then close the NestJS application.
 *
 * Bull jobs persist in Redis even after the NestJS app that enqueued them has
 * closed. Subsequent test-file apps inherit those pending jobs and their workers
 * start processing them — referencing data that the previous file's cleanup
 * already deleted. Draining the queues before close prevents cross-file
 * contamination without forcing a full Redis flush.
 */
async function drainQueuesAndClose(app: INestApplication): Promise<void> {
  for (const name of [QUEUE_NOTIFICATIONS, QUEUE_BATCH_INGEST, QUEUE_JOB_ALERTS]) {
    try {
      const queue = app.get<Queue>(getQueueToken(name), { strict: false });
      if (queue) {
        // Remove all waiting and delayed jobs so the next test file's workers
        // don't pick them up. Active jobs are left to complete naturally.
        await queue.empty();
        const delayed = await queue.getDelayed();
        await Promise.all(delayed.map((j) => j.remove().catch(() => undefined)));
      }
    } catch {
      // Queue not registered in this module — skip silently
    }
  }
  await app.close();
}

/**
 * Build a signed JWT for a synthetic test user — avoids DB round-trips in
 * unit/E2E tests that just need a valid token shape.
 *
 * Usage:
 *   const token = signTestToken(app, { sub: 'user-id', email: 'a@b.com', role: 'WORKER' });
 */
import { JwtService } from "@nestjs/jwt";
import type { JwtPayload } from "../../src/core/auth/jwt.strategy.js";

export function signTestToken(app: INestApplication, payload: JwtPayload): string {
  const jwt = app.get(JwtService);
  return jwt.sign(payload);
}
