jest.mock("bcryptjs", () => ({
  hash: jest.fn().mockResolvedValue("$2a$12$hashed"),
  compare: jest.fn(),
}));

import * as bcrypt from "bcryptjs";
import type { ConfigService } from "@nestjs/config";
import type { JwtService } from "@nestjs/jwt";
import type { User } from "../../../../src/core/database/prisma-client.js";
import { AuthService } from "@domains/auth/auth.service";
import type { PrismaService } from "@core/database/prisma.service";
import type { EmailService } from "@core/email/email.service";
import {
  BadRequestError,
  ConflictError,
  InvalidCredentialsError,
  UnauthorizedError,
} from "@core/error/errors";

const baseUser: User = {
  id: "user-1",
  email: "jane@example.com",
  passwordHash: "$2a$12$hashed",
  role: "seeker",
  fullName: "Jane",
  phone: null,
  emailVerifiedAt: new Date(),
  migrationSource: null,
  requiresReset: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeConfig(): ConfigService {
  return {
    get: jest.fn((key: string) => {
      if (key === "CORS_ORIGIN") return "http://localhost:8080";
      if (key === "JWT_ACCESS_EXPIRES_IN") return "15m";
      if (key === "JWT_REFRESH_EXPIRES_IN") return "30d";
      return undefined;
    }),
  } as unknown as ConfigService;
}

function makePrisma(): PrismaService {
  return {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    emailVerification: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    passwordReset: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  } as unknown as PrismaService;
}

function makeJwt(): JwtService {
  return {
    sign: jest.fn().mockReturnValue("access-token"),
    decode: jest.fn().mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 900 }),
  } as unknown as JwtService;
}

function makeEmail(): EmailService {
  return {
    sendWelcomeEmail: jest.fn(),
    sendVerificationEmail: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
  } as unknown as EmailService;
}

function makeSms(): import("@core/sms/sms.service").SmsService {
  return {
    sendTransactional: jest.fn(),
  } as unknown as import("@core/sms/sms.service").SmsService;
}

describe("AuthService", () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwt: JwtService;
  let email: EmailService;
  let sms: import("@core/sms/sms.service").SmsService;

  beforeEach(() => {
    prisma = makePrisma();
    jwt = makeJwt();
    email = makeEmail();
    sms = makeSms();
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    service = new AuthService(prisma, jwt, makeConfig(), email, sms);
  });

  afterEach(() => jest.clearAllMocks());

  describe("register", () => {
    it("creates user and sends verification email", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({ ...baseUser, emailVerifiedAt: null });
      (prisma.emailVerification.create as jest.Mock).mockResolvedValue({
        id: "ev-1",
        userId: baseUser.id,
        token: "tok",
        expiresAt: new Date(),
        usedAt: null,
        createdAt: new Date(),
      });

      const result = await service.register({
        email: "jane@example.com",
        password: "SecureP@ss1",
        role: "seeker",
        fullName: "Jane",
      });

      expect(result.userId).toBe(baseUser.id);
      expect(email.sendWelcomeEmail).toHaveBeenCalled();
      expect(email.sendVerificationEmail).toHaveBeenCalled();
    });

    it("creates user without fullName when omitted", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({ ...baseUser, emailVerifiedAt: null });
      (prisma.emailVerification.create as jest.Mock).mockResolvedValue({
        id: "ev-1",
        userId: baseUser.id,
        token: "tok",
        expiresAt: new Date(),
        usedAt: null,
        createdAt: new Date(),
      });

      await service.register({
        email: "jane@example.com",
        password: "SecureP@ss1",
        role: "seeker",
      });

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ fullName: null }),
        }),
      );
    });

    it("uses default CORS origin when config omits CORS_ORIGIN", async () => {
      const bareConfig = {
        get: jest.fn((key: string) => {
          if (key === "JWT_ACCESS_EXPIRES_IN") return "15m";
          if (key === "JWT_REFRESH_EXPIRES_IN") return "30d";
          return undefined;
        }),
      } as unknown as ConfigService;
      service = new AuthService(prisma, jwt, bareConfig, email, sms);

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({ ...baseUser, emailVerifiedAt: null });
      (prisma.emailVerification.create as jest.Mock).mockResolvedValue({
        id: "ev-1",
        userId: baseUser.id,
        token: "tok",
        expiresAt: new Date(),
        usedAt: null,
        createdAt: new Date(),
      });

      await service.register({
        email: "jane@example.com",
        password: "SecureP@ss1",
        role: "seeker",
        fullName: "Jane",
      });

      expect(email.sendVerificationEmail).toHaveBeenCalledWith(
        "jane@example.com",
        expect.any(String),
        "http://localhost:5173",
      );
    });

    it("throws ConflictError for duplicate email", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(baseUser);
      await expect(
        service.register({
          email: "jane@example.com",
          password: "SecureP@ss1",
          role: "seeker",
        }),
      ).rejects.toThrow(ConflictError);
    });
  });

  describe("login", () => {
    it("returns tokens for valid verified credentials", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(baseUser);
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({
        id: "rt-1",
        userId: baseUser.id,
        tokenHash: "hash",
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
        createdAt: new Date(),
      });

      const result = await service.login({
        email: "jane@example.com",
        password: "SecureP@ss1",
      });

      expect(result.accessToken).toBe("access-token");
      expect(result.refreshToken).toBeDefined();
    });

    it("derives expiresIn from JWT_ACCESS_EXPIRES_IN when decode has no exp", async () => {
      (jwt.decode as jest.Mock).mockReturnValue(null);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(baseUser);
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({
        id: "rt-1",
        userId: baseUser.id,
        tokenHash: "hash",
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
        createdAt: new Date(),
      });

      const result = await service.login({
        email: "jane@example.com",
        password: "SecureP@ss1",
      });

      expect(result.expiresIn).toBe(15 * 60_000);
    });

    it("parses refresh TTL units when issuing tokens", async () => {
      const ttlConfig = {
        get: jest.fn((key: string) => {
          if (key === "CORS_ORIGIN") return "http://localhost:8080";
          if (key === "JWT_ACCESS_EXPIRES_IN") return "1s";
          if (key === "JWT_REFRESH_EXPIRES_IN") return "1h";
          return undefined;
        }),
      } as unknown as ConfigService;
      service = new AuthService(prisma, jwt, ttlConfig, email, sms);
      (jwt.decode as jest.Mock).mockReturnValue(null);

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(baseUser);
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({
        id: "rt-1",
        userId: baseUser.id,
        tokenHash: "hash",
        expiresAt: new Date(Date.now() + 3600000),
        revokedAt: null,
        createdAt: new Date(),
      });

      const result = await service.login({
        email: "jane@example.com",
        password: "SecureP@ss1",
      });

      expect(result.expiresIn).toBe(1000);
      const refreshCreate = (prisma.refreshToken.create as jest.Mock).mock.calls[0][0];
      const expiresAt = refreshCreate.data.expiresAt as Date;
      expect(expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(3_600_000);
      expect(expiresAt.getTime() - Date.now()).toBeGreaterThan(3_500_000);
    });

    it("falls back to default TTL for malformed JWT duration strings", async () => {
      const badTtlConfig = {
        get: jest.fn((key: string) => {
          if (key === "CORS_ORIGIN") return "http://localhost:8080";
          if (key === "JWT_ACCESS_EXPIRES_IN") return "not-a-duration";
          if (key === "JWT_REFRESH_EXPIRES_IN") return "1x";
          return undefined;
        }),
      } as unknown as ConfigService;
      service = new AuthService(prisma, jwt, badTtlConfig, email, sms);
      (jwt.decode as jest.Mock).mockReturnValue(null);

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(baseUser);
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({
        id: "rt-1",
        userId: baseUser.id,
        tokenHash: "hash",
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
        createdAt: new Date(),
      });

      const result = await service.login({
        email: "jane@example.com",
        password: "SecureP@ss1",
      });

      expect(result.expiresIn).toBe(30 * 24 * 60 * 60 * 1000);
    });

    it("throws InvalidCredentialsError when user not found", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(
        service.login({ email: "ghost@example.com", password: "SecureP@ss1" }),
      ).rejects.toThrow(InvalidCredentialsError);
    });

    it("throws InvalidCredentialsError when password is wrong", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(baseUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(
        service.login({ email: "jane@example.com", password: "WrongPass1" }),
      ).rejects.toThrow(InvalidCredentialsError);
    });

    it("throws UnauthorizedError when email not verified", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...baseUser,
        emailVerifiedAt: null,
      });
      await expect(
        service.login({ email: "jane@example.com", password: "SecureP@ss1" }),
      ).rejects.toThrow(UnauthorizedError);
    });
  });

  describe("refreshTokens", () => {
    it("rotates refresh token and issues new pair", async () => {
      (prisma.refreshToken.findFirst as jest.Mock).mockResolvedValue({
        id: "rt-1",
        userId: baseUser.id,
        tokenHash: "hash",
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
        createdAt: new Date(),
        user: baseUser,
      });
      (prisma.refreshToken.update as jest.Mock).mockResolvedValue({
        id: "rt-1",
        userId: baseUser.id,
        tokenHash: "hash",
        expiresAt: new Date(),
        revokedAt: new Date(),
        createdAt: new Date(),
      });
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({
        id: "rt-2",
        userId: baseUser.id,
        tokenHash: "hash2",
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
        createdAt: new Date(),
      });

      const result = await service.refreshTokens("opaque-refresh");
      expect(result.accessToken).toBe("access-token");
      expect(prisma.refreshToken.update).toHaveBeenCalled();
    });

    it("throws UnauthorizedError for invalid refresh token", async () => {
      (prisma.refreshToken.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.refreshTokens("bad")).rejects.toThrow(UnauthorizedError);
    });

    it("throws UnauthorizedError for expired refresh token", async () => {
      (prisma.refreshToken.findFirst as jest.Mock).mockResolvedValue({
        id: "rt-1",
        userId: baseUser.id,
        tokenHash: "hash",
        expiresAt: new Date(Date.now() - 1000),
        revokedAt: null,
        createdAt: new Date(),
        user: baseUser,
      });
      await expect(service.refreshTokens("opaque-refresh")).rejects.toThrow(UnauthorizedError);
    });
  });

  describe("verifyEmail", () => {
    it("marks email verified for valid token", async () => {
      (prisma.emailVerification.findUnique as jest.Mock).mockResolvedValue({
        id: "ev-1",
        userId: baseUser.id,
        token: "tok",
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: null,
        createdAt: new Date(),
        user: baseUser,
      });
      (prisma.user.update as jest.Mock).mockResolvedValue(baseUser);
      (prisma.emailVerification.update as jest.Mock).mockResolvedValue({
        id: "ev-1",
        usedAt: new Date(),
      });

      const result = await service.verifyEmail("tok");
      expect(result.message).toContain("verified");
    });

    it("throws BadRequestError for expired token", async () => {
      (prisma.emailVerification.findUnique as jest.Mock).mockResolvedValue({
        id: "ev-1",
        userId: baseUser.id,
        token: "tok",
        expiresAt: new Date(Date.now() - 1000),
        usedAt: null,
        createdAt: new Date(),
        user: baseUser,
      });
      await expect(service.verifyEmail("tok")).rejects.toThrow(BadRequestError);
    });

    it("throws BadRequestError when token already used", async () => {
      (prisma.emailVerification.findUnique as jest.Mock).mockResolvedValue({
        id: "ev-1",
        userId: baseUser.id,
        token: "tok",
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: new Date(),
        createdAt: new Date(),
        user: baseUser,
      });
      await expect(service.verifyEmail("tok")).rejects.toThrow(BadRequestError);
    });
  });

  describe("forgotPassword", () => {
    it("always returns success message", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      const result = await service.forgotPassword("unknown@example.com");
      expect(result.message).toContain("If that email");
    });

    it("sends email when user exists", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(baseUser);
      (prisma.passwordReset.create as jest.Mock).mockResolvedValue({
        id: "pr-1",
        userId: baseUser.id,
        token: "reset-tok",
        expiresAt: new Date(),
        usedAt: null,
        createdAt: new Date(),
      });
      await service.forgotPassword("jane@example.com");
      expect(email.sendPasswordResetEmail).toHaveBeenCalled();
    });

    it("sends SMS when user has a phone number", async () => {
      const userWithPhone = { ...baseUser, phone: "+15551234567" };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(userWithPhone);
      (prisma.passwordReset.create as jest.Mock).mockResolvedValue({
        id: "pr-1",
        userId: userWithPhone.id,
        token: "reset-tok",
        expiresAt: new Date(),
        usedAt: null,
        createdAt: new Date(),
      });
      await service.forgotPassword("jane@example.com");
      expect(sms.sendTransactional).toHaveBeenCalledWith(
        "+15551234567",
        expect.stringContaining("Password reset"),
      );
    });

    it("uses default CORS origin for reset email when config omits CORS_ORIGIN", async () => {
      const bareConfig = {
        get: jest.fn(() => undefined),
      } as unknown as ConfigService;
      service = new AuthService(prisma, jwt, bareConfig, email, sms);

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(baseUser);
      (prisma.passwordReset.create as jest.Mock).mockResolvedValue({
        id: "pr-1",
        userId: baseUser.id,
        token: "reset-tok",
        expiresAt: new Date(),
        usedAt: null,
        createdAt: new Date(),
      });

      await service.forgotPassword("jane@example.com");

      expect(email.sendPasswordResetEmail).toHaveBeenCalledWith(
        "jane@example.com",
        expect.any(String),
        "http://localhost:5173",
      );
    });
  });

  describe("resetPassword", () => {
    it("updates password and revokes refresh tokens", async () => {
      (prisma.passwordReset.findUnique as jest.Mock).mockResolvedValue({
        id: "pr-1",
        userId: baseUser.id,
        token: "reset-tok",
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: null,
        createdAt: new Date(),
        user: baseUser,
      });
      (prisma.user.update as jest.Mock).mockResolvedValue(baseUser);
      (prisma.passwordReset.update as jest.Mock).mockResolvedValue({
        id: "pr-1",
        usedAt: new Date(),
      });
      (prisma.refreshToken.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      const result = await service.resetPassword("reset-tok", "NewSecure1!");
      expect(result.message).toContain("Password updated");
    });

    it("throws BadRequestError for expired reset token", async () => {
      (prisma.passwordReset.findUnique as jest.Mock).mockResolvedValue({
        id: "pr-1",
        userId: baseUser.id,
        token: "reset-tok",
        expiresAt: new Date(Date.now() - 1000),
        usedAt: null,
        createdAt: new Date(),
        user: baseUser,
      });
      await expect(service.resetPassword("reset-tok", "NewSecure1!")).rejects.toThrow(
        BadRequestError,
      );
    });
  });

  describe("logout", () => {
    it("revokes active refresh tokens", async () => {
      (prisma.refreshToken.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      await service.logout(baseUser.id);
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: baseUser.id, revokedAt: null } }),
      );
    });
  });
});
