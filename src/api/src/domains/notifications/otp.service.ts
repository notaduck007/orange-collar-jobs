import { createHash, randomBytes, randomInt } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { Env } from "../../core/config/env.schema.js";
import { PrismaService } from "../../core/database/prisma.service.js";
import { SmsService } from "../../core/sms/sms.service.js";
import {
  BadRequestError,
  ForbiddenError,
  TooManyRequestsError,
  UnauthorizedError,
  ValidationError,
} from "../../core/error/errors.js";
import type { JwtPayload } from "../../core/auth/jwt.strategy.js";
import { NotificationsService, hashCode } from "./notifications.service.js";
import type { SendOtpDto } from "./dto/send-otp.dto.js";
import type { VerifyOtpDto } from "./dto/verify-otp.dto.js";
import type { Enable2faDto } from "./dto/enable-2fa.dto.js";
import type { Verify2faDto } from "./dto/verify-2fa.dto.js";
import type { AuthTokensResponse } from "../auth/types.js";

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

function normalizeDestination(channel: "email" | "sms", destination: string): string {
  return channel === "email" ? destination.trim().toLowerCase() : destination.trim();
}

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly sms: SmsService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env>,
  ) {}

  async sendOtp(dto: SendOtpDto, userId?: string): Promise<{ message: string }> {
    const channel = dto.channel;
    const destination = normalizeDestination(channel, dto.destination);
    const purpose = dto.purpose ?? "verify_contact";

    const challenge = await this.prisma.otpChallenge.create({
      data: {
        userId: userId ?? null,
        channel,
        destination,
        purpose,
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
        maxAttempts: MAX_OTP_ATTEMPTS,
      },
    });

    if (channel === "sms") {
      await this.sms.sendVerificationCode(destination, "sms");
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { providerSid: "twilio-verify" },
      });
    } else {
      const code = String(randomInt(100000, 999999));
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { codeHash: hashCode(code) },
      });
      await this.notifications.send({
        kind: "auth",
        channel: "email",
        template: "auth.otp",
        to: destination,
        data: { code },
        idempotencyKey: `otp-${challenge.id}`,
      });
    }

    this.logger.log(`OTP sent via ${channel} for ${purpose}`);
    return { message: "Verification code sent." };
  }

  async verifyOtp(dto: VerifyOtpDto, userId?: string): Promise<{ verified: boolean }> {
    const destination = normalizeDestination(dto.channel, dto.destination);

    const challenge = await this.prisma.otpChallenge.findFirst({
      where: {
        destination,
        channel: dto.channel,
        purpose: dto.purpose,
        verifiedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!challenge || challenge.expiresAt < new Date()) {
      throw new BadRequestError("Invalid or expired code");
    }

    if (challenge.attempts >= challenge.maxAttempts) {
      throw new TooManyRequestsError("Too many failed attempts");
    }

    let approved = false;
    if (dto.channel === "sms" && challenge.providerSid) {
      approved = await this.sms.checkVerificationCode(destination, dto.code);
    } else if (challenge.codeHash) {
      approved = challenge.codeHash === hashCode(dto.code);
    }

    if (!approved) {
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestError("Invalid or expired code");
    }

    await this.prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { verifiedAt: new Date() },
    });

    if (dto.purpose === "verify_contact" && userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user && dto.channel === "email" && user.email === destination) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { emailVerifiedAt: new Date() },
        });
      }
      if (user && dto.channel === "sms") {
        await this.prisma.user.update({
          where: { id: userId },
          data: { phone: destination },
        });
      }
    }

    return { verified: true };
  }

  async enable2fa(userId: string, dto: Enable2faDto): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedError();

    if (user.role !== "admin" && user.role !== "vendor") {
      throw new ForbiddenError("2FA is only available for vendor and admin accounts");
    }

    let destination: string | null = null;
    if (dto.method === "sms") {
      if (!dto.phone) throw new ValidationError("phone is required when method is sms");
      destination = dto.phone.trim();
    } else {
      if (!dto.email) throw new ValidationError("email is required when method is email");
      destination = dto.email.trim().toLowerCase();
    }

    await this.prisma.userMfa.upsert({
      where: { userId },
      create: { userId, method: dto.method, destination },
      update: { method: dto.method, destination, enabledAt: new Date() },
    });

    return { message: "Two-factor authentication enabled." };
  }

  async verify2fa(dto: Verify2faDto): Promise<AuthTokensResponse> {
    if (!dto.challengeId) {
      throw new ValidationError("challengeId is required");
    }

    const challenge = await this.prisma.otpChallenge.findUnique({
      where: { id: dto.challengeId },
    });

    if (
      !challenge ||
      challenge.purpose !== "login_2fa" ||
      challenge.expiresAt < new Date() ||
      challenge.verifiedAt != null
    ) {
      throw new BadRequestError("Invalid code or expired challenge");
    }

    if (challenge.attempts >= challenge.maxAttempts) {
      throw new TooManyRequestsError("Too many failed attempts");
    }

    let approved = false;
    if (challenge.channel === "sms" && challenge.providerSid) {
      approved = await this.sms.checkVerificationCode(challenge.destination, dto.code);
    } else if (challenge.codeHash) {
      approved = challenge.codeHash === hashCode(dto.code);
    }

    if (!approved) {
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestError("Invalid code or expired challenge");
    }

    await this.prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { verifiedAt: new Date() },
    });

    if (!challenge.userId) {
      throw new BadRequestError("Invalid code or expired challenge");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: challenge.userId },
    });
    if (!user) throw new BadRequestError("Invalid code or expired challenge");

    return this.issueTokenPair(user.id, user.email, user.role);
  }

  async createLoginMfaChallenge(userId: string): Promise<string> {
    const mfa = await this.prisma.userMfa.findUnique({ where: { userId } });
    if (!mfa) {
      throw new BadRequestError("MFA not configured");
    }

    const channel = mfa.method === "sms" ? "sms" : "email";
    const destination =
      mfa.destination ??
      (await this.prisma.user.findUniqueOrThrow({ where: { id: userId } })).email;

    const challenge = await this.prisma.otpChallenge.create({
      data: {
        userId,
        channel,
        destination,
        purpose: "login_2fa",
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
        maxAttempts: MAX_OTP_ATTEMPTS,
      },
    });

    if (channel === "sms") {
      await this.sms.sendVerificationCode(destination, "sms");
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { providerSid: "twilio-verify" },
      });
    } else {
      const code = String(randomInt(100000, 999999));
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { codeHash: hashCode(code) },
      });
      await this.notifications.send({
        kind: "auth",
        channel: "email",
        template: "auth.otp",
        to: destination,
        data: { code },
        idempotencyKey: `mfa-${challenge.id}`,
      });
    }

    return challenge.id;
  }

  async userHasMfa(userId: string): Promise<boolean> {
    const mfa = await this.prisma.userMfa.findUnique({ where: { userId } });
    return mfa != null;
  }

  shouldRequireMfaForRole(role: string): boolean {
    const flag = this.config.get("REQUIRE_MFA_FOR_ROLE", { infer: true });
    if (!flag) return false;
    return role === "admin" || role === "vendor";
  }

  private issueTokenPair(
    userId: string,
    email: string,
    role: string,
  ): AuthTokensResponse {
    const payload: JwtPayload = { sub: userId, email, role: role as JwtPayload["role"] };
    const accessToken = this.jwt.sign(payload);
    const decoded = this.jwt.decode(accessToken) as { exp?: number } | null;
    const expiresIn =
      decoded?.exp != null ? decoded.exp - Math.floor(Date.now() / 1000) : 900;

    const refreshToken = randomBytes(32).toString("base64url");

    void this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: createHash("sha256").update(refreshToken).digest("hex"),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return { accessToken, refreshToken, expiresIn };
  }
}
