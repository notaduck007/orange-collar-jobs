import { AuthController } from "@domains/auth/auth.controller";
import type { AuthService } from "@domains/auth/auth.service";
import type { OtpService } from "@domains/notifications/otp.service";
import type { AuthUser } from "@core/auth/jwt.strategy";

describe("AuthController", () => {
  let controller: AuthController;
  let authService: {
    register: jest.Mock;
    login: jest.Mock;
    logout: jest.Mock;
    refreshTokens: jest.Mock;
    verifyEmail: jest.Mock;
    forgotPassword: jest.Mock;
    resetPassword: jest.Mock;
  };
  let otpService: {
    sendOtp: jest.Mock;
    verifyOtp: jest.Mock;
    enable2fa: jest.Mock;
    verify2fa: jest.Mock;
  };

  const user: AuthUser = {
    id: "user-1",
    email: "jane@example.com",
    role: "seeker",
  };

  beforeEach(() => {
    authService = {
      register: jest.fn(),
      login: jest.fn(),
      logout: jest.fn(),
      refreshTokens: jest.fn(),
      verifyEmail: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
    };
    otpService = {
      sendOtp: jest.fn(),
      verifyOtp: jest.fn(),
      enable2fa: jest.fn(),
      verify2fa: jest.fn(),
    };
    controller = new AuthController(
      authService as unknown as AuthService,
      otpService as unknown as OtpService,
    );
  });

  it("register delegates to AuthService.register", async () => {
    const dto = {
      email: "jane@example.com",
      password: "SecureP@ss1",
      role: "seeker" as const,
      fullName: "Jane",
    };
    const response = { message: "Account created", userId: "user-1" };
    authService.register.mockResolvedValue(response);

    await expect(controller.register(dto)).resolves.toEqual(response);
    expect(authService.register).toHaveBeenCalledWith(dto);
  });

  it("login delegates to AuthService.login", async () => {
    const dto = { email: "jane@example.com", password: "SecureP@ss1" };
    const tokens = {
      accessToken: "access",
      refreshToken: "refresh",
      expiresIn: 900,
    };
    authService.login.mockResolvedValue(tokens);

    await expect(controller.login(dto)).resolves.toEqual(tokens);
    expect(authService.login).toHaveBeenCalledWith(dto);
  });

  it("logout delegates to AuthService.logout", async () => {
    authService.logout.mockResolvedValue(undefined);

    await expect(controller.logout(user)).resolves.toBeUndefined();
    expect(authService.logout).toHaveBeenCalledWith(user.id);
  });

  it("refresh delegates to AuthService.refreshTokens", async () => {
    const dto = { refreshToken: "opaque-refresh" };
    const tokens = {
      accessToken: "new-access",
      refreshToken: "new-refresh",
      expiresIn: 900,
    };
    authService.refreshTokens.mockResolvedValue(tokens);

    await expect(controller.refresh(dto)).resolves.toEqual(tokens);
    expect(authService.refreshTokens).toHaveBeenCalledWith("opaque-refresh");
  });

  it("verifyEmail delegates to AuthService.verifyEmail", async () => {
    const dto = { token: "verify-tok" };
    const response = { message: "Email verified successfully" };
    authService.verifyEmail.mockResolvedValue(response);

    await expect(controller.verifyEmail(dto)).resolves.toEqual(response);
    expect(authService.verifyEmail).toHaveBeenCalledWith("verify-tok");
  });

  it("forgotPassword delegates to AuthService.forgotPassword", async () => {
    const dto = { email: "jane@example.com" };
    const response = { message: "If that email is registered, a reset link has been sent." };
    authService.forgotPassword.mockResolvedValue(response);

    await expect(controller.forgotPassword(dto)).resolves.toEqual(response);
    expect(authService.forgotPassword).toHaveBeenCalledWith("jane@example.com");
  });

  it("resetPassword delegates to AuthService.resetPassword", async () => {
    const dto = { token: "reset-tok", password: "NewSecure1!" };
    const response = { message: "Password updated. Please log in again." };
    authService.resetPassword.mockResolvedValue(response);

    await expect(controller.resetPassword(dto)).resolves.toEqual(response);
    expect(authService.resetPassword).toHaveBeenCalledWith("reset-tok", "NewSecure1!");
  });

  it("sendOtp delegates to OtpService.sendOtp", async () => {
    const dto = { channel: "email" as const, destination: "a@test.com" };
    otpService.sendOtp.mockResolvedValue({ message: "Verification code sent." });
    await expect(controller.sendOtp(dto)).resolves.toEqual({ message: "Verification code sent." });
    expect(otpService.sendOtp).toHaveBeenCalledWith(dto);
  });

  it("verifyOtp delegates to OtpService.verifyOtp", async () => {
    const dto = {
      channel: "email" as const,
      destination: "a@test.com",
      code: "123456",
      purpose: "verify_contact" as const,
    };
    otpService.verifyOtp.mockResolvedValue({ verified: true });
    await expect(controller.verifyOtp(dto)).resolves.toEqual({ verified: true });
  });

  it("enable2fa delegates to OtpService.enable2fa", async () => {
    otpService.enable2fa.mockResolvedValue({ message: "Two-factor authentication enabled." });
    await expect(controller.enable2fa(user, { method: "email", email: "a@test.com" })).resolves.toEqual({
      message: "Two-factor authentication enabled.",
    });
  });

  it("verify2fa delegates to OtpService.verify2fa", async () => {
    const tokens = { accessToken: "a", refreshToken: "r", expiresIn: 900 };
    otpService.verify2fa.mockResolvedValue(tokens);
    await expect(controller.verify2fa({ code: "123456", challengeId: "ch-1" })).resolves.toEqual(tokens);
  });
});
