import { createHash } from "node:crypto";
import { BadRequestError, ForbiddenError, TooManyRequestsError, UnauthorizedError, ValidationError } from "@core/error/errors";
import { OtpService } from "@domains/notifications/otp.service";
import { hashCode } from "@domains/notifications/notifications.service";

const prismaMock = {
  otpChallenge: {
    create: jest.fn(),
    update: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
  },
  user: { findUnique: jest.fn(), update: jest.fn(), findUniqueOrThrow: jest.fn() },
  userMfa: { upsert: jest.fn(), findUnique: jest.fn() },
  refreshToken: { create: jest.fn() },
};

const notificationsMock = { send: jest.fn() };
const smsMock = {
  sendVerificationCode: jest.fn(),
  checkVerificationCode: jest.fn(),
};
const jwtMock = { sign: jest.fn().mockReturnValue("access"), decode: jest.fn().mockReturnValue({ exp: 9999999999 }) };
const configMock = { get: jest.fn(() => false) };

let svc: OtpService;

beforeEach(() => {
  jest.clearAllMocks();
  svc = new OtpService(
    prismaMock as never,
    notificationsMock as never,
    smsMock as never,
    jwtMock as never,
    configMock as never,
  );

  prismaMock.otpChallenge.create.mockResolvedValue({
    id: "ch-1",
    channel: "email",
    destination: "a@test.com",
    purpose: "verify_contact",
    expiresAt: new Date(Date.now() + 600000),
    attempts: 0,
    maxAttempts: 5,
    codeHash: null,
    providerSid: null,
    verifiedAt: null,
    userId: null,
  });
});

describe("OtpService", () => {
  it("sendOtp stores hashed email code", async () => {
    await svc.sendOtp({ channel: "email", destination: "a@test.com", purpose: "verify_contact" });
    expect(prismaMock.otpChallenge.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ codeHash: expect.any(String) }) }),
    );
    expect(notificationsMock.send).toHaveBeenCalled();
  });

  it("verifyOtp approves matching email code", async () => {
    const code = "123456";
    prismaMock.otpChallenge.findFirst.mockResolvedValue({
      id: "ch-1",
      channel: "email",
      destination: "a@test.com",
      purpose: "verify_contact",
      expiresAt: new Date(Date.now() + 600000),
      attempts: 0,
      maxAttempts: 5,
      codeHash: hashCode(code),
      providerSid: null,
      verifiedAt: null,
    });

    await expect(
      svc.verifyOtp({
        channel: "email",
        destination: "a@test.com",
        code,
        purpose: "verify_contact",
      }),
    ).resolves.toEqual({ verified: true });
  });

  it("verifyOtp rejects invalid code", async () => {
    prismaMock.otpChallenge.findFirst.mockResolvedValue({
      id: "ch-1",
      channel: "email",
      destination: "a@test.com",
      purpose: "verify_contact",
      expiresAt: new Date(Date.now() + 600000),
      attempts: 0,
      maxAttempts: 5,
      codeHash: hashCode("123456"),
      providerSid: null,
      verifiedAt: null,
    });

    await expect(
      svc.verifyOtp({
        channel: "email",
        destination: "a@test.com",
        code: "000000",
        purpose: "verify_contact",
      }),
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it("enable2fa requires phone for sms method", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "u1", role: "vendor", email: "v@test.com" });
    await expect(svc.enable2fa("u1", { method: "sms" })).rejects.toBeInstanceOf(ValidationError);
  });

  it("verify2fa requires challengeId", async () => {
    await expect(svc.verify2fa({ code: "123456" })).rejects.toBeInstanceOf(ValidationError);
  });

  it("sendOtp uses Twilio for sms channel", async () => {
    prismaMock.otpChallenge.create.mockResolvedValue({
      id: "ch-sms",
      channel: "sms",
      destination: "+15551234567",
      purpose: "verify_contact",
      expiresAt: new Date(Date.now() + 600000),
    });
    await svc.sendOtp({ channel: "sms", destination: "+15551234567", purpose: "verify_contact" });
    expect(smsMock.sendVerificationCode).toHaveBeenCalled();
  });

  it("enable2fa upserts user MFA for vendor", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "u1", role: "vendor", email: "v@test.com" });
    await svc.enable2fa("u1", { method: "sms", phone: "+15551234567" });
    expect(prismaMock.userMfa.upsert).toHaveBeenCalled();
  });

  it("verify2fa issues tokens on valid challenge", async () => {
    const code = "999888";
    prismaMock.otpChallenge.findUnique.mockResolvedValue({
      id: "ch-1",
      userId: "u1",
      channel: "email",
      destination: "a@test.com",
      purpose: "login_2fa",
      expiresAt: new Date(Date.now() + 600000),
      attempts: 0,
      maxAttempts: 5,
      codeHash: hashCode(code),
      providerSid: null,
      verifiedAt: null,
    });
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1",
      email: "a@test.com",
      role: "vendor",
    });
    prismaMock.refreshToken.create.mockResolvedValue({});
    const result = await svc.verify2fa({ code, challengeId: "ch-1" });
    expect(result.accessToken).toBe("access");
  });

  it("createLoginMfaChallenge sends email OTP", async () => {
    prismaMock.userMfa.findUnique.mockResolvedValue({
      userId: "u1",
      method: "email",
      destination: "v@test.com",
    });
    prismaMock.otpChallenge.create.mockResolvedValue({ id: "ch-mfa" });
    const id = await svc.createLoginMfaChallenge("u1");
    expect(id).toBe("ch-mfa");
    expect(notificationsMock.send).toHaveBeenCalled();
  });

  it("userHasMfa returns true when configured", async () => {
    prismaMock.userMfa.findUnique.mockResolvedValue({ userId: "u1" });
    await expect(svc.userHasMfa("u1")).resolves.toBe(true);
  });

  it("verifyOtp rejects expired challenge", async () => {
    prismaMock.otpChallenge.findFirst.mockResolvedValue({
      id: "ch-1",
      channel: "email",
      destination: "a@test.com",
      purpose: "verify_contact",
      expiresAt: new Date(Date.now() - 1000),
      attempts: 0,
      maxAttempts: 5,
      codeHash: hashCode("123456"),
      providerSid: null,
      verifiedAt: null,
    });
    await expect(
      svc.verifyOtp({
        channel: "email",
        destination: "a@test.com",
        code: "123456",
        purpose: "verify_contact",
      }),
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it("verifyOtp locks out after max attempts", async () => {
    prismaMock.otpChallenge.findFirst.mockResolvedValue({
      id: "ch-1",
      channel: "email",
      destination: "a@test.com",
      purpose: "verify_contact",
      expiresAt: new Date(Date.now() + 600000),
      attempts: 5,
      maxAttempts: 5,
      codeHash: hashCode("123456"),
      providerSid: null,
      verifiedAt: null,
    });
    await expect(
      svc.verifyOtp({
        channel: "email",
        destination: "a@test.com",
        code: "123456",
        purpose: "verify_contact",
      }),
    ).rejects.toBeInstanceOf(TooManyRequestsError);
  });

  it("verifyOtp verifies sms via Twilio", async () => {
    prismaMock.otpChallenge.findFirst.mockResolvedValue({
      id: "ch-1",
      channel: "sms",
      destination: "+1555",
      purpose: "verify_contact",
      expiresAt: new Date(Date.now() + 600000),
      attempts: 0,
      maxAttempts: 5,
      codeHash: null,
      providerSid: "twilio-verify",
      verifiedAt: null,
    });
    smsMock.checkVerificationCode.mockResolvedValue(true);
    await expect(
      svc.verifyOtp({
        channel: "sms",
        destination: "+1555",
        code: "123456",
        purpose: "verify_contact",
      }),
    ).resolves.toEqual({ verified: true });
  });

  it("verifyOtp updates user email when verifying contact", async () => {
    const code = "123456";
    prismaMock.otpChallenge.findFirst.mockResolvedValue({
      id: "ch-1",
      channel: "email",
      destination: "a@test.com",
      purpose: "verify_contact",
      expiresAt: new Date(Date.now() + 600000),
      attempts: 0,
      maxAttempts: 5,
      codeHash: hashCode(code),
      providerSid: null,
      verifiedAt: null,
    });
    prismaMock.user.findUnique.mockResolvedValue({ id: "u1", email: "a@test.com" });
    await svc.verifyOtp(
      { channel: "email", destination: "a@test.com", code, purpose: "verify_contact" },
      "u1",
    );
    expect(prismaMock.user.update).toHaveBeenCalled();
  });

  it("enable2fa rejects seeker role", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "u1", role: "seeker", email: "s@test.com" });
    await expect(svc.enable2fa("u1", { method: "email", email: "s@test.com" })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("verify2fa rejects missing user on challenge", async () => {
    prismaMock.otpChallenge.findUnique.mockResolvedValue({
      id: "ch-1",
      userId: null,
      channel: "email",
      destination: "a@test.com",
      purpose: "login_2fa",
      expiresAt: new Date(Date.now() + 600000),
      attempts: 0,
      maxAttempts: 5,
      codeHash: hashCode("123456"),
      providerSid: null,
      verifiedAt: null,
    });
    await expect(svc.verify2fa({ code: "123456", challengeId: "ch-1" })).rejects.toBeInstanceOf(
      BadRequestError,
    );
  });

  it("shouldRequireMfaForRole respects config flag", () => {
    configMock.get.mockReturnValue(true);
    expect(svc.shouldRequireMfaForRole("vendor")).toBe(true);
    expect(svc.shouldRequireMfaForRole("seeker")).toBe(false);
  });

  it("enable2fa with email method stores destination", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "u1", role: "admin", email: "a@test.com" });
    await svc.enable2fa("u1", { method: "email", email: "a@test.com" });
    expect(prismaMock.userMfa.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ method: "email", destination: "a@test.com" }),
      }),
    );
  });

  it("verifyOtp updates phone on sms verify_contact", async () => {
    const code = "123456";
    prismaMock.otpChallenge.findFirst.mockResolvedValue({
      id: "ch-1",
      channel: "sms",
      destination: "+1555",
      purpose: "verify_contact",
      expiresAt: new Date(Date.now() + 600000),
      attempts: 0,
      maxAttempts: 5,
      codeHash: hashCode(code),
      providerSid: null,
      verifiedAt: null,
    });
    prismaMock.user.findUnique.mockResolvedValue({ id: "u1", email: "a@test.com" });
    await svc.verifyOtp(
      { channel: "sms", destination: "+1555", code, purpose: "verify_contact" },
      "u1",
    );
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { phone: "+1555" } }),
    );
  });

  it("verify2fa rejects expired challenge", async () => {
    prismaMock.otpChallenge.findUnique.mockResolvedValue({
      id: "ch-1",
      userId: "u1",
      channel: "email",
      destination: "a@test.com",
      purpose: "login_2fa",
      expiresAt: new Date(Date.now() - 1000),
      attempts: 0,
      maxAttempts: 5,
      codeHash: hashCode("123456"),
      providerSid: null,
      verifiedAt: null,
    });
    await expect(svc.verify2fa({ code: "123456", challengeId: "ch-1" })).rejects.toBeInstanceOf(
      BadRequestError,
    );
  });

  it("verify2fa rejects when too many attempts", async () => {
    prismaMock.otpChallenge.findUnique.mockResolvedValue({
      id: "ch-1",
      userId: "u1",
      channel: "email",
      destination: "a@test.com",
      purpose: "login_2fa",
      expiresAt: new Date(Date.now() + 600000),
      attempts: 5,
      maxAttempts: 5,
      codeHash: hashCode("123456"),
      providerSid: null,
      verifiedAt: null,
    });
    await expect(svc.verify2fa({ code: "123456", challengeId: "ch-1" })).rejects.toBeInstanceOf(
      TooManyRequestsError,
    );
  });

  it("createLoginMfaChallenge uses sms when configured", async () => {
    prismaMock.userMfa.findUnique.mockResolvedValue({
      userId: "u1",
      method: "sms",
      destination: "+1555",
    });
    prismaMock.otpChallenge.create.mockResolvedValue({ id: "ch-sms" });
    const id = await svc.createLoginMfaChallenge("u1");
    expect(id).toBe("ch-sms");
    expect(smsMock.sendVerificationCode).toHaveBeenCalledWith("+1555", "sms");
  });

  it("sendOtp stores userId and default purpose", async () => {
    await svc.sendOtp({ channel: "email", destination: "A@Test.com" }, "u1");
    expect(prismaMock.otpChallenge.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "u1",
          purpose: "verify_contact",
          destination: "a@test.com",
        }),
      }),
    );
  });

  it("verifyOtp throws when no active challenge exists", async () => {
    prismaMock.otpChallenge.findFirst.mockResolvedValue(null);
    await expect(
      svc.verifyOtp({
        channel: "email",
        destination: "a@test.com",
        code: "123456",
        purpose: "verify_contact",
      }),
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it("verify2fa approves sms challenge via Twilio", async () => {
    prismaMock.otpChallenge.findUnique.mockResolvedValue({
      id: "ch-sms",
      userId: "u1",
      channel: "sms",
      destination: "+1555",
      purpose: "login_2fa",
      expiresAt: new Date(Date.now() + 600000),
      attempts: 0,
      maxAttempts: 5,
      codeHash: null,
      providerSid: "twilio-verify",
      verifiedAt: null,
    });
    smsMock.checkVerificationCode.mockResolvedValue(true);
    prismaMock.user.findUnique.mockResolvedValue({ id: "u1", email: "a@test.com", role: "vendor" });
    prismaMock.refreshToken.create.mockResolvedValue({});

    const result = await svc.verify2fa({ code: "123456", challengeId: "ch-sms" });
    expect(result.accessToken).toBe("access");
    expect(smsMock.checkVerificationCode).toHaveBeenCalledWith("+1555", "123456");
  });

  it("verify2fa rejects invalid code and increments attempts", async () => {
    prismaMock.otpChallenge.findUnique.mockResolvedValue({
      id: "ch-1",
      userId: "u1",
      channel: "email",
      destination: "a@test.com",
      purpose: "login_2fa",
      expiresAt: new Date(Date.now() + 600000),
      attempts: 0,
      maxAttempts: 5,
      codeHash: hashCode("123456"),
      providerSid: null,
      verifiedAt: null,
    });
    await expect(svc.verify2fa({ code: "000000", challengeId: "ch-1" })).rejects.toBeInstanceOf(
      BadRequestError,
    );
    expect(prismaMock.otpChallenge.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { attempts: { increment: 1 } } }),
    );
  });

  it("verify2fa rejects already verified challenge", async () => {
    prismaMock.otpChallenge.findUnique.mockResolvedValue({
      id: "ch-1",
      userId: "u1",
      channel: "email",
      destination: "a@test.com",
      purpose: "login_2fa",
      expiresAt: new Date(Date.now() + 600000),
      attempts: 0,
      maxAttempts: 5,
      codeHash: hashCode("123456"),
      providerSid: null,
      verifiedAt: new Date(),
    });
    await expect(svc.verify2fa({ code: "123456", challengeId: "ch-1" })).rejects.toBeInstanceOf(
      BadRequestError,
    );
  });

  it("verify2fa rejects challenge with wrong purpose", async () => {
    prismaMock.otpChallenge.findUnique.mockResolvedValue({
      id: "ch-1",
      userId: "u1",
      channel: "email",
      destination: "a@test.com",
      purpose: "verify_contact",
      expiresAt: new Date(Date.now() + 600000),
      attempts: 0,
      maxAttempts: 5,
      codeHash: hashCode("123456"),
      providerSid: null,
      verifiedAt: null,
    });
    await expect(svc.verify2fa({ code: "123456", challengeId: "ch-1" })).rejects.toBeInstanceOf(
      BadRequestError,
    );
  });

  it("createLoginMfaChallenge throws when MFA not configured", async () => {
    prismaMock.userMfa.findUnique.mockResolvedValue(null);
    await expect(svc.createLoginMfaChallenge("u1")).rejects.toBeInstanceOf(BadRequestError);
  });

  it("userHasMfa returns false when not configured", async () => {
    prismaMock.userMfa.findUnique.mockResolvedValue(null);
    await expect(svc.userHasMfa("u1")).resolves.toBe(false);
  });

  it("shouldRequireMfaForRole returns false when flag disabled", () => {
    configMock.get.mockReturnValue(false);
    expect(svc.shouldRequireMfaForRole("vendor")).toBe(false);
  });

  it("enable2fa throws when user not found", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    await expect(svc.enable2fa("missing", { method: "email", email: "a@test.com" })).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it("verifyOtp rejects failed sms Twilio verification", async () => {
    prismaMock.otpChallenge.findFirst.mockResolvedValue({
      id: "ch-1",
      channel: "sms",
      destination: "+1555",
      purpose: "verify_contact",
      expiresAt: new Date(Date.now() + 600000),
      attempts: 0,
      maxAttempts: 5,
      codeHash: null,
      providerSid: "twilio-verify",
      verifiedAt: null,
    });
    smsMock.checkVerificationCode.mockResolvedValue(false);
    await expect(
      svc.verifyOtp({
        channel: "sms",
        destination: "+1555",
        code: "000000",
        purpose: "verify_contact",
      }),
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it("verifyOtp skips emailVerifiedAt when destination differs from user email", async () => {
    const code = "123456";
    prismaMock.otpChallenge.findFirst.mockResolvedValue({
      id: "ch-1",
      channel: "email",
      destination: "new@test.com",
      purpose: "verify_contact",
      expiresAt: new Date(Date.now() + 600000),
      attempts: 0,
      maxAttempts: 5,
      codeHash: hashCode(code),
      providerSid: null,
      verifiedAt: null,
    });
    prismaMock.user.findUnique.mockResolvedValue({ id: "u1", email: "old@test.com" });
    await svc.verifyOtp(
      { channel: "email", destination: "new@test.com", code, purpose: "verify_contact" },
      "u1",
    );
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("verify2fa rejects when user record missing after valid code", async () => {
    prismaMock.otpChallenge.findUnique.mockResolvedValue({
      id: "ch-1",
      userId: "u1",
      channel: "email",
      destination: "a@test.com",
      purpose: "login_2fa",
      expiresAt: new Date(Date.now() + 600000),
      attempts: 0,
      maxAttempts: 5,
      codeHash: hashCode("123456"),
      providerSid: null,
      verifiedAt: null,
    });
    prismaMock.user.findUnique.mockResolvedValue(null);
    await expect(svc.verify2fa({ code: "123456", challengeId: "ch-1" })).rejects.toBeInstanceOf(
      BadRequestError,
    );
  });

  it("verify2fa uses default expiresIn when jwt decode lacks exp", async () => {
    jwtMock.decode.mockReturnValueOnce(null);
    prismaMock.otpChallenge.findUnique.mockResolvedValue({
      id: "ch-1",
      userId: "u1",
      channel: "email",
      destination: "a@test.com",
      purpose: "login_2fa",
      expiresAt: new Date(Date.now() + 600000),
      attempts: 0,
      maxAttempts: 5,
      codeHash: hashCode("123456"),
      providerSid: null,
      verifiedAt: null,
    });
    prismaMock.user.findUnique.mockResolvedValue({ id: "u1", email: "a@test.com", role: "admin" });
    prismaMock.refreshToken.create.mockResolvedValue({});
    const result = await svc.verify2fa({ code: "123456", challengeId: "ch-1" });
    expect(result.expiresIn).toBe(900);
  });

  it("createLoginMfaChallenge falls back to user email when destination missing", async () => {
    prismaMock.userMfa.findUnique.mockResolvedValue({
      userId: "u1",
      method: "email",
      destination: null,
    });
    prismaMock.user.findUniqueOrThrow.mockResolvedValue({ id: "u1", email: "fallback@test.com" });
    prismaMock.otpChallenge.create.mockResolvedValue({ id: "ch-email" });
    const id = await svc.createLoginMfaChallenge("u1");
    expect(id).toBe("ch-email");
    expect(notificationsMock.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: "fallback@test.com" }),
    );
  });

  it("enable2fa requires email for email method", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "u1", role: "vendor", email: "v@test.com" });
    await expect(svc.enable2fa("u1", { method: "email" })).rejects.toBeInstanceOf(ValidationError);
  });
});
