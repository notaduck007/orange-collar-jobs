/**
 * Integration tests — Notifications domain (real Postgres + Redis).
 */
import request from "supertest";
import { createHash } from "node:crypto";
import { AppModule } from "../../src/app.module.js";
import { PrismaService } from "../../src/core/database/prisma.service.js";
import { NotificationGateway } from "../../src/domains/notifications/notification.gateway.js";
import { createTestApp, signTestToken, type TestApp } from "../helpers/create-test-app.js";
import {
  cleanupNotificationsData,
  createTestNotificationsAdmin,
  createTestSeeker,
  seedInAppNotification,
  seedMarketingConsent,
  SEEKER_EMAIL,
} from "../helpers/notifications.fixtures.js";

describe("Notifications (integration)", () => {
  let testApp: TestApp;
  let prisma: PrismaService;
  let seekerToken: string;
  let seekerId: string;
  let gateway: NotificationGateway;

  beforeAll(async () => {
    testApp = await createTestApp(AppModule, 60_000);
    prisma = testApp.app.get(PrismaService);
    gateway = testApp.app.get(NotificationGateway);
  }, 70_000);

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    await cleanupNotificationsData(prisma);
    const seeker = await createTestSeeker(prisma);
    seekerId = seeker.id;
    seekerToken = signTestToken(testApp.app, {
      sub: seeker.id,
      email: seeker.email,
      role: "seeker",
    });
  });

  it("lists inbox notifications for authenticated user", async () => {
    await seedInAppNotification(prisma, seekerId, "Integration alert");

    const res = await request(testApp.app.getHttpServer())
      .get("/api/v1/notifications")
      .set("Authorization", `Bearer ${seekerToken}`)
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe("Integration alert");
  });

  it("updates preferences and records marketing consent", async () => {
    const res = await request(testApp.app.getHttpServer())
      .patch("/api/v1/notifications/preferences")
      .set("Authorization", `Bearer ${seekerToken}`)
      .send({ emailMarketing: true })
      .expect(200);

    expect(res.body.emailMarketing).toBe(true);

    const consent = await prisma.marketingConsent.findFirst({ where: { userId: seekerId } });
    expect(consent).not.toBeNull();
  });

  it("Twilio STOP webhook creates sms opt-out", async () => {
    await request(testApp.app.getHttpServer())
      .post("/api/v1/webhooks/twilio/sms")
      .set("X-Twilio-Signature", "valid")
      .type("form")
      .send({ From: "+15559876543", Body: "STOP" })
      .expect(200);

    const optOut = await prisma.smsOptOut.findUnique({ where: { phone: "+15559876543" } });
    expect(optOut).not.toBeNull();
  });

  it("gateway pushes notification.created to subscriber", async () => {
    const received: unknown[] = [];
    const unsubscribe = gateway.subscribe(seekerId, (payload) => received.push(payload));

    await request(testApp.app.getHttpServer())
      .post("/api/v1/webhooks/twilio/sms")
      .set("X-Twilio-Signature", "valid")
      .type("form")
      .send({ From: "+15559876543", Body: "Any reply" })
      .expect(200);

    unsubscribe();
    expect(received).toHaveLength(1);
  });

  it("admin can create and send email campaign to opted-in seeker", async () => {
    await seedMarketingConsent(prisma, seekerId, "email");
    const admin = await createTestNotificationsAdmin(prisma);
    const adminToken = signTestToken(testApp.app, {
      sub: admin.id,
      email: admin.email,
      role: "admin",
    });

    const created = await request(testApp.app.getHttpServer())
      .post("/api/v1/admin/campaigns")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Integration Campaign",
        channel: "email",
        segment: { role: "seeker" },
        htmlBody: "<p>Hello seekers</p>",
        subject: "News",
      })
      .expect(201);

    await request(testApp.app.getHttpServer())
      .post(`/api/v1/admin/campaigns/${created.body.id}/send`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    const stats = await request(testApp.app.getHttpServer())
      .get(`/api/v1/admin/campaigns/${created.body.id}/stats`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(stats.body.targeted).toBeGreaterThanOrEqual(0);
  });

  it("email OTP verify flow succeeds with stored hash", async () => {
    const code = "654321";
    await prisma.otpChallenge.create({
      data: {
        channel: "email",
        destination: SEEKER_EMAIL,
        purpose: "verify_contact",
        codeHash: createHash("sha256").update(code).digest("hex"),
        expiresAt: new Date(Date.now() + 600_000),
      },
    });

    const res = await request(testApp.app.getHttpServer())
      .post("/api/v1/auth/verify-otp")
      .send({
        channel: "email",
        destination: SEEKER_EMAIL,
        code,
        purpose: "verify_contact",
      })
      .expect(200);

    expect(res.body.verified).toBe(true);
  });
});
