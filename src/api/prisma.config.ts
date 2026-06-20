import { config } from "dotenv";
import { resolve } from "node:path";
import { defineConfig } from "prisma/config";

// Monorepo: load DATABASE_URL from repo root .env when present
config({ path: resolve(__dirname, "../../.env") });

// `prisma generate` does not connect to the database. A placeholder URL is enough when
// DATABASE_URL is unset (CI install postinstall, fresh clone before .env exists).
// Migrate/deploy steps must set a real DATABASE_URL in the environment.
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://placeholder:placeholder@localhost:5432/placeholder";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
