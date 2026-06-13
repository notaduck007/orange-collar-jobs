/**
 * WarehouseJobs NestJS API client
 *
 * Typed fetch wrapper for the REST API at VITE_API_BASE_URL (defaults to
 * http://localhost:3001 in development). All methods are async and throw
 * ApiError on non-2xx responses.
 *
 * Usage:
 *   import { apiClient } from '@/lib/api-client';
 *
 *   // Public — no token needed
 *   const health = await apiClient.health();
 *
 *   // Authenticated — pass the access token from the auth store
 *   const me = await apiClient.me(accessToken);
 */

const BASE_URL =
  (typeof import.meta !== 'undefined' && (import.meta as Record<string, unknown>).env
    ? (import.meta as { env: Record<string, string> }).env['VITE_API_BASE_URL']
    : undefined) ?? 'http://localhost:3001';

// ── Types ────────────────────────────────────────────────────────────────────

export interface HealthResponse {
  status: 'ok' | 'error';
  info: Record<string, { status: 'up' | 'down'; message?: string }>;
  error: Record<string, { status: 'up' | 'down'; message?: string }>;
  details: Record<string, { status: 'up' | 'down'; message?: string }>;
}

export interface MeResponse {
  id: string;
  email: string;
  role: 'ADMIN' | 'EMPLOYER' | 'WORKER';
}

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly body: unknown,
    message?: string,
  ) {
    super(message ?? `API error ${statusCode}`);
    this.name = 'ApiError';
  }
}

// ── Internal helpers ─────────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, ...init } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });

  if (!res.ok) {
    let body: unknown;
    try { body = await res.json(); } catch { body = null; }
    throw new ApiError(res.status, body);
  }

  // No content
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

// ── Public API client ────────────────────────────────────────────────────────

export const apiClient = {
  /**
   * GET /api/health — version-neutral liveness check (public)
   */
  health(): Promise<HealthResponse> {
    return apiFetch<HealthResponse>('/api/health');
  },

  /**
   * GET /api/v1/me — return the caller's JWT identity (requires Bearer token)
   */
  me(token: string): Promise<MeResponse> {
    return apiFetch<MeResponse>('/api/v1/me', { token });
  },
};
