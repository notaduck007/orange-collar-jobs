import type { ConfigService } from "@nestjs/config";
import type { Env } from "./env.schema.js";

/** Local dev ports used by Vite / TanStack Start (5173 default, 8080 Lovable sandbox). */
export const DEV_CORS_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:8080",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:8080",
] as const;

function splitOrigins(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

/**
 * Browser origins allowed by Nest CORS middleware.
 * `CORS_ORIGIN` is the primary frontend URL (also used for auth email links).
 * `CORS_ALLOWED_ORIGINS` adds extra comma-separated origins.
 * In development, common localhost ports are always included.
 */
export function resolveCorsAllowedOrigins(config: ConfigService<Env>): string[] {
  const origins = new Set<string>();

  const primary = config.get("CORS_ORIGIN", { infer: true });
  if (primary) origins.add(primary);

  for (const origin of splitOrigins(config.get("CORS_ALLOWED_ORIGINS", { infer: true }))) {
    origins.add(origin);
  }

  if (config.get("NODE_ENV", { infer: true }) === "development") {
    for (const origin of DEV_CORS_ORIGINS) {
      origins.add(origin);
    }
  }

  return [...origins];
}
