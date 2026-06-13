# WarehouseJobs.com

A niche job board and hiring platform for the warehouse and logistics sector.  
Employers post jobs; workers apply via a fast mobile-first flow; admins manage content and advertising.

---

## Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19 · TanStack Start (SSR) · Vite · Tailwind CSS · Supabase Auth |
| **API** | NestJS 10 · TypeScript 5 · Prisma 6 · PostgreSQL 16 |
| **Queue** | BullMQ + Redis 7 |
| **Storage** | MinIO (local) → Cloudflare R2 (production) |
| **Auth** | NestJS JWT (HS256) |
| **Testing** | Jest · Supertest · ts-jest |
| **Package manager** | Bun (workspace root + `src/api/`) |

---

## Repository Structure

```
orange-collar-jobs/
│
├── src/                          ← Frontend (TanStack Start + Vite)
│   └── api/                      ← NestJS REST API (self-contained, extractable)
│       ├── postman/              ← Postman collection + environment
│       ├── prisma/               ← Schema, migrations, seeds
│       │   ├── schema.prisma
│       │   ├── migrations/
│       │   └── seeds/
│       ├── src/                  ← Application source
│       │   ├── app.factory.ts    ← Shared bootstrap config (versioning, pipes, filters)
│       │   ├── app.module.ts     ← Root NestJS module
│       │   ├── main.ts           ← Entry point
│       │   ├── core/             ← Global infrastructure modules (@Global)
│       │   │   ├── auth/         ← JWT strategy, guards, @Public, @Roles, /api/v1/me
│       │   │   ├── config/       ← Zod-validated env schema, ConfigModule
│       │   │   ├── database/     ← PrismaService singleton
│       │   │   ├── error/        ← GlobalExceptionFilter, typed error classes
│       │   │   ├── health/       ← /api/health liveness check
│       │   │   ├── logging/      ← Pino structured logging
│       │   │   ├── queue/        ← BullMQ / Redis wiring
│       │   │   ├── sms/          ← Twilio adapter (SmsService)
│       │   │   └── storage/      ← S3/MinIO adapter (StorageService)
│       │   └── domains/          ← Bounded contexts (added per phase)
│       │       ├── auth/         ← Phase 2: register, login, refresh, password reset
│       │       ├── jobs/         ← Phase 3: job CRUD, batch ingestion, search
│       │       ├── applications/ ← Phase 5: apply, track, employer review
│       │       └── companies/    ← Phase 6: company profiles, logos, billing
│       └── test/                 ← All tests (mirrors src/ structure)
│           ├── helpers/          ← Shared test utilities (createTestApp, signTestToken)
│           ├── jest-setup.ts     ← Loads root .env; runs before every test file
│           ├── jest-unit.json    ← Unit test Jest config
│           ├── jest-integration.json
│           ├── jest-e2e.json
│           ├── unit/             ← Unit specs mirroring src/ (mocked I/O)
│           │   ├── core/
│           │   └── domains/
│           ├── integration/      ← Real Postgres + Redis + MinIO
│           └── e2e/              ← Supertest HTTP tests against full NestJS app
│
├── docs/
│   ├── api/openapi.yaml          ← OpenAPI 3.0 contract (source of truth)
│   ├── plan.md                   ← Phase plan with tasks and acceptance criteria
│   └── agent/                    ← AI agent documentation
│       ├── standards/            ← Coding and process standards
│       │   ├── common/           ← TypeScript, security, naming, architecture
│       │   └── testing/          ← Unit, integration, E2E standards
│       ├── skills/               ← Reusable agent reasoning workflows
│       └── personas/             ← Agent persona definitions
│
├── .cursor/
│   ├── rules/                    ← Always-on Cursor IDE rules
│   └── skills/                   ← Auto-discovered agent skills
│       ├── api-versioning/       ← URI versioning patterns and rules
│       ├── testing/              ← Test writing workflow
│       ├── coding-conventions/   ← SOLID + NestJS patterns
│       └── ...
│
├── scripts/
│   ├── setup-env.sh              ← Create root .env from .env.example
│   ├── ensure-minio-buckets.sh   ← Idempotent bucket creation
│   └── phase1-demo.sh            ← End-to-end Phase 1 demo
│
├── .github/workflows/
│   ├── ci.yml                    ← Lint → Type-check → Unit → Integration → E2E
│   └── release.yml               ← Semantic-release on main
│
├── docker-compose.yml            ← Postgres 16 · Redis 7 · MinIO
├── .env.example                  ← Template — copy to .env
├── CLAUDE.md                     ← Engineering constitution (AI rules)
├── AGENTS.md                     ← AI agent orchestration model
└── bun.lock                      ← Root lockfile (Bun workspaces)
```

---

## API URL Conventions

| Path | Description |
|---|---|
| `GET /api/health` | Liveness check — no version segment (VERSION_NEUTRAL) |
| `GET /api/v1/me` | Return the caller's JWT identity |
| `GET /api/docs` | Swagger UI (dev only) |
| `POST /api/v1/auth/login` | Phase 2 |
| `GET /api/v1/jobs` | Phase 3 |

All endpoints use URI versioning: `/api/v{N}/…`.  
Versioning rules: see `.cursor/skills/api-versioning/SKILL.md`.

---

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) ≥ 1.1 (`brew install bun`)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for Postgres, Redis, MinIO)
- Node.js ≥ 20 (used by Jest via `node --experimental-vm-modules`)

### 1. Clone and install

```bash
git clone https://github.com/your-org/orange-collar-jobs.git
cd orange-collar-jobs
bun install
```

### 2. Configure environment

```bash
bash scripts/setup-env.sh      # creates root .env from .env.example
```

Review `.env` and update any values (JWT secrets, ports, etc.).

### 3. Start infrastructure

```bash
docker compose up -d           # Postgres 16 (port 5433) · Redis 7 (6380) · MinIO (9000)
bash scripts/ensure-minio-buckets.sh   # create S3 buckets (idempotent)
```

### 4. Run database migrations

```bash
bun run api:db:migrate:dev
```

### 5. Start the API

```bash
bun run api:dev                # NestJS with hot reload — http://localhost:3001
```

- Health check: http://localhost:3001/api/health
- Swagger UI:   http://localhost:3001/api/docs

### 6. Start the frontend (optional)

```bash
bun run dev                    # TanStack Start — http://localhost:5173
```

---

## Testing

All tests run from the **repo root** using `bun run` scripts.

```bash
# Unit tests (fast, fully mocked)
bun run api:test

# Unit tests with coverage report (≥90% required)
bun run api:test:cov

# Integration tests (real Postgres + Redis + MinIO — docker compose must be running)
bun run api:test:integration

# E2E tests (Supertest against full NestJS app)
bun run api:test:e2e

# Full quality gate (all three suites in sequence)
bun run api:test && bun run api:test:integration && bun run api:test:e2e
```

### Test layout

```
test/
├── helpers/
│   └── create-test-app.ts    ← createTestApp() — always use this in E2E/integration tests
├── jest-setup.ts             ← loads root .env before every test file
├── unit/
│   └── core/
│       ├── auth/             ← jwt.strategy, jwt-auth.guard, roles.guard, me.controller, decorators
│       ├── config/           ← config.module, env.schema
│       ├── database/         ← prisma.service
│       ├── error/            ← errors, global-exception.filter
│       ├── health/           ← health.controller, redis-health, storage-health
│       ├── logging/          ← logging.module
│       ├── queue/            ← queue.module
│       ├── sms/              ← sms.service
│       └── storage/          ← storage.service
├── integration/
│   └── health.integration.spec.ts
└── e2e/
    ├── health.e2e-spec.ts    ← GET /api/health — public, VERSION_NEUTRAL
    └── me.e2e-spec.ts        ← GET /api/v1/me — 401 cases + route contract
```

### Why `createTestApp()`?

NestJS E2E tests that bootstrap `AppModule` manually miss `enableVersioning()`, causing every versioned route (`/api/v1/…`) to return 404.  
`createTestApp()` calls `configureApp()` — the same function used by `main.ts` — so tests and production always share identical pipeline configuration.

```typescript
// correct ✓
import { createTestApp } from '../helpers/create-test-app.js';
const { app, close } = await createTestApp(AppModule);

// wrong ✗ — skips versioning, pipes, and exception filter
const app = module.createNestApplication();
app.setGlobalPrefix('api');   // enableVersioning() is missing!
```

### Coverage thresholds

| Metric | Threshold |
|---|---|
| Lines | ≥ 90% |
| Statements | ≥ 90% |
| Branches | ≥ 90% |
| Functions | ≥ 90% |

---

## Postman

Import the collection and environment from `src/api/postman/`:

1. Postman → **Import** → select both `.json` files.
2. Select the **WarehouseJobs — Local Dev** environment.
3. Run **System / Health Check** to verify the stack is up.

See `src/api/postman/README.md` for full details including CI (Newman) usage.

---

## Database

```bash
# Apply pending migrations (dev)
bun run api:db:migrate:dev

# Apply pending migrations (CI/production — no schema changes)
bun run api:db:migrate:deploy

# Open Prisma Studio (visual DB browser)
bun run api:db:studio

# Regenerate the Prisma client after schema changes
bun run api:db:generate
```

### Schema location

`src/api/prisma/schema.prisma` — this is the **source of truth** for the PostgreSQL structure.  
All schema changes must go through migrations (`prisma migrate dev`). Direct SQL modifications to the DB are not allowed.

### Upgrade Prisma

This project uses Prisma v6. To upgrade:

```bash
# Safe: update within v6 (no breaking changes)
bun add --dev prisma@^6 && bun add @prisma/client@^6

# Prisma v7 requires a migration — see docs/agent/standards/common/architecture.md
# for the datasource URL → prisma.config.ts migration guide before attempting v7.
```

> **Do not use `npm install` for Prisma.** This project uses Bun workspaces. Using npm in a Bun workspace causes `Cannot read properties of null (reading 'matches')`. Always use `bun add`.

---

## Environment Variables

All configuration lives in a **single root `.env`** (see `.env.example`). The API loads it via `../../.env` relative to `src/api/`. Never add a nested `src/api/.env`.

Key variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `TEST_DATABASE_URL` | Separate DB for integration tests |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | HS256 signing key (min 32 chars) |
| `JWT_REFRESH_SECRET` | Refresh token signing key (min 32 chars) |
| `STORAGE_ENDPOINT` | MinIO/R2 endpoint |
| `STORAGE_ACCESS_KEY` | S3 access key |
| `STORAGE_SECRET_KEY` | S3 secret key |
| `SWAGGER_API_KEY` | X-Api-Key for batch ingestion endpoints |
| `NODE_ENV` | `development` · `test` · `production` |

---

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`) runs on every push/PR:

1. **Lint** — `bun run api:lint:check`
2. **Type-check** — `bun run api:type-check`
3. **Unit tests + coverage** — `bun run api:test:cov`
4. **Integration tests** — real Postgres + Redis + MinIO services
5. **E2E tests** — full NestJS app via Supertest

Releases are automated via Semantic Release on pushes to `main` (`.github/workflows/release.yml`).

---

## Quality Gates

Before any PR merges:

```bash
bun run api:lint:check    # zero lint errors
bun run api:type-check    # zero TypeScript errors
bun run api:test:cov      # ≥90% coverage for changed services
bun run api:test:integration
bun run api:test:e2e
```

STOP conditions are defined in `CLAUDE.md`. No test may be committed while failing.

---

## Contributing

1. Read `CLAUDE.md` (constitution) and `AGENTS.md` (orchestration model).
2. Check the active phase in `docs/plan.md`.
3. Consult `docs/agent/standards/AGENT-TASK-INDEX.md` for the correct reading order for your task.
4. Create a branch: `feat/<task>` or `fix/<issue>`.
5. Run the full quality gate before opening a PR.
6. Use the `create-pr` skill (`docs/agent/skills/create-pr.md`) to structure your PR description.

### Architecture decisions

See `docs/agent/standards/common/architecture.md` for the definitive answer to "should this be in `core/` or `domains/`?".

### API contract

`docs/api/openapi.yaml` is the **source of truth**. No endpoint may be implemented that deviates from the spec without first updating the spec. See `CLAUDE.md §API Contract Rule`.

---

## Planned Phases

| Phase | Feature |
|---|---|
| 1 ✅ | Infrastructure: config, DB, auth guards, health, logging, queue, storage, SMS |
| 2 | Auth domain: register, login, logout, refresh, email verification, password reset |
| 3 | Jobs domain: CRUD, batch ingestion, deduplication, search |
| 4 | Batch API: partner feed ingestion, API key auth, status polling |
| 5 | Applications domain: apply, track, employer review |
| 6 | Companies & Admin: profiles, moderation, advertising |
