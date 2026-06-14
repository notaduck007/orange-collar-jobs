/**
 * Phase 1 backwards-compatibility — must pass after every subsequent phase.
 * Registry: docs/agent/standards/common/backwards-compatibility.md
 */
import request from "supertest";
import { AppModule } from "../../src/app.module.js";
import { createTestApp, type TestApp } from "../helpers/create-test-app.js";

describe("Phase 1 backwards compatibility (E2E)", () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp(AppModule, 60_000);
  }, 70_000);

  afterAll(async () => {
    await testApp.close();
  });

  it("GET /api/health → 200 with dependency indicators", async () => {
    const res = await request(testApp.app.getHttpServer()).get("/api/health").expect(200);

    expect(res.body).toMatchObject({
      status: "ok",
      info: expect.objectContaining({
        db: expect.objectContaining({ status: "up" }),
        redis: expect.objectContaining({ status: "up" }),
        storage: expect.objectContaining({ status: "up" }),
      }),
    });
  });

  it("GET /api/v1/me without token → 401", async () => {
    await request(testApp.app.getHttpServer()).get("/api/v1/me").expect(401);
  });

  it("GET /api/v1/health → 404 (health is version-neutral only)", async () => {
    await request(testApp.app.getHttpServer()).get("/api/v1/health").expect(404);
  });

  it("GET /api/me → 404 (me requires v1 prefix)", async () => {
    await request(testApp.app.getHttpServer()).get("/api/me").expect(404);
  });
});
