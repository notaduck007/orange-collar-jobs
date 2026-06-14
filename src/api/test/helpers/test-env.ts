/**
 * Complete env fixture matching envSchema — use in unit tests and jest-setup
 * when the repo root .env is absent (CI).
 */
export const validTestEnv = {
  NODE_ENV: "test" as const,
  PORT: 3001,
  CORS_ORIGIN: "http://localhost:5173",
  DATABASE_URL: "postgresql://wj_user:wj_dev_password@localhost:5432/warehousejobs_test",
  REDIS_URL: "redis://localhost:6379",
  JWT_SECRET: "a".repeat(40),
  JWT_REFRESH_SECRET: "b".repeat(40),
  STORAGE_ENDPOINT: "http://localhost:9000",
  STORAGE_ACCESS_KEY: "wj_minio_user",
  STORAGE_SECRET_KEY: "wj_minio_dev_password",
  STORAGE_FORCE_PATH_STYLE: "true",
  EMAIL_API_KEY: "re_test_key",
  EMAIL_FROM: "noreply@warehousejobs.com",
  API_KEY_HASH: "local_dev_placeholder_batch_api_key_hash",
  LOG_LEVEL: "debug" as const,
};

/** Apply fixture values only where process.env has no value (CI-safe; respects override: false). */
export function applyTestEnvToProcess(
  env: Record<string, string | number | boolean> = validTestEnv,
): void {
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) {
      process.env[key] = String(value);
    }
  }
}
