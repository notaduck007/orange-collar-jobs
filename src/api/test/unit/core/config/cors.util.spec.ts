import { ConfigService } from "@nestjs/config";
import { DEV_CORS_ORIGINS, resolveCorsAllowedOrigins } from "@core/config/cors.util";
import type { Env } from "@core/config/env.schema";

function mockConfig(values: Partial<Env>): ConfigService<Env> {
  return {
    get: (key: keyof Env) => values[key],
  } as ConfigService<Env>;
}

describe("resolveCorsAllowedOrigins", () => {
  it("includes CORS_ORIGIN in production", () => {
    const origins = resolveCorsAllowedOrigins(
      mockConfig({
        NODE_ENV: "production",
        CORS_ORIGIN: "https://warehousejobs.com",
      }),
    );
    expect(origins).toEqual(["https://warehousejobs.com"]);
  });

  it("adds dev localhost ports in development", () => {
    const origins = resolveCorsAllowedOrigins(
      mockConfig({
        NODE_ENV: "development",
        CORS_ORIGIN: "http://localhost:5173",
      }),
    );
    expect(origins).toContain("http://localhost:5173");
    expect(origins).toContain("http://localhost:8080");
    expect(origins).toContain("http://127.0.0.1:5173");
    expect(origins).toContain("http://127.0.0.1:8080");
  });

  it("merges comma-separated CORS_ALLOWED_ORIGINS", () => {
    const origins = resolveCorsAllowedOrigins(
      mockConfig({
        NODE_ENV: "production",
        CORS_ORIGIN: "https://warehousejobs.com",
        CORS_ALLOWED_ORIGINS:
          "https://staging.warehousejobs.com, https://preview.warehousejobs.com",
      }),
    );
    expect(origins).toEqual([
      "https://warehousejobs.com",
      "https://staging.warehousejobs.com",
      "https://preview.warehousejobs.com",
    ]);
  });

  it("exports the standard dev origin list", () => {
    expect(DEV_CORS_ORIGINS).toContain("http://localhost:8080");
  });

  it("skips empty CORS_ORIGIN and blank allowed-origin entries", () => {
    const origins = resolveCorsAllowedOrigins(
      mockConfig({
        NODE_ENV: "production",
        CORS_ORIGIN: "",
        CORS_ALLOWED_ORIGINS: " , ",
      }),
    );
    expect(origins).toEqual([]);
  });
});
