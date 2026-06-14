/**
 * Typed fetch wrapper for the NestJS API at VITE_API_BASE_URL.
 */
import { getAuthSession, storeTokens, clearAuthSession } from "@/lib/auth-session";

const BASE_URL =
  (typeof import.meta !== "undefined" && (import.meta as Record<string, unknown>).env
    ? (import.meta as { env: Record<string, string> }).env["VITE_API_BASE_URL"]
    : undefined) ?? "http://localhost:3001";

export type ApiUserRole = "admin" | "vendor" | "seeker";

export interface HealthResponse {
  status: "ok" | "error";
  info: Record<string, { status: "up" | "down"; message?: string }>;
  error: Record<string, { status: "up" | "down"; message?: string }>;
  details: Record<string, { status: "up" | "down"; message?: string }>;
}

export interface MeResponse {
  id: string;
  email: string;
  role: ApiUserRole;
}

export interface AuthTokensResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RegisterResponse {
  message: string;
  userId: string;
}

export interface MessageResponse {
  message: string;
}

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly body: unknown,
    message?: string,
  ) {
    super(message ?? `API error ${statusCode}`);
    this.name = "ApiError";
  }

  get code(): string | undefined {
    if (this.body && typeof this.body === "object" && "code" in this.body) {
      return String((this.body as { code: string }).code);
    }
    return undefined;
  }
}

async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, ...init } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });

  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    const message =
      body && typeof body === "object" && "message" in body
        ? String((body as { message: string }).message)
        : undefined;
    throw new ApiError(res.status, body, message);
  }

  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

export const apiClient = {
  health(): Promise<HealthResponse> {
    return apiFetch<HealthResponse>("/api/health");
  },

  me(token: string): Promise<MeResponse> {
    return apiFetch<MeResponse>("/api/v1/me", { token });
  },

  register(body: {
    email: string;
    password: string;
    role: "seeker" | "vendor";
    fullName?: string;
  }): Promise<RegisterResponse> {
    return apiFetch<RegisterResponse>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  login(email: string, password: string): Promise<AuthTokensResponse> {
    return apiFetch<AuthTokensResponse>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  async loginAndStore(email: string, password: string): Promise<AuthTokensResponse> {
    const tokens = await apiClient.login(email, password);
    storeTokens(tokens.accessToken, tokens.refreshToken, tokens.expiresIn);
    return tokens;
  },

  logout(token: string): Promise<void> {
    return apiFetch<void>("/api/v1/auth/logout", { method: "POST", token });
  },

  async logoutAndClear(token: string): Promise<void> {
    try {
      await apiClient.logout(token);
    } finally {
      clearAuthSession();
    }
  },

  refresh(refreshToken: string): Promise<AuthTokensResponse> {
    return apiFetch<AuthTokensResponse>("/api/v1/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });
  },

  async refreshStoredSession(): Promise<AuthTokensResponse | null> {
    const session = getAuthSession();
    if (!session?.refreshToken) return null;
    try {
      const tokens = await apiClient.refresh(session.refreshToken);
      storeTokens(tokens.accessToken, tokens.refreshToken, tokens.expiresIn);
      return tokens;
    } catch {
      clearAuthSession();
      return null;
    }
  },

  verifyEmail(token: string): Promise<MessageResponse> {
    return apiFetch<MessageResponse>("/api/v1/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  },

  forgotPassword(email: string): Promise<MessageResponse> {
    return apiFetch<MessageResponse>("/api/v1/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },

  resetPassword(token: string, password: string): Promise<MessageResponse> {
    return apiFetch<MessageResponse>("/api/v1/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    });
  },
};

export function getApiBaseUrl(): string {
  return BASE_URL;
}
