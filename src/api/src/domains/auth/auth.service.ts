import { createHash, randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import type { User } from "../../core/database/prisma-client.js";
import type { Env } from "../../core/config/env.schema.js";
import { PrismaService } from "../../core/database/prisma.service.js";
import { EmailService } from "../../core/email/email.service.js";
import { SmsService } from "../../core/sms/sms.service.js";
import {
  BadRequestError,
  ConflictError,
  InvalidCredentialsError,
  UnauthorizedError,
} from "../../core/error/errors.js";
import type { JwtPayload } from "../../core/auth/jwt.strategy.js";
import type { LoginDto } from "./dto/login.dto.js";
import type { RegisterDto } from "./dto/register.dto.js";
import type { AuthTokensResponse, MessageResponse, RegisterResponse } from "./types.js";

const BCRYPT_ROUNDS = 12;
const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

function parseDurationMs(value: string): number {
  const match = value.match(/^(\d+)([smhd])$/);
  if (!match) return 30 * 24 * 60 * 60 * 1000;
  const n = parseInt(match[1], 10);
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return n * (multipliers[match[2]] ?? 86_400_000);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function generateOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env>,
    private readonly email: EmailService,
    private readonly sms: SmsService,
  ) {}

  async register(dto: RegisterDto): Promise<RegisterResponse> {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictError("Email already registered");
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        role: dto.role,
        fullName: dto.fullName?.trim() ?? null,
      },
    });

    const token = generateOpaqueToken();
    await this.prisma.emailVerification.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
      },
    });

    const baseUrl = this.config.get("CORS_ORIGIN", { infer: true }) ?? "http://localhost:5173";
    await this.email.sendWelcomeEmail(email, dto.fullName);
    await this.email.sendVerificationEmail(email, token, baseUrl);

    return {
      message: "Account created. Check your email to verify.",
      userId: user.id,
    };
  }

  async login(dto: LoginDto): Promise<AuthTokensResponse> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new InvalidCredentialsError();
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new InvalidCredentialsError();
    }

    if (!user.emailVerifiedAt) {
      throw new UnauthorizedError("Email not confirmed");
    }

    return this.issueTokenPair(user);
  }

  async logout(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokensResponse> {
    const tokenHash = hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedError("Invalid or expired refresh token");
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokenPair(stored.user);
  }

  async verifyEmail(token: string): Promise<MessageResponse> {
    const record = await this.prisma.emailVerification.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestError("Token invalid or expired");
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() },
      }),
      this.prisma.emailVerification.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return { message: "Email verified successfully" };
  }

  async forgotPassword(emailInput: string): Promise<MessageResponse> {
    const email = emailInput.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (user) {
      const token = generateOpaqueToken();
      await this.prisma.passwordReset.create({
        data: {
          userId: user.id,
          token,
          expiresAt: new Date(Date.now() + RESET_TTL_MS),
        },
      });
      const baseUrl = this.config.get("CORS_ORIGIN", { infer: true }) ?? "http://localhost:5173";
      await this.email.sendPasswordResetEmail(email, token, baseUrl);
      if (user.phone) {
        await this.sms.sendTransactional(
          user.phone,
          "WarehouseJobs: Password reset requested. Check your email for the secure link.",
        );
      }
    }

    return {
      message: "If that email is registered, a reset link has been sent.",
    };
  }

  async resetPassword(token: string, password: string): Promise<MessageResponse> {
    const record = await this.prisma.passwordReset.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestError("Token invalid or expired");
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordReset.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { message: "Password updated. Please log in again." };
  }

  private async issueTokenPair(user: User): Promise<AuthTokensResponse> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwt.sign(payload);
    const decoded = this.jwt.decode(accessToken) as { exp?: number } | null;
    const expiresIn =
      decoded?.exp != null
        ? decoded.exp - Math.floor(Date.now() / 1000)
        : parseDurationMs(this.config.get("JWT_ACCESS_EXPIRES_IN", { infer: true }) ?? "15m");

    const refreshToken = generateOpaqueToken();
    const refreshTtl = this.config.get("JWT_REFRESH_EXPIRES_IN", { infer: true }) ?? "30d";

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + parseDurationMs(refreshTtl)),
      },
    });

    return { accessToken, refreshToken, expiresIn };
  }
}
