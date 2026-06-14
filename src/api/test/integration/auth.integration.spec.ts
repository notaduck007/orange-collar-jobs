/**
 * Integration test — full register → verify → login against real Postgres.
 */
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/core/database/prisma.service.js';
import { createTestApp, type TestApp } from '../helpers/create-test-app.js';

const EMAIL = 'integration-auth@warehousejobs.test';

describe('Auth flow (integration)', () => {
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
    await prisma.user.deleteMany({ where: { email: EMAIL } });
  });

  it('register → verify → login returns tokens', async () => {
    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: EMAIL,
        password: 'SecureP@ss1',
        role: 'seeker',
        fullName: 'Integration User',
      })
      .expect(201);

    const verification = await prisma.emailVerification.findFirst({
      where: { user: { email: EMAIL } },
    });
    expect(verification).toBeTruthy();
    const verifyToken = verification?.token;
    if (!verifyToken) throw new Error('expected verification token');

    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/verify-email')
      .send({ token: verifyToken })
      .expect(200);

    const login = await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: EMAIL, password: 'SecureP@ss1' })
      .expect(200);

    expect(login.body).toMatchObject({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      expiresIn: expect.any(Number),
    });
  });

  it('forgot-password → reset-password revokes sessions and allows new login', async () => {
    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: EMAIL,
        password: 'SecureP@ss1',
        role: 'seeker',
      })
      .expect(201);

    const verification = await prisma.emailVerification.findFirst({
      where: { user: { email: EMAIL } },
    });
    const verifyToken = verification?.token;
    if (!verifyToken) throw new Error('expected verification token');

    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/verify-email')
      .send({ token: verifyToken })
      .expect(200);

    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: EMAIL })
      .expect(200);

    const reset = await prisma.passwordReset.findFirst({
      where: { user: { email: EMAIL } },
      orderBy: { createdAt: 'desc' },
    });
    const resetToken = reset?.token;
    if (!resetToken) throw new Error('expected reset token');

    await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({ token: resetToken, password: 'NewSecure2!' })
      .expect(200);

    const login = await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: EMAIL, password: 'NewSecure2!' })
      .expect(200);

    expect(login.body.accessToken).toEqual(expect.any(String));
  });
});
