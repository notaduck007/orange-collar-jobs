/**
 * Shared HTTP transport for the NestJS API (single responsibility: fetch + errors).
 */

import { getApiBaseUrl } from "./config";

export { getApiBaseUrl } from "./config";

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

  get details(): Record<string, unknown> | undefined {
    if (this.body && typeof this.body === "object" && "details" in this.body) {
      const d = (this.body as { details: unknown }).details;
      return d && typeof d === "object" ? (d as Record<string, unknown>) : undefined;
    }
    return undefined;
  }
}

export type ApiFetchOptions = RequestInit & {
  token?: string;
  apiKey?: string;
};

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { token, apiKey, ...init } = options;
  const headers: Record<string, string> = {
    ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(init.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (apiKey) headers["X-Api-Key"] = apiKey;

  const res = await fetch(`${getApiBaseUrl()}${path}`, { ...init, headers });

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
