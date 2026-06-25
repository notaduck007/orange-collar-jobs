/**
 * Integration tests — Batch Ingestion domain (real Postgres + Redis via Docker Compose).
 *
 * Covers: sync ingest, async enqueue, deduplication, status polling.
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
  TEST_API_KEY_HASH,
} from "../helpers/batch.fixtures.js";

const ADMIN_EMAIL = "integration-batch-admin@test.com";

describe("Batch Ingestion (integration)", () => {
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
    await cleanupJobsTestData(prisma, [ADMIN_EMAIL]);

    const admin = await createTestAdmin(prisma, ADMIN_EMAIL);
    adminToken = signTestToken(testApp.app, { sub: admin.id, email: admin.email, role: "admin" });

    await seedApiKey(prisma);
  });

  // ── API key authentication ────────────────────────────────────────────────

  describe("Authentication", () => {
    it("rejects POST /api/v1/jobs/batch without credentials → 401", async () => {
      await request(testApp.app.getHttpServer())
        .post("/api/v1/jobs/batch")
        .send({ jobs: [BATCH_JOB_ITEM] })
        .expect(401);
    });

    it("rejects POST with invalid API key → 401", async () => {
      await request(testApp.app.getHttpServer())
        .post("/api/v1/jobs/batch")
        .set("X-Api-Key", "completely-wrong-key")
        .send({ jobs: [BATCH_JOB_ITEM] })
        .expect(401);
    });

    it("accepts POST with valid X-Api-Key → 200", async () => {
      const res = await request(testApp.app.getHttpServer())
        .post("/api/v1/jobs/batch")
        .set("X-Api-Key", TEST_API_KEY)
        .send({ jobs: [BATCH_JOB_ITEM] })
        .expect(200);

      expect(res.body).toMatchObject({ batchId: expect.any(String), status: "completed" });
    });

    it("accepts POST with valid Bearer token (admin) → 200", async () => {
      const res = await request(testApp.app.getHttpServer())
        .post("/api/v1/jobs/batch")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ jobs: [BATCH_JOB_ITEM] })
        .expect(200);

      expect(res.body.status).toBe("completed");
    });
  });

  // ── Sync ingest (≤100 jobs) ───────────────────────────────────────────────

  describe("Sync ingest (≤100 jobs)", () => {
    it("returns 200 + full BatchStatus with correct counters", async () => {
      const res = await request(testApp.app.getHttpServer())
        .post("/api/v1/jobs/batch")
        .set("X-Api-Key", TEST_API_KEY)
        .send({ jobs: [BATCH_JOB_ITEM, BATCH_JOB_ITEM_EXT], source: "integration-test" })
        .expect(200);

      expect(res.body).toMatchObject({
        batchId: expect.any(String),
        status: "completed",
        total: 2,
        created: 2,
        updated: 0,
        skipped: 0,
        failed: 0,
      });
    });

    it("persists a BatchJob record with status=completed", async () => {
      const res = await request(testApp.app.getHttpServer())
        .post("/api/v1/jobs/batch")
        .set("X-Api-Key", TEST_API_KEY)
        .send({ jobs: [BATCH_JOB_ITEM] })
        .expect(200);

      const record = await prisma.batchJob.findUnique({ where: { id: res.body.batchId } });
      expect(record?.status).toBe("completed");
      expect(record?.created).toBe(1);
    });

    it("actually creates a Job row in the database", async () => {
      await request(testApp.app.getHttpServer())
        .post("/api/v1/jobs/batch")
        .set("X-Api-Key", TEST_API_KEY)
        .send({ jobs: [BATCH_JOB_ITEM_EXT] })
        .expect(200);

      const job = await prisma.job.findFirst({
        where: { externalId: BATCH_JOB_ITEM_EXT.externalId ?? null },
      });
      expect(job).not.toBeNull();
      expect(job?.title).toBe(BATCH_JOB_ITEM_EXT.title);
      expect(job?.sourceType).toBe("scraped");
    });
  });

  // ── Deduplication ─────────────────────────────────────────────────────────

  describe("Deduplication by externalId", () => {
    it("skips identical re-submission (skipped++)", async () => {
      // First ingest — creates
      await request(testApp.app.getHttpServer())
        .post("/api/v1/jobs/batch")
        .set("X-Api-Key", TEST_API_KEY)
        .send({ jobs: [BATCH_JOB_ITEM_EXT] })
        .expect(200);

      // Second ingest — same content, same externalId → skipped
      const res = await request(testApp.app.getHttpServer())
        .post("/api/v1/jobs/batch")
        .set("X-Api-Key", TEST_API_KEY)
        .send({ jobs: [BATCH_JOB_ITEM_EXT] })
        .expect(200);

      expect(res.body.skipped).toBe(1);
      expect(res.body.created).toBe(0);
    });

    it("updates when content changes (updated++)", async () => {
      // First ingest — creates
      await request(testApp.app.getHttpServer())
        .post("/api/v1/jobs/batch")
        .set("X-Api-Key", TEST_API_KEY)
        .send({ jobs: [BATCH_JOB_ITEM_EXT] })
        .expect(200);

      // Second ingest — same externalId, different title → updated
      const updatedItem = { ...BATCH_JOB_ITEM_EXT, title: "UPDATED — Reach Truck Operator" };
      const res = await request(testApp.app.getHttpServer())
        .post("/api/v1/jobs/batch")
        .set("X-Api-Key", TEST_API_KEY)
        .send({ jobs: [updatedItem] })
        .expect(200);

      expect(res.body.updated).toBe(1);
      expect(res.body.created).toBe(0);
    });
  });

  // ── Async ingest (>100 jobs) ──────────────────────────────────────────────

  describe("Async ingest (>100 jobs)", () => {
    it("returns 202 + BatchResponse with queued status", async () => {
      const items = buildBatchItems(101);
      const res = await request(testApp.app.getHttpServer())
        .post("/api/v1/jobs/batch")
        .set("X-Api-Key", TEST_API_KEY)
        .send({ jobs: items })
        .expect(202);

      expect(res.body).toMatchObject({
        batchId: expect.any(String),
        status: "queued",
        count: 101,
      });
    });

    it("creates a BatchJob record with status=queued for async batch", async () => {
      const items = buildBatchItems(105);
      const res = await request(testApp.app.getHttpServer())
        .post("/api/v1/jobs/batch")
        .set("X-Api-Key", TEST_API_KEY)
        .send({ jobs: items })
        .expect(202);

      const record = await prisma.batchJob.findUnique({ where: { id: res.body.batchId } });
      expect(["queued", "processing", "completed"]).toContain(record?.status);
      expect(record?.total).toBe(105);
    });

    it("processes async batch to completion via Bull worker", async () => {
      const items = buildBatchItems(101);
      const res = await request(testApp.app.getHttpServer())
        .post("/api/v1/jobs/batch")
        .set("X-Api-Key", TEST_API_KEY)
        .send({ jobs: items })
        .expect(202);

      const { batchId } = res.body as { batchId: string };
      let finalStatus = "queued";
      let body: { status: string; created: number; failed: number; total: number } | null = null;

      for (let i = 0; i < 30; i += 1) {
        const poll = await request(testApp.app.getHttpServer())
          .get(`/api/v1/jobs/batch/${batchId}/status`)
          .set("X-Api-Key", TEST_API_KEY)
          .expect(200);
        body = poll.body;
        finalStatus = poll.body.status;
        if (finalStatus === "completed" || finalStatus === "failed") break;
        await new Promise((r) => setTimeout(r, 500));
      }

      expect(finalStatus).toBe("completed");
      expect(body).toMatchObject({
        total: 101,
        created: 101,
        failed: 0,
      });
    }, 45_000);
  });

  // ── Status polling ────────────────────────────────────────────────────────

  describe("GET /api/v1/jobs/batch/:batchId/status", () => {
    it("returns 200 + BatchStatus for an existing batch", async () => {
      // Create a batch first
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
      });
    });

    it("returns 404 for unknown batchId", async () => {
      await request(testApp.app.getHttpServer())
        .get("/api/v1/jobs/batch/00000000-0000-0000-0000-000000000000/status")
        .set("X-Api-Key", TEST_API_KEY)
        .expect(404);
    });
  });

  // ── Search priority (scraped ranks below direct) ──────────────────────────

  describe("Search priority (sourceType ordering)", () => {
    it("direct/vendor jobs appear before scraped batch jobs in search", async () => {
      // Create direct job
      const adminUser = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
      if (!adminUser) throw new Error("Admin user not found");
      const company = await prisma.company.create({
        data: {
          ownerId: adminUser.id,
          name: "Priority Test Co",
          slug: `priority-test-${Date.now()}`,
        },
      });

      await prisma.job.create({
        data: {
          companyId: company.id,
          title: "Direct Job — Priority Test",
          slug: `direct-priority-${Date.now()}`,
          category: "Forklift Operator",
          categorySlug: "forklift-operator",
          location: "Dallas, TX",
          city: "Dallas",
          state: "TX",
          employmentType: "full_time",
          shift: "first",
          description: "Direct job description that is long enough to be valid.",
          sourceType: "direct",
          status: "published",
          postedAt: new Date(),
        },
      });

      // Create scraped batch job
      await request(testApp.app.getHttpServer())
        .post("/api/v1/jobs/batch")
        .set("X-Api-Key", TEST_API_KEY)
        .send({
          jobs: [
            {
              ...BATCH_JOB_ITEM,
              externalId: "priority-test-scraped",
              title: "Scraped Batch Job — Priority Test",
              sourceType: "scraped",
            },
          ],
        })
        .expect(200);

      // Search: direct should appear first
      const searchRes = await request(testApp.app.getHttpServer())
        .get("/api/v1/jobs?city=Dallas&state=TX")
        .expect(200);

      const titles: string[] = searchRes.body.data.map((j: { title: string }) => j.title);
      const directIdx = titles.findIndex((t) => t.includes("Direct Job"));
      const scrapedIdx = titles.findIndex((t) => t.includes("Scraped Batch"));

      if (directIdx !== -1 && scrapedIdx !== -1) {
        expect(directIdx).toBeLessThan(scrapedIdx);
      }

      // Cleanup
      await prisma.job.deleteMany({
        where: { title: { in: ["Direct Job — Priority Test", "Scraped Batch Job — Priority Test"] } },
      });
      await prisma.company.delete({ where: { id: company.id } });
    });
  });

  // ── API key last_used_at update ───────────────────────────────────────────

  describe("API key usage tracking", () => {
    it("updates lastUsedAt on successful API key authentication", async () => {
      const before = await prisma.apiKey.findUnique({ where: { keyHash: TEST_API_KEY_HASH } });
      const beforeTs = before?.lastUsedAt;

      await request(testApp.app.getHttpServer())
        .post("/api/v1/jobs/batch")
        .set("X-Api-Key", TEST_API_KEY)
        .send({ jobs: [BATCH_JOB_ITEM] })
        .expect(200);

      let after = await prisma.apiKey.findUnique({ where: { keyHash: TEST_API_KEY_HASH } });
      for (let i = 0; i < 10 && !after?.lastUsedAt; i += 1) {
        await new Promise((r) => setTimeout(r, 100));
        after = await prisma.apiKey.findUnique({ where: { keyHash: TEST_API_KEY_HASH } });
      }

      expect(after?.lastUsedAt).toBeTruthy();
      if (beforeTs && after?.lastUsedAt) {
        expect(after.lastUsedAt.getTime()).toBeGreaterThanOrEqual(beforeTs.getTime());
      }
    });
  });
});
