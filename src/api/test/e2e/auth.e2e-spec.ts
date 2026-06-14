/**
 * E2E tests for auth endpoints — OpenAPI contract: docs/api/openapi.yaml (Auth section)
 */
import request from "supertest";
import { AppModule } from "../../src/app.module.js";
import { PrismaService } from "../../src/core/database/prisma.service.js";
import { createTestApp, type TestApp } from "../helpers/create-test-app.js";

const REGISTER_BODY = {
  email: "e2e-auth@warehousejobs.test",
  password: "SecureP@ss1",
  role: "seeker" as const,
  fullName: "E2E User",
};

describe("Auth endpoints (E2E)", () => {
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
    await prisma.refreshToken.deleteMany();
    await prisma.emailVerification.deleteMany();
    await prisma.passwordReset.deleteMany();
    await prisma.user.deleteMany({ where: { email: REGISTER_BODY.email } });
  });

  it("POST /api/v1/auth/register → 201", async () => {
    const res = await request(testApp.app.getHttpServer())
      .post("/api/v1/auth/register")
      .send(REGISTER_BODY)
      .expect(201);

    expect(res.body).toMatchObject({
      message: expect.stringContaining("created"),
      userId: expect.any(String),
    });
  });

  it("POST /api/v1/auth/register duplicate → 409", async () => {
    await request(testApp.app.getHttpServer())
      .post("/api/v1/auth/register")
      .send(REGISTER_BODY)
      .expect(201);

    await request(testApp.app.getHttpServer())
      .post("/api/v1/auth/register")
      .send(REGISTER_BODY)
      .expect(409);
  });

  it("POST /api/v1/auth/login wrong password → 401", async () => {
    await request(testApp.app.getHttpServer())
      .post("/api/v1/auth/register")
      .send(REGISTER_BODY)
      .expect(201);

    const verification = await prisma.emailVerification.findFirst({
      where: { user: { email: REGISTER_BODY.email } },
    });
    const verifyToken = verification?.token;
    if (!verifyToken) throw new Error("expected verification token");

    await request(testApp.app.getHttpServer())
      .post("/api/v1/auth/verify-email")
      .send({ token: verifyToken })
      .expect(200);

    await request(testApp.app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: REGISTER_BODY.email, password: "WrongPass1!" })
      .expect(401);
  });

  it("POST /api/v1/auth/login unverified → 401", async () => {
    await request(testApp.app.getHttpServer())
      .post("/api/v1/auth/register")
      .send(REGISTER_BODY)
      .expect(201);

    const res = await request(testApp.app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: REGISTER_BODY.email, password: REGISTER_BODY.password })
      .expect(401);

    expect(res.body).toMatchObject({ message: expect.stringContaining("Email not confirmed") });
  });

  it("register → verify → login → refresh → logout flow", async () => {
    await request(testApp.app.getHttpServer())
      .post("/api/v1/auth/register")
      .send(REGISTER_BODY)
      .expect(201);

    const verification = await prisma.emailVerification.findFirst({
      where: { user: { email: REGISTER_BODY.email } },
    });
    expect(verification?.token).toBeDefined();
    const verifyToken = verification?.token;
    if (!verifyToken) throw new Error("expected verification token");

    await request(testApp.app.getHttpServer())
      .post("/api/v1/auth/verify-email")
      .send({ token: verifyToken })
      .expect(200);

    const loginRes = await request(testApp.app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: REGISTER_BODY.email, password: REGISTER_BODY.password })
      .expect(200);

    const { accessToken, refreshToken } = loginRes.body as {
      accessToken: string;
      refreshToken: string;
    };
    expect(accessToken).toBeDefined();
    expect(refreshToken).toBeDefined();

    await request(testApp.app.getHttpServer())
      .get("/api/v1/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    const refreshRes = await request(testApp.app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken })
      .expect(200);

    const newRefresh = (refreshRes.body as { refreshToken: string }).refreshToken;

    await request(testApp.app.getHttpServer())
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${(refreshRes.body as { accessToken: string }).accessToken}`)
      .expect(204);

    await request(testApp.app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: newRefresh })
      .expect(401);
  });

  it("POST /api/v1/auth/forgot-password always → 200", async () => {
    await request(testApp.app.getHttpServer())
      .post("/api/v1/auth/forgot-password")
      .send({ email: "nobody@warehousejobs.test" })
      .expect(200);
  });

  it("POST /api/v1/auth/reset-password invalid token → 400", async () => {
    await request(testApp.app.getHttpServer())
      .post("/api/v1/auth/reset-password")
      .send({ token: "invalid-token", password: "NewSecure1!" })
      .expect(400);
  });

  it("forgot-password → reset-password → login with new password", async () => {
    await request(testApp.app.getHttpServer())
      .post("/api/v1/auth/register")
      .send(REGISTER_BODY)
      .expect(201);

    const verification = await prisma.emailVerification.findFirst({
      where: { user: { email: REGISTER_BODY.email } },
    });
    const verifyToken = verification?.token;
    if (!verifyToken) throw new Error("expected verification token");

    await request(testApp.app.getHttpServer())
      .post("/api/v1/auth/verify-email")
      .send({ token: verifyToken })
      .expect(200);

    await request(testApp.app.getHttpServer())
      .post("/api/v1/auth/forgot-password")
      .send({ email: REGISTER_BODY.email })
      .expect(200);

    const reset = await prisma.passwordReset.findFirst({
      where: { user: { email: REGISTER_BODY.email } },
      orderBy: { createdAt: "desc" },
    });
    const resetToken = reset?.token;
    if (!resetToken) throw new Error("expected reset token");

    await request(testApp.app.getHttpServer())
      .post("/api/v1/auth/reset-password")
      .send({ token: resetToken, password: "NewSecure2!" })
      .expect(200);

    await request(testApp.app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: REGISTER_BODY.email, password: "NewSecure2!" })
      .expect(200);
  });

  it("GET /api/v1/me without token → 401", async () => {
    await request(testApp.app.getHttpServer()).get("/api/v1/me").expect(401);
  });
});
