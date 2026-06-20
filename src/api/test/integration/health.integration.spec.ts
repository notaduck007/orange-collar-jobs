/**
 * Integration smoke test — verifies the health endpoint wires up correctly
 * against real Postgres + Redis + MinIO containers.
 *
 * Prerequisites:
 * - Local: `docker compose up -d postgres redis minio` (buckets via compose minio-init)
 * - CI: workflow runs `scripts/ci-minio-up.sh` before tests (sets CI_MINIO_READY)
 */
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import request from "supertest";
import { AppModule } from "../../src/app.module.js";
import { createTestApp, type TestApp } from "../helpers/create-test-app.js";

const REPO_ROOT = resolve(__dirname, "../../../../");

describe("GET /api/health (integration)", () => {
  let testApp: TestApp | undefined;

  beforeAll(async () => {
    // CI already started MinIO + buckets via ci-minio-up.sh — do not run compose/mc again.
    if (process.env.CI_MINIO_READY !== "true") {
      try {
        execSync("bash scripts/ensure-minio-buckets.sh", {
          cwd: REPO_ROOT,
          stdio: "inherit",
        });
      } catch {
        // Buckets may already exist (docker compose minio-init) or Docker CLI is unavailable.
      }
    }

    testApp = await createTestApp(AppModule, 60_000);
  }, 70_000);

  afterAll(async () => {
    if (testApp) {
      await testApp.close();
    }
  });

  it("returns 200 with status ok when all dependencies are healthy", async () => {
    if (!testApp) {
      throw new Error("testApp is not defined");
    }
    const res = await request(testApp.app.getHttpServer()).get("/api/health").expect(200);

    expect(res.body).toMatchObject({ status: "ok" });
  });

  it("reports db, redis, and storage as up", async () => {
    if (!testApp) {
      throw new Error("testApp is not defined");
    }
    const res = await request(testApp.app.getHttpServer()).get("/api/health").expect(200);

    const info = res.body as { info?: Record<string, { status: string }> };
    expect(info.info?.["db"]?.status).toBe("up");
    expect(info.info?.["redis"]?.status).toBe("up");
    expect(info.info?.["storage"]?.status).toBe("up");
  });
});
