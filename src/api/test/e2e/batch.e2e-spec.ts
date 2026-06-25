/**
 * E2E tests — Batch Ingestion HTTP surface (OpenAPI contract: docs/api/openapi.yaml §Batch)
 *
 * Validates response shapes, HTTP status codes, and auth semantics as defined
 * in the OpenAPI spec. Does not verify DB internals — that's the integration spec.
 */
import request from "supertest";
import { AppModule } from "../../src/app.module.js";
import { PrismaService } from "../../src/core/database/prisma.service.js";
import { createTestApp, signTestToken, type TestApp } from "../helpers/create-test-app.js";
import { createTestAdmin, cleanupJobsTestData } from "../helpers/jobs.fixtures.js";
import {
  BATCH_JOB_ITEM,
  BATCH_JOB_ITEM_EXT,
  buildBatchItems,
  cleanupBatchData,
  seedApiKey,
  TEST_API_KEY,
} from "../helpers/batch.fixtures.js";

const ADMIN_EMAIL = "e2e-batch-admin@test.com";
const VENDOR_EMAIL = "e2e-batch-vendor@test.com";

describe("Batch endpoints (E2E)", () => {
  let testApp: TestApp;
  let prisma: PrismaService;
  let adminToken: string;

  beforeAll(async () => {
    testApp = await createTestApp(AppModule, 60_000);
    prisma = testApp.app.get(PrismaService);
  }, 70_000);

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    await cleanupBatchData(prisma);
    await cleanupJobsTestData(prisma, [ADMIN_EMAIL, VENDOR_EMAIL]);

    const admin = await createTestAdmin(prisma, ADMIN_EMAIL);
    adminToken = signTestToken(testApp.app, { sub: admin.id, email: admin.email, role: "admin" });

    await seedApiKey(prisma);
  });

  // ── POST /api/v1/jobs/batch ───────────────────────────────────────────────

  describe("POST /api/v1/jobs/batch", () => {
    it("returns 401 with no credentials", async () => {
      await request(testApp.app.getHttpServer())
        .post("/api/v1/jobs/batch")
        .send({ jobs: [BATCH_JOB_ITEM] })
        .expect(401);
    });

    it("returns 422 on validation failure (missing required field)", async () => {
      await request(testApp.app.getHttpServer())
        .post("/api/v1/jobs/batch")
        .set("X-Api-Key", TEST_API_KEY)
        .send({
          jobs: [
            {
              // Missing: title, employmentType, shift, description, sourceType
              location: "Dallas, TX",
            },
          ],
        })
        .expect(422);
    });

    it("returns 200 + BatchStatus shape for sync batch (≤100)", async () => {
      const res = await request(testApp.app.getHttpServer())
        .post("/api/v1/jobs/batch")
        .set("X-Api-Key", TEST_API_KEY)
        .send({ jobs: [BATCH_JOB_ITEM, BATCH_JOB_ITEM_EXT], source: "e2e-test" })
        .expect(200);

      // Validate OpenAPI BatchStatus shape
      expect(res.body).toMatchObject({
        batchId: expect.any(String),
        status: expect.stringMatching(/^(completed|processing)$/),
        total: 2,
        created: expect.any(Number),
        updated: expect.any(Number),
        skipped: expect.any(Number),
        failed: expect.any(Number),
        errors: expect.any(Array),
      });
      // startedAt / completedAt may be null or ISO string
      expect(
        res.body.startedAt === null || typeof res.body.startedAt === "string",
      ).toBe(true);
    });

    it("returns 202 + BatchResponse shape for async batch (>100)", async () => {
      const items = buildBatchItems(101);
      const res = await request(testApp.app.getHttpServer())
        .post("/api/v1/jobs/batch")
        .set("X-Api-Key", TEST_API_KEY)
        .send({ jobs: items })
        .expect(202);

      // Validate OpenAPI BatchResponse shape
      expect(res.body).toMatchObject({
        batchId: expect.any(String),
        status: "queued",
        count: 101,
        message: expect.any(String),
      });
    });

    it("accepts admin Bearer token in place of API key", async () => {
      await request(testApp.app.getHttpServer())
        .post("/api/v1/jobs/batch")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ jobs: [BATCH_JOB_ITEM] })
        .expect(200);
    });

    it("returns 401 with invalid X-Api-Key", async () => {
      await request(testApp.app.getHttpServer())
        .post("/api/v1/jobs/batch")
        .set("X-Api-Key", "wrong-key-value")
        .send({ jobs: [BATCH_JOB_ITEM] })
        .expect(401);
    });
  });

  // ── GET /api/v1/jobs/batch/:batchId/status ───────────────────────────────

  describe("GET /api/v1/jobs/batch/:batchId/status", () => {
    it("returns 401 with no credentials", async () => {
      await request(testApp.app.getHttpServer())
        .get("/api/v1/jobs/batch/some-id/status")
        .expect(401);
    });

    it("returns 404 for non-existent batchId", async () => {
      await request(testApp.app.getHttpServer())
        .get("/api/v1/jobs/batch/00000000-0000-0000-0000-000000000000/status")
        .set("X-Api-Key", TEST_API_KEY)
        .expect(404);
    });

    it("returns 200 + BatchStatus shape after sync ingest", async () => {
      // Create a sync batch
      const createRes = await request(testApp.app.getHttpServer())
        .post("/api/v1/jobs/batch")
        .set("X-Api-Key", TEST_API_KEY)
        .send({ jobs: [BATCH_JOB_ITEM] })
        .expect(200);

      const { batchId } = createRes.body as { batchId: string };

      const statusRes = await request(testApp.app.getHttpServer())
        .get(`/api/v1/jobs/batch/${batchId}/status`)
        .set("X-Api-Key", TEST_API_KEY)
        .expect(200);

      expect(statusRes.body).toMatchObject({
        batchId,
        status: "completed",
        total: 1,
        created: 1,
        updated: 0,
        skipped: 0,
        failed: 0,
        errors: [],
      });
    });

    it("can poll using Bearer token as well", async () => {
      const createRes = await request(testApp.app.getHttpServer())
        .post("/api/v1/jobs/batch")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ jobs: [BATCH_JOB_ITEM] })
        .expect(200);

      await request(testApp.app.getHttpServer())
        .get(`/api/v1/jobs/batch/${createRes.body.batchId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  // ── CSV upload (multipart on same POST /api/v1/jobs/batch) ─────────────────

  describe("POST /api/v1/jobs/batch (CSV multipart)", () => {
    it("returns 200 after uploading a valid CSV", async () => {
      const csvContent = [
        "title,location,city,state,employmentType,shift,description,sourceType",
        "Forklift Operator,Dallas TX,Dallas,TX,full_time,first,Operate forklifts safely at all times in a warehouse.,scraped",
        "Picker Packer,Austin TX,Austin,TX,part_time,second,Pick and pack orders for same day shipping efficiently.,scraped",
      ].join("\n");

      const res = await request(testApp.app.getHttpServer())
        .post("/api/v1/jobs/batch")
        .set("X-Api-Key", TEST_API_KEY)
        .attach("file", Buffer.from(csvContent), { filename: "jobs.csv", contentType: "text/csv" })
        .expect(200);

      expect(res.body.total).toBe(2);
      expect(res.body.created).toBeGreaterThan(0);
    });

    it("returns 422 when multipart request has no file and no JSON jobs array", async () => {
      await request(testApp.app.getHttpServer())
        .post("/api/v1/jobs/batch")
        .set("X-Api-Key", TEST_API_KEY)
        .expect(422);
    });
  });

  // ── Phase 1–3 backwards compatibility ────────────────────────────────────

  describe("Phase 1–3 backwards compatibility", () => {
    it("GET /api/health still returns 200 with status:ok", async () => {
      const res = await request(testApp.app.getHttpServer()).get("/api/health").expect(200);
      expect(res.body.status).toBe("ok");
    });

    it("GET /api/v1/me without token returns 401", async () => {
      await request(testApp.app.getHttpServer()).get("/api/v1/me").expect(401);
    });

    it("GET /api/v1/jobs returns 200 (public)", async () => {
      const res = await request(testApp.app.getHttpServer()).get("/api/v1/jobs").expect(200);
      expect(res.body).toHaveProperty("data");
      expect(res.body).toHaveProperty("meta");
    });
  });
});
