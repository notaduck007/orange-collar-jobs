# Monorepo Standard

**Applies to**: `orange-collar-jobs` — frontend at repo root + NestJS API in `src/api/`.

This repository is a **monorepo**: one git repo, multiple deployable surfaces, shared tooling at
the root. The API remains **extractable** (`src/api/` is self-contained) but day-to-day
development follows the layout below.

---

## Package layout

| Location | Package name | Role |
|---|---|---|
| Repository root | `warehousejobs` | Frontend (TanStack Start / Vite), root scripts, release tooling |
| `src/api/` | `@warehousejobs/api` | NestJS API — own `package.json`, Prisma, tests, Dockerfile |

Bun **workspaces** (`workspaces: ["src/api"]` in root `package.json`) link the two packages.
Run **`bun install` once at the repo root** — do not maintain a separate install workflow for
the API unless debugging workspace issues.

---

## `package.json` script conventions

### Rule 1 — Canonical scripts live in the workspace package

All **implementation** scripts (`test`, `build`, `db:migrate:dev`, `lint`, …) are defined in
[`src/api/package.json`](../../../src/api/package.json). They are run **from `src/api/`** or via
root delegates.

### Rule 2 — Root scripts are convenience aliases only

Root [`package.json`](../../../package.json) scripts prefixed with `api:` **delegate** to the
API workspace. They must not duplicate logic (no inline `jest`, `prisma`, or `nest` at root).

| Root script | Delegates to |
|---|---|
| `api:dev` | `bun run --cwd src/api start:dev` |
| `api:test` | `bun run --cwd src/api test` |
| `api:migrate:dev` | `bun run --cwd src/api db:migrate:dev` |
| `api:build` | `bun run --cwd src/api build` |

Frontend scripts (`dev`, `build`, `preview`) live at root with **no prefix**.

### Rule 3 — Repo-root tooling only at root

These run from the repository root and are **never** duplicated in `src/api/package.json`:

| Tool | Root script | Config |
|---|---|---|
| semantic-release | `release`, `api:deploy:release` | [`release.config.cjs`](../../../release.config.cjs) |
| OpenAPI bump / SwaggerHub | `api:bump:*`, `api:publish` | `scripts/*.sh` |

**semantic-release** devDependencies live in **root** `devDependencies` only. `release.yml` runs
`bun install` at root and invokes `bun run api:deploy:release`.

### Rule 4 — Never nest duplicate package managers

Do not add `npm install` / separate lockfiles under `src/api/`. The root `bun.lock` covers the
workspace.

---

## Environment variables (`.env`)

### Single root `.env` — no nested env files

| Rule | Detail |
|---|---|
| **Location** | Repository root only: `.env` + `.env.example` |
| **Forbidden** | `src/api/.env`, `src/api/.env.example` — do not create nested copies |
| **Setup** | `bun run setup:env` (copies root `.env.example` → `.env`) |

All variables (frontend `VITE_*`, API `DATABASE_URL`, tooling `SWAGGER_API_KEY`) live in one
file so Docker Compose, CI, and local dev share a single source of truth.

### How each surface loads env

| Consumer | Mechanism |
|---|---|
| NestJS API (runtime) | `ConfigModule` → `envFilePath: [../../.env, .env]` from `src/api` cwd |
| Prisma CLI | `dotenv -e ../../.env -- prisma …` in `src/api/package.json` scripts |
| Jest (integration/E2E) | `test/jest-setup.ts` loads `../../../.env` |
| Vite (frontend) | Reads `VITE_*` from root `.env` automatically |
| Docker Compose `api` service | `environment:` block (production hostnames) or `env_file: .env` |
| CI | Workflow `env:` blocks (no committed `.env`) |

---

## Test directory layout (`src/api/test/`)

Tests are **never** co-located with source. They mirror `src/` under `test/`:

```
src/api/test/
├── unit/                    # Jest — test/jest-unit.json
│   ├── core/                # mirrors src/core/
│   ├── domains/             # mirrors src/domains/
│   └── scripts/             # mirrors scripts/ (when added)
├── integration/             # *.integration.spec.ts
├── e2e/                     # *.e2e-spec.ts
├── helpers/                 # factories, Prisma test helpers
├── jest-setup.ts
├── jest-unit.json
├── jest-integration.json
└── jest-e2e.json
```

Unit specs import code via `@core/*` and `@domains/*` path aliases.

---

## Package manager: Bun only

| Context | Command | Lockfile |
|---|---|---|
| Local development | `bun install`, `bun run …` | Root `bun.lock` |
| CI (`.github/workflows/ci.yml`, `release.yml`) | `oven-sh/setup-bun` + `bun install --frozen-lockfile` | Root `bun.lock` |
| Docker (`src/api/Dockerfile`) | `oven/bun` image + `bun install` | Root `bun.lock` copied into image |

**Do not use `npm ci` or `npm install`** in this monorepo — there is no root `package-lock.json`.
Do not keep nested `package-lock.json` or `bun.lock` under `src/api/` (the workspace uses the root lockfile).

Docker builds that fail at `RUN npm ci` are using the wrong tool; the Dockerfile must use Bun to match local dev and CI.

---

## Extractability

`src/api/` can be copied to a standalone repository:

- Own `package.json`, `tsconfig.json`, `nest-cli.json`, Prisma schema, Dockerfile
- Remove `workspaces` entry; run `bun install` inside the extracted folder
- Move API env vars from root `.env.example` into the extracted `.env.example`
- Root-only scripts (`api:publish`, semantic-release) stay in the monorepo or move to the new
  repo's root as appropriate

---

## References

- Repository README: [`../../../README.md`](../../../README.md)
- Repository documentation standard: [`repository-documentation.md`](./repository-documentation.md)
- Testing: [`../testing/unit.md`](../testing/unit.md)
- Architecture: [`../../analysis/architecture.md`](../../analysis/architecture.md)
