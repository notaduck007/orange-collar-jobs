/**
 * E2E tests — Notifications REST surface + Phase 1 backwards compat smoke.
 */
import request from "supertest";
import { createHash } from "node:crypto";
import { AppModule } from "../../src/app.module.js";
import { PrismaService } from "../../src/core/database/prisma.service.js";
import { createTestApp, signTestToken, type TestApp } from "../helpers/create-test-app.js";
import {
  cleanupNotificationsData,
  createTestSeeker,
  seedInAppNotification,
  SEEKER_EMAIL,
} from "../helpers/notifications.fixtures.js";

describe("Notifications (E2E)", () => {
  let testApp: TestApp;
  let prisma: PrismaService;
  let token: string;
  let userId: string;

  beforeAll(async () => {
    testApp = await createTestApp(AppModule, 60_000);
    prisma = testApp.app.get(PrismaService);
  }, 70_000);

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    await cleanupNotificationsData(prisma);
    const user = await createTestSeeker(prisma);
    userId = user.id;
    token = signTestToken(testApp.app, { sub: user.id, email: user.email, role: "seeker" });
  });

  it("GET /api/v1/notifications without token → 401", async () => {
    await request(testApp.app.getHttpServer()).get("/api/v1/notifications").expect(401);
  });

  it("PATCH mark read and POST read-all", async () => {
    const { id } = await seedInAppNotification(prisma, userId);
    await seedInAppNotification(prisma, userId, "Second");

    const read = await request(testApp.app.getHttpServer())
      .patch(`/api/v1/notifications/${id}/read`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(read.body.read).toBe(true);

    const all = await request(testApp.app.getHttpServer())
      .post("/api/v1/notifications/read-all")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(all.body.updated).toBeGreaterThanOrEqual(1);
  });

  it("GET/PATCH preferences round-trip", async () => {
    const get = await request(testApp.app.getHttpServer())
      .get("/api/v1/notifications/preferences")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(get.body.inApp).toBe(true);

    await request(testApp.app.getHttpServer())
      .patch("/api/v1/notifications/preferences")
      .set("Authorization", `Bearer ${token}`)
      .send({ smsMarketing: true, emailMarketing: true })
      .expect(200);
  });

  it("POST /api/v1/auth/send-otp returns message without code", async () => {
    const res = await request(testApp.app.getHttpServer())
      .post("/api/v1/auth/send-otp")
      .send({ channel: "email", destination: SEEKER_EMAIL, purpose: "verify_contact" })
      .expect(200);

    expect(res.body.message).toBeDefined();
    expect(JSON.stringify(res.body)).not.toMatch(/\d{6}/);
  });

  it("POST /api/v1/webhooks/twilio/sms invalid signature → 403", async () => {
    await request(testApp.app.getHttpServer())
      .post("/api/v1/webhooks/twilio/sms")
      .set("X-Twilio-Signature", "invalid")
      .type("form")
      .send({ From: "+15559876543", Body: "STOP" })
      .expect(403);
  });

  it("verify-otp with seeded challenge", async () => {
    const code = "112233";
    await prisma.otpChallenge.create({
      data: {
        channel: "email",
        destination: SEEKER_EMAIL,
        purpose: "verify_contact",
        codeHash: createHash("sha256").update(code).digest("hex"),
        expiresAt: new Date(Date.now() + 600_000),
      },
    });

    await request(testApp.app.getHttpServer())
      .post("/api/v1/auth/verify-otp")
      .send({ channel: "email", destination: SEEKER_EMAIL, code, purpose: "verify_contact" })
      .expect(200);
  });

  it("Phase 1 GET /api/health still returns 200", async () => {
    await request(testApp.app.getHttpServer()).get("/api/health").expect(200);
  });
});
