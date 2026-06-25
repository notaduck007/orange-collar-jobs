/**
 * E2E tests for jobs endpoints — OpenAPI contract: docs/api/openapi.yaml (Jobs section)
 */
import request from "supertest";
import { AppModule } from "../../src/app.module.js";
import { PrismaService } from "../../src/core/database/prisma.service.js";
import {
  cleanupJobsTestData,
  createTestAdmin,
  createTestVendorWithPackage,
  JOB_CREATE_BODY,
} from "../helpers/jobs.fixtures.js";
import { createTestApp, signTestToken, type TestApp } from "../helpers/create-test-app.js";

const ADMIN_EMAIL = "e2e-jobs-admin@test.com";
const VENDOR_EMAIL = "e2e-jobs-vendor@test.com";

describe("Jobs endpoints (E2E)", () => {
  let testApp: TestApp;
  let prisma: PrismaService;
  let adminToken: string;
  let vendorToken: string;
  let companyId: string;
  let packageId: string;

  beforeAll(async () => {
    testApp = await createTestApp(AppModule, 60_000);
    prisma = testApp.app.get(PrismaService);
  }, 70_000);

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    await cleanupJobsTestData(prisma, [ADMIN_EMAIL, VENDOR_EMAIL]);

    const admin = await createTestAdmin(prisma, ADMIN_EMAIL);
    adminToken = signTestToken(testApp.app, {
      sub: admin.id,
      email: admin.email,
      role: "admin",
    });

    const vendor = await createTestVendorWithPackage(prisma, VENDOR_EMAIL);
    companyId = vendor.company.id;
    packageId = vendor.package.id;
    vendorToken = signTestToken(testApp.app, {
      sub: vendor.user.id,
      email: vendor.user.email,
      role: "vendor",
    });
  });

  it("GET /api/v1/jobs → 200 empty listing", async () => {
    const res = await request(testApp.app.getHttpServer()).get("/api/v1/jobs").expect(200);
    expect(res.body).toMatchObject({
      data: expect.any(Array),
      meta: expect.objectContaining({ page: 1 }),
    });
  });

  it("POST /api/v1/jobs as admin → 201", async () => {
    const res = await request(testApp.app.getHttpServer())
      .post("/api/v1/jobs")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ...JOB_CREATE_BODY, companyId })
      .expect(201);

    expect(res.body).toMatchObject({
      id: expect.any(String),
      slug: expect.stringContaining("dallas"),
      status: "published",
      companyId,
    });
  });

  it("POST /api/v1/jobs as vendor with package → 201 and decrements credit", async () => {
    await request(testApp.app.getHttpServer())
      .post("/api/v1/jobs")
      .set("Authorization", `Bearer ${vendorToken}`)
      .send({ ...JOB_CREATE_BODY, companyPackageId: packageId })
      .expect(201);

    const pkg = await prisma.companyPackage.findUnique({ where: { id: packageId } });
    expect(pkg?.usedCredits).toBe(1);
  });

  it("GET /api/v1/jobs/:slug increments views", async () => {
    const created = await request(testApp.app.getHttpServer())
      .post("/api/v1/jobs")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ...JOB_CREATE_BODY, companyId, status: "published" })
      .expect(201);

    const slug = created.body.slug as string;
    const detail = await request(testApp.app.getHttpServer())
      .get(`/api/v1/jobs/${slug}`)
      .expect(200);

    expect(detail.body.views).toBeGreaterThanOrEqual(1);
    expect(detail.body.screeningQuestions).toEqual([]);
  });

  it("PATCH /api/v1/jobs/:id and DELETE close job", async () => {
    const created = await request(testApp.app.getHttpServer())
      .post("/api/v1/jobs")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ...JOB_CREATE_BODY, companyId })
      .expect(201);

    const id = created.body.id as string;

    await request(testApp.app.getHttpServer())
      .patch(`/api/v1/jobs/${id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ featured: true })
      .expect(200)
      .expect((res) => {
        expect(res.body.featured).toBe(true);
      });

    await request(testApp.app.getHttpServer())
      .delete(`/api/v1/jobs/${id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(204);

    const job = await prisma.job.findUnique({ where: { id } });
    expect(job?.status).toBe("closed");
  });

  it("POST /api/v1/jobs as seeker → 403", async () => {
    const seeker = await prisma.user.create({
      data: {
        email: "seeker-jobs@test.com",
        passwordHash: "hash",
        role: "seeker",
        emailVerifiedAt: new Date(),
      },
    });
    const seekerToken = signTestToken(testApp.app, {
      sub: seeker.id,
      email: seeker.email,
      role: "seeker",
    });

    await request(testApp.app.getHttpServer())
      .post("/api/v1/jobs")
      .set("Authorization", `Bearer ${seekerToken}`)
      .send({ ...JOB_CREATE_BODY, companyId })
      .expect(403);

    await prisma.user.delete({ where: { id: seeker.id } });
  });

  it("GET /api/v1/admin/jobs as admin → 200 with draft and published", async () => {
    await request(testApp.app.getHttpServer())
      .post("/api/v1/jobs")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ...JOB_CREATE_BODY, companyId, status: "draft" })
      .expect(201);

    await request(testApp.app.getHttpServer())
      .post("/api/v1/jobs")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ...JOB_CREATE_BODY, companyId, status: "published" })
      .expect(201);

    const res = await request(testApp.app.getHttpServer())
      .get("/api/v1/admin/jobs")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    expect(res.body.meta).toMatchObject({ page: 1, total: expect.any(Number) });
    const statuses = res.body.data.map((j: { status: string }) => j.status);
    expect(statuses).toEqual(expect.arrayContaining(["draft", "published"]));
  });

  it("GET /api/v1/admin/jobs as vendor → 403", async () => {
    await request(testApp.app.getHttpServer())
      .get("/api/v1/admin/jobs")
      .set("Authorization", `Bearer ${vendorToken}`)
      .expect(403);
  });

  it("PATCH /api/v1/admin/jobs/:id/feature toggles featured", async () => {
    const created = await request(testApp.app.getHttpServer())
      .post("/api/v1/jobs")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ...JOB_CREATE_BODY, companyId })
      .expect(201);

    const id = created.body.id as string;

    await request(testApp.app.getHttpServer())
      .patch(`/api/v1/admin/jobs/${id}/feature`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ featured: true, featuredUntil: "2026-12-01T00:00:00.000Z" })
      .expect(200)
      .expect((res) => {
        expect(res.body.featured).toBe(true);
        expect(res.body.featuredUntil).toBeTruthy();
      });
  });

  it("GET /api/v1/jobs/mine as vendor returns all statuses for company", async () => {
    await request(testApp.app.getHttpServer())
      .post("/api/v1/jobs")
      .set("Authorization", `Bearer ${vendorToken}`)
      .send({ ...JOB_CREATE_BODY, companyPackageId: packageId, status: "draft" })
      .expect(201);

    await request(testApp.app.getHttpServer())
      .post("/api/v1/jobs")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ...JOB_CREATE_BODY, companyId, status: "published" })
      .expect(201);

    const res = await request(testApp.app.getHttpServer())
      .get("/api/v1/jobs/mine")
      .set("Authorization", `Bearer ${vendorToken}`)
      .expect(200);

    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.every((j: { companyId: string }) => j.companyId === companyId)).toBe(true);
    expect(res.body.data.some((j: { status: string }) => j.status === "draft")).toBe(true);
  });

  it("GET /api/v1/jobs/mine as seeker → 403", async () => {
    const seeker = await prisma.user.create({
      data: {
        email: "seeker-mine@test.com",
        passwordHash: "hash",
        role: "seeker",
        emailVerifiedAt: new Date(),
      },
    });
    const seekerToken = signTestToken(testApp.app, {
      sub: seeker.id,
      email: seeker.email,
      role: "seeker",
    });

    await request(testApp.app.getHttpServer())
      .get("/api/v1/jobs/mine")
      .set("Authorization", `Bearer ${seekerToken}`)
      .expect(403);

    await prisma.user.delete({ where: { id: seeker.id } });
  });
});
