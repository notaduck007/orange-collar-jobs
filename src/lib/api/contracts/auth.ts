/** OpenAPI wire types for auth and health endpoints. */

export type ApiUserRole = "admin" | "vendor" | "seeker";

export interface HealthResponse {
  readonly status: "ok" | "error";
  readonly info: Readonly<
    Record<string, { readonly status: "up" | "down"; readonly message?: string }>
  >;
  readonly error: Readonly<
    Record<string, { readonly status: "up" | "down"; readonly message?: string }>
  >;
  readonly details: Readonly<
    Record<string, { readonly status: "up" | "down"; readonly message?: string }>
  >;
}

export interface MeResponse {
  readonly id: string;
  readonly email: string;
  readonly role: ApiUserRole;
}

export interface AuthTokensResponse {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number;
}

export interface RegisterResponse {
  readonly message: string;
  readonly userId: string;
}

export interface MessageResponse {
  readonly message: string;
}

export interface RegisterRequest {
  readonly email: string;
  readonly password: string;
  readonly role: "seeker" | "vendor";
  readonly fullName?: string;
}

export interface Verify2faRequest {
  readonly code: string;
  readonly challengeId: string;
}

export interface MfaRequiredDetails {
  readonly mfaRequired: true;
  readonly challengeId: string;
}
