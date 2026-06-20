/**
 * Integration test — jobs create → search → detail → update → close
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

const ADMIN_EMAIL = "integration-jobs-admin@test.com";
const VENDOR_EMAIL = "integration-jobs-vendor@test.com";

describe("Jobs flow (integration)", () => {
  let testApp: TestApp;
  let prisma: PrismaService;

  beforeAll(async () => {
    testApp = await createTestApp(AppModule, 60_000);
    prisma = testApp.app.get(PrismaService);
  }, 70_000);

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    await cleanupJobsTestData(prisma, [ADMIN_EMAIL, VENDOR_EMAIL]);
  });

  it("vendor posts draft, admin publishes scraped vs direct search order", async () => {
    const admin = await createTestAdmin(prisma, ADMIN_EMAIL);
    const vendor = await createTestVendorWithPackage(prisma, VENDOR_EMAIL);
    const adminToken = signTestToken(testApp.app, {
      sub: admin.id,
      email: admin.email,
      role: "admin",
    });
    const vendorToken = signTestToken(testApp.app, {
      sub: vendor.user.id,
      email: vendor.user.email,
      role: "vendor",
    });

    await request(testApp.app.getHttpServer())
      .post("/api/v1/jobs")
      .set("Authorization", `Bearer ${vendorToken}`)
      .send({
        ...JOB_CREATE_BODY,
        companyPackageId: vendor.package.id,
        status: "published",
      })
      .expect(201);

    await prisma.job.create({
      data: {
        title: "Scraped Listing Job",
        slug: "scraped-listing-job-dallas-tx",
        category: "General",
        categorySlug: "general",
        companyId: vendor.company.id,
        location: "Dallas, TX",
        city: "Dallas",
        state: "TX",
        employmentType: "full_time",
        shift: "first",
        description: "Scraped job description long enough for validation rules here.",
        status: "published",
        sourceType: "scraped",
        postedAt: new Date(),
      },
    });

    const search = await request(testApp.app.getHttpServer()).get("/api/v1/jobs").expect(200);

    expect(search.body.data.length).toBeGreaterThanOrEqual(2);
    expect(search.body.data[0].sourceType).toBe("direct");

    const created = search.body.data.find((j: { sourceType: string }) => j.sourceType === "direct");
    expect(created).toBeTruthy();

    await request(testApp.app.getHttpServer())
      .patch(`/api/v1/jobs/${created.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ featured: true })
      .expect(200);

    await request(testApp.app.getHttpServer())
      .delete(`/api/v1/jobs/${created.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(204);
  });
});
