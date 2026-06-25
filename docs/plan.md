# WarehouseJobs.com — Master Development Plan

**Product**: WarehouseJobs.com
**Stack**: React 19 · TanStack Start · NestJS 10 · TypeScript · Prisma · PostgreSQL · Redis · BullMQ · MinIO → Cloudflare R2
**API Contract**: `[docs/api/openapi.yaml](./api/openapi.yaml)` — SwaggerHub: `redbonzai/warehousejobs-api`
**Testing**: Jest (unit · integration · E2E) — 90% unit coverage threshold (statements, branches, lines, functions)

---

## How to Read This Document

Each phase contains:

- **Objective** — what the phase achieves
- **Deliverable** — the demo-ready or gate artifact
- **Tasks** — fully specified implementation units, each with:
  - Owner persona (`Senior Engineer`, `Mid Engineer`, `QA Tester`)
  - Skills to apply (cross-references to `.cursor/skills/`)
  - Acceptance criteria
- **Quality Gate** — what must pass before the next phase begins

No code is written until a task's acceptance criteria are fully understood.
No phase begins until the prior phase's quality gate is cleared.

Each **API phase** (2–6) may include parallel **Frontend Integration** tasks (`FE-*` prefix). These wire existing TanStack Start routes to the NestJS API so phase demos can be validated visually (Postman/curl **and** browser), not only via Supertest. Phase 7 remains the Supabase **data migration** and final removal of direct Postgres calls — not the first time each screen touches the API.

---

## Frontend Integration Track — Current Inventory

**Already on NestJS API** (Phase 2 complete):

| Surface | Route(s) | API client |
| ------- | -------- | ---------- |
| Auth session | `/auth`, `/forgot-password`, `/reset-password`, `/verify-email` | `src/lib/api-client.ts`, `src/lib/auth.tsx` |
| Dev smoke | `/dev/diagnostics` | Health + `GET /api/v1/me` only |

**Still Supabase-backed** (~55 route/component files import `@/integrations/supabase/client`):

| Domain | Key routes / components | Backend phase that owns the API |
| ------ | ------------------------- | ------------------------------- |
| Public job board | `/jobs`, `/jobs/$slug`, `/jobs/category/*`, `/warehouse-jobs/*`, `jobs.json`, sitemap | Phase 3 |
| Employer | `/employer/*` (post, edit, applicants, billing, team, ads, analytics) | Phase 3, 5, 6 |
| Seeker | `/seeker/applications`, `/seeker/saved`, `/seeker/alerts`, `/seeker/profile` | Phase 5 |
| Admin | `/admin/*` (jobs, moderation, ads, users, companies, stats, …) | Phase 3, 4.5, 6 |
| Shared | `job-card`, `apply-dialog`, `ad-slot`, `site-settings`, checkout | Phase 3, 5, 6 |

**Machine-to-machine only** (no public UI in v1):

| Domain | Endpoints | Notes |
| ------ | --------- | ----- |
| Batch ingestion | `POST /api/v1/jobs/batch`, `GET …/status` | API-key auth; validated via Postman, curl, Swagger, and `/dev/diagnostics` dev panel |

**Demo doc convention**: `docs/demo/phase{N}-demo.md` + `./scripts/phase{N}-demo.sh` (same pattern as Phases 1–3).

---

## Personas


| Persona             | Responsibility                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------ |
| **Senior Engineer** | Architecture, contracts (YAML), module design, complex orchestration, security             |
| **Mid Engineer**    | CRUD services, DTOs, Prisma models, controllers, unit tests in test/unit/ (mirroring src/) |
| **QA Tester**       | Integration tests, E2E tests, coverage reports, phase gate sign-off                        |


Full persona definitions: `docs/agent/personas/`

---

## Skills Reference


| Skill                 | File                                              |
| --------------------- | ------------------------------------------------- |
| Coding Conventions    | `.cursor/skills/coding-conventions/SKILL.md`      |
| Module Design Pattern | `.cursor/skills/module-design-pattern/SKILL.md`   |
| Interface Designer    | `.cursor/skills/interface-designer/SKILL.md`      |
| Domain-Driven Design  | `.cursor/skills/domain-driven-design/SKILL.md`    |
| Canonical Type Reuse  | `.cursor/skills/canonical-type-reuse/SKILL.md`    |
| Testing               | `.cursor/skills/testing/SKILL.md`                 |
| Create PR             | `.cursor/skills/create-pr/SKILL.md`               |
| CI Monitoring         | `.cursor/skills/ci-monitoring-subagents/SKILL.md` |


---

## Repository Structure (API — `src/api/`)

```
src/api/
├── src/
│   ├── main.ts                        # Bootstrap entry point
│   ├── app.module.ts                  # Root NestJS module
│   ├── core/
│   │   ├── auth/                      # JWT guard, role guards, password hashing
│   │   ├── config/                    # ConfigModule, Zod env schema
│   │   ├── database/                  # PrismaModule (global singleton)
│   │   ├── error/                     # AppError hierarchy, GlobalExceptionFilter
│   │   ├── health/                    # GET /api/health (Terminus)
│   │   ├── logging/                   # Pino structured logger
│   │   ├── storage/                   # StorageService (MinIO/R2 via S3 SDK)
│   │   └── queue/                     # BullMQ module (Redis connection)
│   └── domains/
│       ├── auth/                      # Register, login, refresh, verify, reset
│       ├── jobs/                      # Admin post, vendor post, search, CRUD
│       ├── batch/                     # Bulk ingestion (JSON + CSV + BullMQ)
│       ├── notifications/             # Email/SMS orchestration, webhooks, campaigns, inbox
│       ├── applications/              # Quick apply, seeker pipeline, employer pipeline
│       ├── companies/                 # Employer company CRUD
│       └── admin/                     # Moderation, ads, stats, RBAC enforcement
├── test/
│   ├── unit/                          # All unit specs — mirrors src/ (NOT co-located)
│   ├── integration/                   # Real DB + Redis (Docker Compose required)
│   ├── e2e/                           # Supertest HTTP tests
│   ├── helpers/                       # Factories + Prisma test helpers
│   ├── jest-setup.ts                  # reflect-metadata + .env loader
│   ├── jest-unit.json                 # Unit Jest config (testMatch test/unit/**)
│   ├── jest-integration.json          # Integration Jest config
│   └── jest-e2e.json                  # E2E Jest config
├── prisma/
│   ├── schema.prisma                  # Source of truth for DB schema
│   ├── migrations/                    # Prisma migration history
│   └── seeds/                         # Deterministic seed data
├── package.json                       # Self-contained; no shared deps with frontend
├── nest-cli.json
├── jest.config.js                     # Defaults to test/jest-unit.json
├── tsconfig.json                      # Extends ../../tsconfig.base.json
└── .env.example                       # All env vars documented
```

---

## Phase 0 — Documentation & API Contract ✅ COMPLETE

**Timeline**: Day 1
**Completed**: 2026-06-12
**Deliverable**: All project documentation in place; OpenAPI spec live on SwaggerHub; human approval before any code is written.

### Objective

Establish the full documentation foundation: engineering constitution, agent orchestration model, phase plan, Cursor rules and skills, and the OpenAPI 3.0 contract on SwaggerHub.

---

### Task 0.1 — Establish Project Documentation

**Owner**: Senior Engineer
**Description**: Establish the full documentation structure for the WarehouseJobs platform.

**Files to create**:

- `CLAUDE.md` — engineering constitution
- `AGENTS.md` — agent orchestration model
- `docs/plan.md` — this document
- `.cursor/rules/*.mdc` — 10 Cursor rules
- `.cursor/skills/` — 9 reasoning workflow skills
- `docs/agent/standards/` — AGENT-TASK-INDEX + 8 standards docs
- `docs/agent/personas/` — 3 persona definitions
- `docs/agent/analysis/architecture.md` — WJ architecture

**Acceptance Criteria**:

- All source-precedence references in `CLAUDE.md` resolve to existing files
- Agent task index covers all task types expected during implementation phases
- `AGENTS.md` specifies all 5 agent roles with skills and collaboration patterns
- Cross-links between all documents are valid

---

### Task 0.2 — OpenAPI 3.0 Contract

**Owner**: Senior Engineer
**Description**: Author and publish the full OpenAPI spec.

**File**: `docs/api/openapi.yaml`
**SwaggerHub**: `https://app.swaggerhub.com/apis/redbonzai/warehousejobs-api/1.0.0`

**Endpoints covered** (27 total):

- System: `GET /api/health`, `GET /api/v1/me`
- Auth: register, login, logout, refresh, verify-email, forgot-password, reset-password (7)
- Jobs: POST, GET (search), GET /:slug, PATCH /:id, DELETE /:id (5)
- Batch: POST /batch, GET /batch/:batchId/status (2)
- Applications: POST apply, GET (seeker), GET employer/, PATCH /:id/status (4)
- Companies: POST, GET /:slug, PATCH /:id (3)
- Admin: GET jobs, PATCH feature, POST ads, GET ads, GET stats (5)

**Acceptance Criteria**:

- YAML validates with no errors against OpenAPI 3.0.3 schema
- Spec published to SwaggerHub under `redbonzai` org
- All schemas include examples
- All error responses use `Error` schema with `code` + `message`
- Human approval received before Phase 1 begins

---

### Phase 0 Quality Gate ✅

- [x] All documentation files committed and cross-links verified
- [x] `CLAUDE.md`, `AGENTS.md`, `docs/plan.md` created and interconnected
- [x] `.cursor/rules/` — 10 rule files (`constitution-core`, `typescript`, `testing-unit`, `testing-integration`, `testing-e2e`, `modules`, `security`, `anti-patterns`, `naming`, `canonical-types`)
- [x] `.cursor/skills/` — 9 skill files (`coding-conventions`, `module-design-pattern`, `testing`, `interface-designer`, `domain-driven-design`, `canonical-type-reuse`, `create-pr`, `ci-monitoring-subagents`, `deployments-github-actions`)
- [x] `docs/agent/standards/` — AGENT-TASK-INDEX + 8 standards docs (common/*, testing/*)
- [x] `docs/agent/personas/` — 3 personas (api-architect, backend-engineer, quality-sentinel)
- [x] `docs/agent/analysis/architecture.md` — full WJ architecture doc
- [x] `docs/api/openapi.yaml` — 27 endpoints, OpenAPI 3.0.3, 1,609 lines
- [x] `scripts/publish-swagger.sh` + `scripts/bump-api-version.sh` — publish pipeline ready
- [x] `docs/demo/` — `overview.html`, `overview.md`, `sms-cost-comparison.html`
- [x] Human approval of API contract received
- [x] SwaggerHub live publish — run `bun run api:publish` from terminal (requires unrestricted network; sandbox blocked outbound curl)

---

## Phase 1 — NestJS Scaffold + Core ✅ COMPLETE

**Timeline**: ~2 days
**Completed**: 2026-06-12
**Deliverable**: Runnable NestJS application with core infrastructure, Docker Compose, CI, and a working `GET /api/health` endpoint.

### Task 1.1 — Scaffold NestJS Repository Structure

**Owner**: Senior Engineer
**Skills**: Module Design Pattern, Coding Conventions

**Detailed Steps**:

1. Initialize `src/api/` as a self-contained NestJS app:

- `nest new warehousejobs-api --package-manager npm` (or bun equivalent)
- Move output into `src/api/`

1. Configure `tsconfig.json` extending `../../tsconfig.base.json`:

- `"paths"`: `@core/`_ → `src/core/`_, `@domains/`_→`src/domains/_`
- `module: NodeNext`, `target: ES2022`

1. Create root `tsconfig.base.json` with strict settings
2. Create `docker-compose.yml` at repo root with:

- `postgres:16-alpine` — port 5432, persistent volume
- `redis:7-alpine` — port 6379, persistent volume
- `minio/minio` — ports 9000/9001, persistent volume

1. Create `src/api/.env.example` with all required variables documented
2. Create directory skeleton per the Repository Structure above
3. Install base dependencies: `@nestjs/config`, `@nestjs/schedule`, `@nestjs/terminus`, `@nestjs/jwt`, `@nestjs/throttler`, `prisma`, `@prisma/client`, `ioredis`, `bullmq`, `@nestjs/bull`, `class-validator`, `class-transformer`, `pino`, `nestjs-pino`, `zod`, `@aws-sdk/client-s3`, `bcryptjs`, `uuid`
4. Configure ESLint for NestJS at `src/api/eslint.config.mjs` (flat config; ESLint 9)
5. Configure Jest at `src/api/jest.config.js` (+ `test/jest-unit.json`, `jest-integration.json`, `jest-e2e.json`); unit specs live in `test/unit/` mirroring `src/`

**Acceptance Criteria**:

- `npm run start:dev` starts without errors
- ESLint passes with zero violations
- `docker-compose up` starts Postgres, Redis, MinIO with health checks passing
- Path aliases resolve correctly
- All env vars in `.env.example` documented with type and description

---

### Task 1.2 — Configure PrismaModule and Database Connection

**Owner**: Mid Engineer
**Skills**: Module Design Pattern, Canonical Type Reuse

**Detailed Steps**:

1. Initialize Prisma: `npx prisma init` inside `src/api/`
2. Write `prisma/schema.prisma` — full schema matching existing Supabase tables + new fields:

- Add to `jobs`: `sourceType JobSourceType`, `externalId String?`, `sourceUrl String?`
- Add `users` table (replacing Supabase auth users)
- Add `refresh_tokens` table
- Add `email_verifications` table
- Add `password_resets` table
- Preserve all existing table relationships

1. Create `src/core/database/prisma.service.ts` — extends `PrismaClient`, `OnModuleInit/Destroy`
2. Create `src/core/database/database.module.ts` — `@Global()` module, exports `PrismaService`
3. Run initial migration: `npx prisma migrate dev --name init`

**Acceptance Criteria**:

- `PrismaService` connects to Docker Compose Postgres
- All migrations apply cleanly
- `PrismaService` injectable without re-importing `DatabaseModule`
- `source_type` enum, `external_id`, `source_url` present in `jobs` table

---

### Task 1.3 — Core Infrastructure Modules

**Owner**: Mid Engineer + Senior Engineer
**Skills**: Coding Conventions, Module Design Pattern

**Modules to create**:

1. **ConfigModule** (`src/core/config/`) — Zod schema, validates all env vars on boot
2. **LoggingModule** (`src/core/logging/`) — Pino JSON in prod, pretty-print in dev, `requestId` on every request
3. **ErrorModule** (`src/core/error/`) — `AppError`, `NotFoundError`, `ValidationError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`; `GlobalExceptionFilter` maps to HTTP codes
4. **HealthModule** (`src/core/health/`) — `GET /api/health` via `@nestjs/terminus`; checks: DB ping, Redis ping, MinIO ping
5. **StorageModule** (`src/core/storage/`) — `StorageService` wrapping `@aws-sdk/client-s3`; reads `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`
6. **QueueModule** (`src/core/queue/`) — BullMQ connection via Redis

**Acceptance Criteria**:

- `GET /api/health` returns `{ status: "ok", db: "up", redis: "up", storage: "up" }`
- Throwing `NotFoundError` returns HTTP 404 with `{ code: "NOT_FOUND", message: "..." }`
- All request logs include `requestId`, method, path, status, duration
- `StorageService.upload()` and `getSignedUrl()` work against local MinIO

---

### Task 1.4 — GitHub Actions CI Workflow

**Owner**: Senior Engineer
**Skills**: Deployments with GitHub Actions, CI Monitoring

**File**: `.github/workflows/ci.yml`

**Workflow steps**:

1. Checkout
2. Setup Node 24
3. Install dependencies (`npm ci` in `src/api/`)
4. `npm run lint`
5. `npm run type-check`
6. Start Docker Compose services (Postgres + Redis + MinIO)
7. Run Prisma migrations against test DB
8. `npm run test` (unit)
9. `npm run test:integration`
10. `npm run test:e2e`
11. `npm run test:cov` — fail if < 90% on any global coverage metric (statements, branches, lines, functions)

**Acceptance Criteria**:

- CI passes green on the main branch
- Integration and E2E tests run against the Docker Compose services in CI
- Coverage report uploaded as a CI artifact

---

### Task 1.5 — Core Tests

**Owner**: QA Tester
**Skills**: Testing

**Tests to write**:

- Unit: `PrismaService` mock connection lifecycle
- Unit: `GlobalExceptionFilter` maps all error types to correct HTTP status
- Unit: `StorageService` upload / signed-URL generation (mocked S3 client)
- Integration: `GET /api/health` — real Postgres + Redis + MinIO via Docker Compose
- Integration: Config validation fails on missing required env vars

**Acceptance Criteria**:

- All tests pass
- `GET /api/health` integration test confirms all three dependency checks

---

### Phase 1 Quality Gate

Before Phase 2 begins:

- [x] `npm run start:dev` starts without errors or warnings
- [x] `npm run lint` passes with zero violations
- [x] `GET /api/health` returns 200 with all dependencies healthy
- [x] Prisma migrations applied cleanly
- [x] All core module unit tests pass
- [x] Integration test for `/health` passes
- [x] CI workflow green on main branch

---

## Phase 2 — Auth Domain

**Timeline**: ~2 days
**Deliverable**: Full JWT authentication system — register, login, email verification, password reset, token refresh.

### Task 2.1 — Auth Service (Register + Login)

**Owner**: Mid Engineer
**Skills**: Coding Conventions, Module Design Pattern

**Endpoints**: `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `POST /auth/refresh`

**Detailed Steps**:

1. Create `src/domains/auth/dtos/RegisterDto.ts`, `LoginDto.ts`, `RefreshTokenDto.ts`
2. Create `src/domains/auth/AuthService.ts`:

- `register(dto)` — hashes password with `bcryptjs`, inserts `users` row, queues verification email
- `login(dto)` — validates credentials, issues access token (15 min) + refresh token (30 days)
- `logout(userId)` — revokes refresh token
- `refreshTokens(token)` — validates refresh token, issues new pair (rotation)

1. Create `src/core/auth/JwtStrategy.ts` — Passport JWT strategy
2. Create `src/core/auth/JwtAuthGuard.ts`, `RolesGuard.ts`, `@Roles()` decorator
3. Create `src/domains/auth/AuthController.ts`

**Acceptance Criteria**:

- `POST /auth/register` creates user, returns 201 with `userId`
- `POST /auth/login` returns `accessToken`, `refreshToken`, `expiresIn`
- `POST /auth/refresh` rotates tokens correctly
- Incorrect password returns 401 (not 422)
- Duplicate email returns 409

---

### Task 2.2 — Email Verification + Password Reset

**Owner**: Mid Engineer
**Skills**: Coding Conventions

**Endpoints**: `POST /auth/verify-email`, `POST /auth/forgot-password`, `POST /auth/reset-password`

**Detailed Steps**:

1. Create `EmailService` in `src/core/` — wraps Resend (or SendGrid) via env `EMAIL_PROVIDER`
2. Verification flow:

- On register: insert `email_verifications` row with 24h expiry, send link
- `verify-email`: validate token, mark user `emailVerifiedAt = now()`

1. Password reset flow:

- `forgot-password`: always return 200; if email exists, insert `password_resets` row (1h expiry) and send email
- `reset-password`: validate token, hash new password, revoke all refresh tokens

**Acceptance Criteria**:

- Verification token expires after 24h; expired token returns 400
- `forgot-password` returns 200 even for unregistered emails (prevents enumeration)
- Password reset revokes all existing refresh tokens for the user
- Unit tests cover all token expiry and rotation cases

---

### Task 2.3 — Auth Tests

**Owner**: QA Tester

**Tests**:

- Unit: `AuthService.register()` — happy path, duplicate email, password hashing
- Unit: `AuthService.login()` — valid credentials, invalid credentials, unverified email
- Unit: token refresh rotation, revocation
- Unit: password reset flow — token validation, expiry, revocation
- Integration: full register → verify → login flow against real DB
- E2E: all 7 auth endpoints via Supertest

**Acceptance Criteria**: All tests pass; coverage ≥ 90% for `AuthService`

---

### Phase 2 Quality Gate

- [x] All 7 auth endpoints return correct HTTP status codes per OpenAPI spec
- [x] Token rotation works (refresh revokes old token)
- [x] Email verification flow: unverified user cannot access protected endpoints
- [x] All auth unit + integration + E2E tests pass
- [x] Coverage ≥ 90% for `AuthService` and `AuthController`
- [x] Phase 1 backwards-compat tests pass (`phase1-backwards-compat` E2E + integration)
- [x] `./scripts/phase2-demo.sh` passes; Phase 1 `GET /api/health` smoke included
- [x] `docs/demo/phase2-demo.md` Postman + frontend walkthrough complete
- [x] `bun run api:validate` passes

See `[docs/agent/standards/common/backwards-compatibility.md](./agent/standards/common/backwards-compatibility.md)`.

---

## Phase 3 — Jobs Domain

**Timeline**: ~3 days
**Deliverable**: Job CRUD for admin and vendor posting; full-text search.

### Task 3.1 — Jobs Service (Admin + Vendor Post)

**Owner**: Mid Engineer
**Skills**: Coding Conventions, Module Design Pattern

**Endpoints**: `POST /jobs`, `GET /jobs`, `GET /jobs/:slug`, `PATCH /jobs/:id`, `DELETE /jobs/:id`

**Detailed Steps**:

1. Create DTOs: `CreateJobDto`, `UpdateJobDto`, `JobSearchDto`
2. Create `JobsService`:

- `create(dto, user)` — role-gated: admin can specify any `companyId`; vendor uses their company
- For vendor: validate `companyPackageId` has remaining credits; decrement on success
- Generate URL slug from title + city + state (unique)
- `search(dto)` — full-text search + filter + pagination + priority ordering (direct/api above scraped)
- `findBySlug(slug)` — increments view counter
- `update(id, dto, user)` — ownership check for vendor
- `softDelete(id, user)` — sets status = closed

1. Create `JobsController` — wire guards: `@UseGuards(JwtAuthGuard, RolesGuard)`
2. Handle screening questions atomically on create

**Acceptance Criteria**:

- Vendor cannot post without a valid `companyPackageId` with remaining credits
- Slug is URL-safe and unique
- Search results: `direct`/`api` posts rank above `scraped` at same recency
- Soft delete sets status = `closed`, does not delete the row

---

### Task 3.2 — Jobs Tests

**Owner**: QA Tester

**Tests**:

- Unit: `JobsService.create()` — happy path (admin), happy path (vendor), insufficient credits
- Unit: `JobsService.search()` — priority ordering, filters, pagination
- Unit: slug generation uniqueness
- Integration: full create → search → get → update → close flow
- E2E: all 5 Jobs endpoints via Supertest, including 403 on wrong role

**Acceptance Criteria**: All tests pass; coverage ≥ 90%

---

### Task 3.3 — Frontend: Jobs API Integration (FE-3)

**Owner**: Mid Engineer
**Skills**: Coding Conventions
**Depends on**: Task 3.2 (API tests green)

**Scope** — replace Supabase job reads/writes with NestJS API in:

1. `src/lib/api-client.ts` — add typed jobs methods (`search`, `getBySlug`, `create`, `update`, `delete`)
2. Public board: `/jobs`, `/jobs/$slug`, category and city landing pages
3. Employer: `/employer/jobs/new`, `/employer/jobs/$id/edit`, employer dashboard job list
4. Admin: `/admin/jobs` moderation list (read + status actions that map to PATCH/DELETE)
5. Extend `/dev/diagnostics` — jobs search + detail panels (dev-only visual gate)

**Acceptance Criteria**:

- `/jobs` lists jobs from `GET /api/v1/jobs` (not Supabase)
- Admin POST from `/employer/jobs/new` hits Nest API; vendor credit error surfaces in UI
- `/dev/diagnostics` can search and open a job slug without Postman
- Phase 3 demo doc Part C updated: browser steps replace “still Supabase-backed” caveat
- No new Supabase imports in touched files
- `data-testid="jobs-from-api"` on `/jobs` list (for `scripts/validate-phase4-frontend.sh`)

---

### Phase 3 Quality Gate

- [x] All 5 jobs endpoints per OpenAPI spec pass E2E tests
- [x] Vendor credit deduction works atomically
- [x] Search priority ordering confirmed by integration test
- [x] Coverage ≥ 90% for `JobsService`
- [x] `bun run api:contract:check` passes (implemented routes ↔ spec)
- [x] `docs/demo/phase3-demo.md` + `./scripts/phase3-demo.sh` complete
- [x] Task 3.3 (FE-3) complete — public job board and employer posting use Nest API

---

## Phase 4 — Batch Ingestion

**Timeline**: ~2 days
**Deliverable**: Bulk job ingestion endpoint handling JSON arrays and CSV; async BullMQ processing; deduplication.

### Task 4.1 — Batch Controller + Service

**Owner**: Senior Engineer + Mid Engineer
**Skills**: Coding Conventions, Module Design Pattern

**Endpoints**: `POST /jobs/batch`, `GET /jobs/batch/:batchId/status`

**Detailed Steps**:

1. Create `BatchJobItemDto` — mirrors `BatchJobItem` schema in OpenAPI spec
2. Create `BatchService`:

- Parse JSON array or CSV (using `csv-parse`)
- Validate each item with `class-validator`
- ≤100 items: process synchronously, return `BatchStatus`
- > 100 items: enqueue BullMQ job, return `BatchResponse` with `batchId` (202)

1. Create `BatchWorker` (BullMQ processor):

- Process in chunks of 50
- Dedup by `externalId`: skip if unchanged, update if content differs
- Track: created / updated / skipped / failed counts
- Write status to Redis; persist final status to `batch_jobs` table

1. Create `BatchController` — auth: `ApiKeyAuth` or `BearerAuth` (admin only)
2. Add `batch_jobs` table to Prisma schema

**Acceptance Criteria**:

- 100-job JSON batch processed synchronously < 5 s
- 1,000-job batch queued, processed < 30 s, status correctly polled
- `externalId` deduplication: unchanged jobs counted as `skipped`, changed jobs as `updated`
- Invalid rows reported in `errors[]` array, valid rows still processed
- CSV: header row required; UTF-8 encoding; pipe to `csv-parse`

---

### Task 4.2 — Batch Tests

**Owner**: QA Tester

**Tests**:

- Unit: deduplication logic (same `externalId`, changed content)
- Unit: CSV parsing — valid file, missing header, malformed row
- Unit: BullMQ worker chunking and error collection
- Integration: 50-job JSON batch → confirm DB count
- Integration: 500-job batch → poll status until complete
- Load test: 1,000-job batch completes < 30 s (documented, not gated)
- E2E: `POST /jobs/batch` (JSON), `GET /jobs/batch/:batchId/status`

---

### Task 4.3 — Phase 4 Demo + Contract Artifacts

**Owner**: QA Tester
**Skills**: Testing

**Deliverables**:

1. `./scripts/phase4-demo.sh` — mirrors phase3-demo.sh: env, docker, migrate, lint, type-check, `api:validate`, `api:contract:check`, unit + integration + E2E, coverage ≥ 90%, live batch smoke (sync ≤100 + async poll >100), Phase 1 backwards-compat smoke
2. `docs/demo/phase4-demo.md` — step-by-step visual validation:
   - **Part A** Postman folder “Phase 4 — Walkthrough” (JSON batch, CSV batch, status poll, dedup re-run, invalid rows)
   - **Part B** curl recipes (API-key header, sync vs 202 async)
   - **Part C** Swagger UI (`/api/docs`)
   - **Part D** Frontend: FE-3 jobs board + FE-4 batch diagnostics panel (`validate-phase4-frontend.sh`)
   - **Part E** DB verification queries (`batch_jobs`, job counts, `external_id` dedup)
3. Update `src/api/postman/warehousejobs.postman_collection.json` — replace Phase 4 placeholder tests
4. Resolve OpenAPI ↔ code drift (e.g. mark implemented routes `x-implemented: true`; align CSV ingest path with spec)
5. Root `package.json` script: `"demo:phase4": "bash scripts/phase4-demo.sh"`

**Acceptance Criteria**: Demo script exits 0 on a clean checkout; human can follow the markdown doc without guessing.

---

### Task 4.4 — Frontend: Batch Dev Panel + Admin Source Badge (FE-4)

**Owner**: Mid Engineer
**Skills**: Coding Conventions
**Depends on**: Task 4.3 (API demo green); FE-3 recommended for end-to-end browser proof

**Scope**:

1. `/dev/diagnostics` — batch ingest dev panel: paste `X-Api-Key`, submit small JSON batch (≤5 items), poll status, show counts
2. `src/lib/api-client.ts` — `submitBatch`, `getBatchStatus` (API-key header, not JWT)
3. After FE-3: admin/employer job lists show `source` badge (`batch` / `scraped` / `direct`) from API response

**Acceptance Criteria**:

- Developer can ingest and poll a batch entirely from the browser at `/dev/diagnostics`
- No Supabase calls added; panel hidden in production builds (same guard as diagnostics route)
- Phase 4 demo Part D passes without Postman

**Demo markers** (for `scripts/validate-phase4-frontend.sh`):

- `data-testid="batch-ingest-panel"` on batch panel
- `apiClient.submitBatch` + `getBatchStatus` in `src/lib/api-client.ts`

**Note**: Batch ingestion remains partner/scraper-facing in production; this UI is a **dev validation surface**, not a customer feature.

---

### Phase 4 Quality Gate

- [x] 1,000-job batch ingests cleanly; all jobs appear in `GET /jobs`
- [x] WJ direct posts rank above scraped in search results (confirmed by test)
- [x] Deduplication correct (created/updated/skipped counts accurate)
- [x] All batch tests pass; coverage ≥ 90% on all global metrics
- [x] `bun run api:contract:check` passes
- [x] `./scripts/phase4-demo.sh` passes; Phase 1 `GET /api/health` smoke included
- [x] `docs/demo/phase4-demo.md` Postman + curl + browser walkthrough complete
- [x] Task 4.4 (FE-4) complete — diagnostics batch panel works

---

## Phase 4.5 — Notifications Domain (Email · SMS · Webhooks · WebSockets)

**Timeline**: ~4–5 days
**Deliverable**: Notifications bounded context — Resend email + Twilio SMS outbound, inbound webhooks (SMS + email), in-app inbox with WebSocket push, phone/email OTP verification, vendor/admin 2FA, and admin marketing campaigns with full opt-in compliance.

**Provider strategy** (confirmed): **Resend** for email, **Twilio** for SMS (Verify + Programmable Messaging). Existing `EmailService` / `SmsService` in `src/core/` remain thin adapters; orchestration moves to `domains/notifications/`.

**Prior art** (Phase 2 partial): Auth already sends verification/reset email via `EmailService` and optional password-reset SMS via `SmsService`. Phase 4.5 refactors auth (and later domains) to call `NotificationsService` instead of adapters directly, and adds everything below.

### Task 4.5.0 — OpenAPI Contract + Interface Design

**Owner**: Senior Engineer
**Skills**: Domain-Driven Design, Interface Designer, Canonical Type Reuse, Module Design Pattern

**Status**: OpenAPI + YAML contract implemented; `bun run api:validate` and `bun run api:contract:check` pass.

**Artifacts**:

- `docs/api/openapi.yaml` — Notifications, Webhooks, Admin — Campaigns, Auth OTP/2FA paths added (`bun run api:validate` passes)
- `docs/agent/analysis/contracts/notifications-service.yaml` — `NotificationsService`, `CampaignService`, `InboundMessageHandler`, `NotificationGateway`

**OpenAPI additions** (spec-first — no implementation until approved):

| Area | Endpoints |
| ---- | --------- |
| In-app inbox | `GET /api/v1/notifications`, `PATCH /api/v1/notifications/:id/read`, `POST /api/v1/notifications/read-all` |
| Preferences | `GET /api/v1/notifications/preferences`, `PATCH /api/v1/notifications/preferences` |
| OTP / 2FA | `POST /api/v1/auth/send-otp`, `POST /api/v1/auth/verify-otp`, `POST /api/v1/auth/enable-2fa`, `POST /api/v1/auth/verify-2fa` |
| Inbound webhooks | `POST /api/v1/webhooks/twilio/sms`, `POST /api/v1/webhooks/resend/inbound` (`@Public()`, signature-validated) |
| Admin campaigns | `POST /api/v1/admin/campaigns`, `GET /api/v1/admin/campaigns`, `GET /api/v1/admin/campaigns/:id`, `POST /api/v1/admin/campaigns/:id/send`, `GET /api/v1/admin/campaigns/:id/stats` |

**YAML contract**: `NotificationsService`, `CampaignService`, `InboundMessageHandler`, `NotificationGateway` (WebSocket — documented in analysis doc + gateway README; not REST OpenAPI).

**Acceptance Criteria**:

- `docs/api/openapi.yaml` updated and `bun run api:validate` passes
- Human approval on YAML contract before Task 4.5.1 begins
- Bounded context confirmed: notifications owns delivery, preferences, campaigns, inbound routing; auth owns credentials; other domains emit events only

---

### Task 4.5.1 — Prisma Schema + Module Scaffold

**Owner**: Senior Engineer + Mid Engineer
**Skills**: Module Design Pattern, Coding Conventions

**Tables**:

- `notifications` — in-app inbox (mirrors legacy Supabase shape: `userId`, `title`, `body`, `link`, `type`, `readAt`, `senderId`)
- `notification_preferences` — per-user channel toggles (`emailTransactional`, `emailMarketing`, `smsTransactional`, `smsMarketing`, `inApp`)
- `notification_deliveries` — outbound audit log (`channel`, `template`, `status`, `providerId`, `error`)
- `marketing_consents` — explicit opt-in timestamps + source (register, settings, campaign)
- `sms_opt_outs` — STOP / unsubscribe registry (TCPA)
- `notification_campaigns` — admin broadcasts (segment, template, schedule, status)
- `otp_challenges` — phone/email OTP state (Twilio Verify SID or hashed email OTP)
- `user_mfa` — TOTP or SMS second factor for vendor/admin (`enabledAt`, `method`)

**Module**: `src/domains/notifications/` — barrel exports `NotificationsService` only.

**Acceptance Criteria**:

- Migration applies cleanly; factories in `test/helpers/`
- `NotificationsModule` registered in `app.module.ts`
- Auth domain refactored to inject `NotificationsService` (no direct `EmailService`/`SmsService` in domain services)

---

### Task 4.5.2 — Outbound Orchestration + BullMQ Worker

**Owner**: Mid Engineer
**Skills**: Coding Conventions, Module Design Pattern

**Detailed Steps**:

1. `NotificationsService.send(request)` — routes by `NotificationKind` (`auth`, `transactional`, `marketing`) and channel (`email`, `sms`, `in_app`)
2. Template registry — auth (verify, reset, welcome), transactional placeholders for Phase 5
3. `NotificationWorker` on `QUEUE_NOTIFICATIONS` — async delivery, retry with backoff, dead-letter after N failures
4. Marketing sends blocked unless `marketing_consents` + preference allow; transactional/auth exempt from marketing opt-out where legally required
5. Idempotency key on delivery records to prevent duplicate sends

**Acceptance Criteria**:

- Register → verification email queued and delivered (or dev console log)
- Password reset email + optional SMS alert via orchestrator
- Failed Resend/Twilio calls retried; permanent failures logged in `notification_deliveries`
- Unit tests for routing, consent gates, idempotency

---

### Task 4.5.3 — Phone/Email OTP + Vendor/Admin 2FA

**Owner**: Mid Engineer
**Skills**: Coding Conventions, security standard

**Flows**:

- **Register/login verification**: Twilio Verify OTP for phone; email OTP via Resend (6-digit, short TTL) as alternative or complement to link-based verify
- **Vendor/admin 2FA**: strongly recommended at onboarding; enforceable flag `requireMfaForRole` in config; SMS or email OTP step after password on login
- OTP endpoints match OpenAPI; rate-limited (`5/minute/IP`)

**Acceptance Criteria**:

- Unverified phone/email blocks protected endpoints per product rule
- Vendor login with MFA enabled requires second step
- Brute-force protection on OTP verify (lockout after N failures)
- No OTP codes logged or returned in API responses

---

### Task 4.5.4 — Inbound Webhooks (SMS + Email)

**Owner**: Senior Engineer + Mid Engineer
**Skills**: Coding Conventions, security standard

**Twilio SMS webhook** (`POST /webhooks/twilio/sms`):

- Validate `X-Twilio-Signature`
- Handle `STOP` / `UNSUBSCRIBE` → `sms_opt_outs`; auto-reply confirmation
- Handle `HELP` → compliance auto-reply
- Route conversational replies (e.g. reply-to-apply) to `InboundMessageHandler` — persist thread, emit in-app notification

**Resend inbound webhook** (`POST /webhooks/resend/inbound`):

- Validate webhook signature
- Parse reply-to addresses or inbound parse payload
- Route to same `InboundMessageHandler`

**Acceptance Criteria**:

- Invalid signatures → 403
- STOP on marketing number suppresses future marketing SMS for that E.164
- Inbound message creates in-app notification + optional WebSocket push
- Integration tests with fixture payloads (no live Twilio/Resend in CI)

---

### Task 4.5.5 — In-App Inbox + WebSocket Gateway

**Owner**: Mid Engineer
**Skills**: Module Design Pattern, Coding Conventions

**REST**: paginated `GET /notifications`, mark read, read-all.

**WebSocket** (`NotificationGateway`):

- JWT on connection (`WsJwtGuard`)
- Room per `userId`
- Push `{ type: 'notification.created', payload }` on new inbox row or inbound message
- Reconnect-safe: client syncs via REST on connect, then listens for deltas

**Acceptance Criteria**:

- Authenticated user receives WebSocket event within 1 s of outbound/inbound trigger (integration test with mocked gateway broadcast)
- Unauthenticated WebSocket connection rejected
- Phase 1 backwards-compat unaffected (no change to `/api/health`, `/api/v1/me`)

---

### Task 4.5.6 — Admin Marketing Campaign Platform

**Owner**: Senior Engineer + Mid Engineer
**Skills**: Interface Designer, Coding Conventions

**Capabilities**:

- Create campaign: name, channel(s), segment (role, geo, job category, custom filter), HTML/text template, schedule (immediate or scheduled via BullMQ)
- Preview + test send to admin
- Send: chunked through `NotificationWorker`; track sent/delivered/bounced/opt-out counts
- CAN-SPAM: physical address footer in marketing email templates; unsubscribe link
- TCPA: SMS marketing only to opted-in numbers; STOP honored within webhook handler

**Acceptance Criteria**:

- Admin creates email campaign → segment of opted-in seekers receives email
- Campaign stats reflect delivery log counts
- Non-opted-in users excluded; opt-out users never receive marketing
- `@Roles('admin')` on all campaign endpoints

---

### Task 4.5.7 — Notifications Tests + Demo

**Owner**: QA Tester
**Skills**: Testing

**Tests**:

- Unit: template rendering, consent gates, OTP flows, webhook signature validation
- Unit: `NotificationWorker` retry/dead-letter
- Integration: outbound email/SMS (mocked providers), inbound webhook → inbox row
- Integration: WebSocket connect + receive push (test gateway)
- E2E: preferences update, inbox CRUD, OTP verify, admin campaign create/send (mocked delivery)
- E2E: `phase1-backwards-compat` still passes

**Demo**: `./scripts/phase4.5-demo.sh` + `docs/demo/phase4.5-demo.md` (Postman webhooks + WebSocket client snippet)

**Acceptance Criteria**: Coverage ≥ 90% for `NotificationsService`, `CampaignService`, webhook controllers; all tests pass

---

### Task 4.5.8 — Frontend: Notifications Inbox + Preferences (FE-4.5)

**Owner**: Mid Engineer
**Skills**: Coding Conventions
**Depends on**: Task 4.5.5 (REST inbox + WebSocket gateway)

**Scope**:

1. `src/lib/api-client.ts` — notifications list, mark read, read-all, preferences GET/PATCH
2. WebSocket client hook — connect with JWT, handle `notification.created`, sync on reconnect
3. Seeker `/seeker` overview — unread badge; optional dedicated inbox route if not present
4. `/seeker/privacy` or settings — channel preference toggles wired to API
5. Vendor/admin login — MFA step UI when `requireMfaForRole` enabled (Task 4.5.3)
6. Admin `/admin` — campaign create/send UI wired to `/api/v1/admin/campaigns/*` (replaces any Supabase campaign stubs)
7. Extend `/dev/diagnostics` — WebSocket connection tester

**Acceptance Criteria**:

- Authenticated user sees inbox rows from `GET /api/v1/notifications` (not Supabase)
- New notification appears in UI within 1 s of trigger (WebSocket or poll fallback)
- Marketing preference toggles persist via API
- Phase 4.5 demo doc includes browser steps for inbox + preferences

---

### Phase 4.5 Quality Gate

Before Phase 5 begins:

- [x] OpenAPI spec includes all notification/OTP/webhook/campaign endpoints; `bun run api:validate` passes
- [x] Auth flows use `NotificationsService`; verification email + OTP paths work
- [x] Vendor/admin MFA path documented and test-covered
- [x] Inbound Twilio + Resend webhooks validated; STOP/opt-out enforced
- [x] WebSocket inbox push works for authenticated users (in-process gateway + poll fallback on FE)
- [x] Admin marketing campaign send respects opt-in; stats accurate
- [x] `bun run api:contract:check` passes
- [x] `./scripts/phase4.5-demo.sh` passes; Phase 1 `GET /api/health` smoke included
- [x] All notification unit + integration + E2E tests pass; coverage ≥ 90%
- [x] `phase1-backwards-compat` E2E suite passes
- [x] Task 4.5.8 (FE-4.5) complete — inbox, preferences, and MFA UI on Nest API

---

## Phase 5 — Applications Domain

**Timeline**: ~2 days
**Deliverable**: Quick-apply (60 s, unauthenticated or authenticated); seeker application list; employer pipeline.

### Task 5.1 — Quick Apply

**Owner**: Mid Engineer
**Skills**: Coding Conventions

**Endpoint**: `POST /jobs/:jobId/apply`

**Detailed Steps**:

1. Create `ApplyDto` — mirrors OpenAPI `ApplyRequest` schema
2. `ApplicationsService.apply(jobId, dto, user?)`:

- Unauthenticated: require `name` + `phone` in body
- Authenticated: pull seeker profile snapshot (name, phone, skills, certifications)
- Validate required screening question answers
- If `interviewSlotId` provided: book slot atomically
- Rate limit: 10 applications per IP per hour (authenticated: per user)
- Duplicate check: 409 if already applied

1. Optional resume: if `resumeUrl` provided, store reference; no upload in apply path (upload handled separately via `POST /uploads/resume`)
2. On successful apply: emit `NotificationsService` events — seeker confirmation (SMS/email per preferences), employer new-applicant alert

**Acceptance Criteria**:

- Unauthenticated apply with name + phone + ZIP → 201 in < 3 s server time
- Authenticated apply with missing required screening answers → 422
- Duplicate apply → 409
- Interview slot booking is atomic (slot.booked_count incremented in same transaction)
- Rate limit enforced: 11th application in same hour → 429

---

### Task 5.2 — Seeker + Employer Pipeline

**Owner**: Mid Engineer

**Endpoints**: `GET /applications`, `GET /employer/applications`, `PATCH /applications/:id/status`

**State machine**:

- `new → reviewing → shortlisted → interview → offer → hired` (happy path)
- `any → rejected` (employer action)
- `any → withdrawn` (seeker action)
- Invalid transitions → 400

**Acceptance Criteria**:

- Seeker sees only their own applications with correct status (fixes Blocker B2)
- Employer sees only applications for their company's jobs
- Status update writes an audit log entry
- Status change triggers `NotificationsService.sendApplicationUpdate()` (email/SMS per user preferences — Phase 4.5)
- Invalid state transition returns 400 with transition path in error details

---

### Task 5.3 — Applications Tests

**Owner**: QA Tester

**Tests**:

- Unit: `apply()` — unauthenticated, authenticated, duplicate, rate limit, screening validation
- Unit: state machine — all valid transitions, all invalid transitions
- Integration: full apply → view in seeker list → update status → view in employer pipeline
- E2E: all 4 application endpoints via Supertest

---

### Task 5.4 — Frontend: Quick Apply + Pipelines (FE-5)

**Owner**: Mid Engineer
**Skills**: Coding Conventions
**Depends on**: Task 5.3; FE-3 (jobs detail page)

**Scope**:

1. `src/lib/api-client.ts` — apply, seeker applications list, employer pipeline, status PATCH
2. `apply-dialog` / job detail — `POST /api/v1/jobs/:jobId/apply` (guest + authenticated paths)
3. `/seeker/applications` — list from Nest API with status badges
4. `/employer/jobs/$id/applicants` — employer pipeline + status transitions
5. Rate-limit and duplicate-apply errors surfaced in UI (409, 429)
6. Extend `/dev/diagnostics` — quick-apply smoke form

**Acceptance Criteria**:

- Guest can apply from job detail without Supabase
- Seeker sees only their applications; employer sees only their company's applicants
- Status change in employer UI reflects in seeker list after refresh
- Phase 5 demo doc includes full browser walkthrough (apply → pipeline → status update)

---

### Phase 5 Quality Gate

- [ ] Unauthenticated apply returns 201 < 3 s server time
- [ ] Seeker `GET /applications` shows correct applications (B2 resolved)
- [ ] Employer pipeline returns correct applicants; status transitions work
- [ ] All application tests pass; coverage ≥ 90%
- [ ] Task 5.4 (FE-5) complete — apply flow and both pipelines on Nest API

---

## Phase 6 — Admin, Advertising & RBAC

**Timeline**: ~2 days
**Deliverable**: Admin moderation queue, ad campaign CRUD, platform stats, full RBAC enforcement.

### Task 6.1 — Admin Domain

**Owner**: Mid Engineer

**Endpoints**: `GET /admin/jobs`, `PATCH /admin/jobs/:id/feature`, `POST /admin/ads`, `GET /admin/ads`, `GET /admin/stats`

**Detailed Steps**:

1. `AdminJobsService`: paginated moderation queue, status filter, bulk status update
2. `AdminFeatureService`: toggle featured flag + `featuredUntil` date
3. `AdvertisementsService`: create campaign with slot + schedule + targeting; `status` lifecycle (active/paused/ended)
4. `AdminStatsService`: aggregate counts — jobs, applications, users, revenue (from `orders` table)
5. Enforce `@Roles('admin')` on all admin routes
6. Ad/promotional **email/SMS bursts** use `CampaignService` from notifications domain (Phase 4.5) — not duplicate send logic here

**Acceptance Criteria**:

- Non-admin JWT → 403 on all admin endpoints
- `GET /admin/stats` returns accurate counts (verified by seeding test data)
- Ad campaign creation with past `endDate` → 422

---

### Task 6.2 — Companies Domain

**Owner**: Mid Engineer

**Endpoints**: `POST /companies`, `GET /companies/:slug`, `PATCH /companies/:id`

**Acceptance Criteria**:

- Vendor cannot update another company's profile → 403
- Company slug is URL-safe and unique
- Active job listings included in `GET /companies/:slug` response

---

### Task 6.3 — Admin + Companies Tests

**Owner**: QA Tester

**Tests**:

- Unit + integration + E2E for all admin and company endpoints
- RBAC: seeker and vendor tokens rejected on admin routes (403)
- E2E: create company → post job as vendor → admin features it → admin sees in stats

---

### Task 6.4 — Frontend: Admin + Companies (FE-6)

**Owner**: Mid Engineer
**Skills**: Coding Conventions
**Depends on**: Task 6.3; FE-3, FE-5 recommended

**Scope**:

1. `src/lib/api-client.ts` — admin jobs queue, feature toggle, ads CRUD, stats; companies CRUD
2. Admin routes: `/admin/jobs`, `/admin/moderation`, `/admin/ads`, `/admin` dashboard stats — Nest API
3. `/companies/$slug` — public company profile + active jobs from API
4. Employer `/employer/onboarding` — company create via `POST /api/v1/companies`
5. RBAC: hide admin nav items when `/api/v1/me` role ≠ admin (align with existing permission map)
6. Remaining Supabase-only admin surfaces (users, roles, billing, packages) — document as **Phase 7 cutover** if no OpenAPI endpoint yet

**Acceptance Criteria**:

- Admin can feature a job and see updated stats without Supabase
- Vendor company profile update hits `PATCH /api/v1/companies/:id`
- Non-admin receives 403-equivalent UX (redirect or error state), not silent Supabase fallback
- Phase 6 demo doc includes Postman + browser admin walkthrough

---

### Phase 6 Quality Gate

- [ ] All admin endpoints return 403 for non-admin roles
- [ ] Ad campaigns activate/deactivate correctly by date
- [ ] `GET /admin/stats` returns accurate numbers
- [ ] All admin and company tests pass; coverage ≥ 90%
- [ ] Task 6.4 (FE-6) complete — admin moderation, ads, stats, and company pages on Nest API

---

## Phase 7 — Data Migration & Supabase Decommission

**Timeline**: ~3 days
**Deliverable**: Full Supabase → own PostgreSQL data migration; **zero** direct Supabase Postgres calls in `src/`; remaining admin/billing surfaces cut over or explicitly scoped out.

**Prior art**: FE-3 through FE-6 wire the primary product surfaces to the NestJS API incrementally during Phases 3–6. Phase 7 is **not** the first browser integration — it is data cutover, straggler routes, and dependency removal.

### Task 7.1 — Data Migration Script

**Owner**: Senior Engineer

**Steps**:

1. Export all data from Supabase (users, companies, jobs, applications, etc.)
2. Write `prisma/seeds/migrate-from-supabase.ts` — idempotent migration script
3. Migrate users: create `users` rows from Supabase `auth.users` export; mark passwords as `REQUIRES_RESET`; set `migrationSource = supabase`
4. Send password-reset emails to all migrated users via `NotificationsService`
5. Migrate Supabase `notifications` table rows → `notifications` (Phase 4.5 schema)
6. Migrate all other tables in dependency order (companies → jobs → applications → etc.)
7. Validate row counts match

**Acceptance Criteria**:

- Migration script is idempotent (safe to run multiple times)
- All foreign key relationships preserved
- User count in own DB matches Supabase export count
- Password reset emails queued for all migrated users

---

### Task 7.2 — Frontend Stragglers + Supabase Removal

**Owner**: Senior Engineer + Mid Engineer

**Steps**:

1. Audit: `rg '@/integrations/supabase' src/` — every remaining import mapped to an API endpoint or deleted feature
2. Cut over stragglers not covered by FE-3…FE-6 (e.g. `/admin/users`, `/admin/billing`, checkout, saved jobs, job alerts, sitemap/`jobs.json` SSR loaders)
3. Replace `supabase.storage` with NestJS storage signed URLs
4. Remove `@supabase/supabase-js` and `src/integrations/supabase/` from frontend dependencies
5. Frontend E2E smoke: register → verify → login → post job → batch ingest (API) → apply → see applications → admin moderate

**Acceptance Criteria**:

- Frontend makes zero direct Supabase Postgres calls (`rg` confirms)
- All user-facing flows work via NestJS API against migrated data
- SSR routes (`sitemap.xml`, `jobs.json`) read from API or DB via API — not Supabase client

---

### Task 7.3 — Phase 7 Demo + Visual Cutover Checklist

**Owner**: QA Tester

**Deliverables**:

1. `./scripts/phase7-demo.sh` — migration dry-run, row-count validation, frontend smoke, full API test suite
2. `docs/demo/phase7-demo.md` — cutover runbook: API smoke, then browser checklist for seeker, employer, and admin happy paths

**Acceptance Criteria**: Demo script exits 0; cutover checklist covers every route in the Frontend Integration Track inventory table.

---

### Phase 7 Quality Gate

- [ ] Row counts in own DB match Supabase export
- [ ] Password reset emails delivered to all migrated users
- [ ] Frontend E2E smoke test passes
- [ ] Zero direct Supabase data calls in `src/` (grep confirms)
- [ ] All API integration and E2E tests still pass post-migration
- [ ] `./scripts/phase7-demo.sh` + `docs/demo/phase7-demo.md` complete

---

## Appendix: Environment Variables

All environment variables required by `src/api/`:


| Variable                 | Description                                | Required             |
| ------------------------ | ------------------------------------------ | -------------------- |
| `DATABASE_URL`           | PostgreSQL connection string               | Yes                  |
| `REDIS_URL`              | Redis connection string                    | Yes                  |
| `JWT_SECRET`             | HS256 secret for access tokens             | Yes                  |
| `JWT_REFRESH_SECRET`     | HS256 secret for refresh tokens            | Yes                  |
| `JWT_ACCESS_EXPIRES_IN`  | Access token TTL (e.g. `15m`)              | Yes                  |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token TTL (e.g. `30d`)             | Yes                  |
| `STORAGE_ENDPOINT`       | MinIO or R2 endpoint URL                   | Yes                  |
| `STORAGE_BUCKET`         | Storage bucket name                        | Yes                  |
| `STORAGE_ACCESS_KEY`     | S3-compatible access key                   | Yes                  |
| `STORAGE_SECRET_KEY`     | S3-compatible secret key                   | Yes                  |
| `EMAIL_PROVIDER`         | `resend` or `sendgrid`                     | Yes                  |
| `EMAIL_API_KEY`          | Email provider API key                     | Yes                  |
| `EMAIL_FROM`             | Sender address                             | Yes                  |
| `EMAIL_SEND_IN_DEV`      | Send via Resend in development             | No (default: false)  |
| `TWILIO_ACCOUNT_SID`     | Twilio account SID                         | No (SMS disabled if unset) |
| `TWILIO_AUTH_TOKEN`      | Twilio auth token                          | No                   |
| `TWILIO_FROM_NUMBER`     | Twilio programmable SMS sender (E.164)     | No                   |
| `TWILIO_VERIFY_SERVICE_SID` | Twilio Verify service for OTP           | No                   |
| `TWILIO_WEBHOOK_AUTH_TOKEN` | Twilio webhook signature validation   | Yes (Phase 4.5+)     |
| `RESEND_WEBHOOK_SECRET`  | Resend inbound webhook signature secret    | Yes (Phase 4.5+)     |
| `NOTIFICATIONS_REQUIRE_MFA_ROLES` | Comma-separated roles requiring 2FA (`vendor,admin`) | No (default: `vendor,admin`) |
| `API_KEY_HASH`           | bcrypt hash of the batch ingestion API key | Yes                  |
| `LOG_LEVEL`              | `debug`, `info`, `warn`, `error`           | No (default: `info`) |
| `NODE_ENV`               | `development`, `test`, `production`        | Yes                  |
| `PORT`                   | NestJS listen port                         | No (default: `3001`) |
| `SWAGGER_API_KEY`        | SwaggerHub API key for spec publishing     | No (CI only)         |


