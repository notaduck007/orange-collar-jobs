import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1024).max(65535).default(3001),
  /** Primary frontend URL — auth email links and default CORS origin. */
  CORS_ORIGIN: z.string().url().default("http://localhost:5173"),
  /** Extra browser origins (comma-separated). Dev always allows :5173 and :8080. */
  CORS_ALLOWED_ORIGINS: z.string().optional(),

  DATABASE_URL: z
    .string()
    .refine((s) => s.startsWith("postgresql://") || s.startsWith("postgres://"), {
      message: "DATABASE_URL must be a PostgreSQL connection string",
    }),
  TEST_DATABASE_URL: z
    .string()
    .refine((s) => s.startsWith("postgresql://") || s.startsWith("postgres://"), {
      message: "TEST_DATABASE_URL must be a PostgreSQL connection string",
    })
    .optional(),

  REDIS_URL: z.string().refine((s) => s.startsWith("redis://") || s.startsWith("rediss://"), {
    message: "REDIS_URL must be a Redis connection string",
  }),

  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),

  STORAGE_ENDPOINT: z.string().refine((s) => s.startsWith("http://") || s.startsWith("https://"), {
    message: "STORAGE_ENDPOINT must be an HTTP(S) URL",
  }),
  /**
   * Publicly reachable base URL for stored file links (what the browser loads).
   * Defaults to STORAGE_ENDPOINT when not set.
   * Example: http://localhost:9000  (dev) or https://cdn.warehousejobs.com (prod)
   */
  STORAGE_PUBLIC_URL: z
    .string()
    .refine((s) => s.startsWith("http://") || s.startsWith("https://"), {
      message: "STORAGE_PUBLIC_URL must be an HTTP(S) URL",
    })
    .optional(),
  STORAGE_REGION: z.string().default("us-east-1"),
  STORAGE_ACCESS_KEY: z.string().min(1),
  STORAGE_SECRET_KEY: z.string().min(1),
  STORAGE_BUCKET_RESUMES: z.string().default("resumes"),
  STORAGE_BUCKET_LOGOS: z.string().default("company-logos"),
  STORAGE_BUCKET_ADS: z.string().default("ad-assets"),
  STORAGE_FORCE_PATH_STYLE: z.coerce.boolean().default(true),

  EMAIL_PROVIDER: z.enum(["resend", "sendgrid"]).default("resend"),
  EMAIL_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().email(),
  EMAIL_FROM_NAME: z.string().default("WarehouseJobs"),
  /** When true, sends via Resend in development (otherwise logs to console). */
  EMAIL_SEND_IN_DEV: z.coerce.boolean().default(false),

  TWILIO_ACCOUNT_SID: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().startsWith("AC").optional(),
  ),
  TWILIO_AUTH_TOKEN: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional()),
  TWILIO_FROM_NUMBER: z.preprocess((v) => (v === "" ? undefined : v), z.string().optional()),
  TWILIO_VERIFY_SERVICE_SID: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().min(32).optional(),
  ),
  TWILIO_APP_CLIENT_ID: z.preprocess((v) => (v === "" ? undefined : v), z.string().optional()),
  TWILIO_APP_CLIENT_SECRET: z.preprocess((v) => (v === "" ? undefined : v), z.string().optional()),

  /** When true, vendor/admin accounts must complete MFA at login if enabled. */
  REQUIRE_MFA_FOR_ROLE: z.coerce.boolean().default(false),
  /** Public base URL for inbound webhook signature validation (e.g. https://api.warehousejobs.com). */
  WEBHOOK_BASE_URL: z.string().url().optional(),

  API_KEY_HASH: z.string().min(1),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Env = z.infer<typeof envSchema>;
