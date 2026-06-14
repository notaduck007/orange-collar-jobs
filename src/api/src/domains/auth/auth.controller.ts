import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Public } from "../../core/auth/public.decorator.js";
import { CurrentUser } from "../../core/auth/current-user.decorator.js";
import type { AuthUser } from "../../core/auth/jwt.strategy.js";
import { AuthService } from "./auth.service.js";
import { ForgotPasswordDto } from "./dto/forgot-password.dto.js";
import { LoginDto } from "./dto/login.dto.js";
import { RefreshTokenDto } from "./dto/refresh-token.dto.js";
import { RegisterDto } from "./dto/register.dto.js";
import { ResetPasswordDto } from "./dto/reset-password.dto.js";
import { VerifyEmailDto } from "./dto/verify-email.dto.js";
import type { AuthTokensResponse, MessageResponse, RegisterResponse } from "./types.js";

@ApiTags("Auth")
@Controller({ path: "auth", version: "1" })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("register")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: "Register a new account" })
  @ApiResponse({ status: 201, description: "Account created; verification email sent" })
  @ApiResponse({ status: 409, description: "Email already registered" })
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto): Promise<RegisterResponse> {
    return this.authService.register(dto);
  }

  @Public()
  @Post("login")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: "Login" })
  @ApiResponse({ status: 200, description: "Authenticated" })
  @ApiResponse({ status: 401, description: "Invalid credentials" })
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<AuthTokensResponse> {
    return this.authService.login(dto);
  }

  @Post("logout")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Logout" })
  @ApiResponse({ status: 204, description: "Logged out" })
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@CurrentUser() user: AuthUser): Promise<void> {
    await this.authService.logout(user.id);
  }

  @Public()
  @Post("refresh")
  @ApiOperation({ summary: "Refresh access token" })
  @ApiResponse({ status: 200, description: "New token pair issued" })
  @ApiResponse({ status: 401, description: "Invalid or expired refresh token" })
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthTokensResponse> {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @Public()
  @Post("verify-email")
  @ApiOperation({ summary: "Verify email address" })
  @ApiResponse({ status: 200, description: "Email verified" })
  @ApiResponse({ status: 400, description: "Token invalid or expired" })
  @HttpCode(HttpStatus.OK)
  verifyEmail(@Body() dto: VerifyEmailDto): Promise<MessageResponse> {
    return this.authService.verifyEmail(dto.token);
  }

  @Public()
  @Post("forgot-password")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: "Request password reset" })
  @ApiResponse({ status: 200, description: "Reset email sent if registered" })
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: ForgotPasswordDto): Promise<MessageResponse> {
    return this.authService.forgotPassword(dto.email);
  }

  @Public()
  @Post("reset-password")
  @ApiOperation({ summary: "Reset password" })
  @ApiResponse({ status: 200, description: "Password updated" })
  @ApiResponse({ status: 400, description: "Token invalid or expired" })
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto): Promise<MessageResponse> {
    return this.authService.resetPassword(dto.token, dto.password);
  }
}
