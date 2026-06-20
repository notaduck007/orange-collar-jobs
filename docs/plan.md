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

### Task 0.1 — Replicate Documentation from openclaw-pilot

**Owner**: Senior Engineer
**Description**: Adapt the openclaw-pilot documentation structure to the WarehouseJobs use-case.

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

### Phase 3 Quality Gate

- [x] All 5 jobs endpoints per OpenAPI spec pass E2E tests
- [x] Vendor credit deduction works atomically
- [x] Search priority ordering confirmed by integration test
- [x] Coverage ≥ 90% for `JobsService`
- [x] `bun run api:contract:check` passes (implemented routes ↔ spec)
- [x] `docs/demo/phase3-demo.md` + `./scripts/phase3-demo.sh` complete

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

### Phase 4 Quality Gate

- [ ] 1,000-job batch ingests cleanly; all jobs appear in `GET /jobs`
- [ ] WJ direct posts rank above scraped in search results (confirmed by test)
- [ ] Deduplication correct (created/updated/skipped counts accurate)
- [ ] All batch tests pass; coverage ≥ 90%

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

### Phase 5 Quality Gate

- [ ] Unauthenticated apply returns 201 < 3 s server time
- [ ] Seeker `GET /applications` shows correct applications (B2 resolved)
- [ ] Employer pipeline returns correct applicants; status transitions work
- [ ] All application tests pass; coverage ≥ 90%

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

### Phase 6 Quality Gate

- [ ] All admin endpoints return 403 for non-admin roles
- [ ] Ad campaigns activate/deactivate correctly by date
- [ ] `GET /admin/stats` returns accurate numbers
- [ ] All admin and company tests pass; coverage ≥ 90%

---

## Phase 7 — Data Migration & Frontend Big Bang

**Timeline**: ~3 days
**Deliverable**: Full Supabase → own PostgreSQL data migration; frontend switched from direct Supabase calls to NestJS API.

### Task 7.1 — Data Migration Script

**Owner**: Senior Engineer

**Steps**:

1. Export all data from Supabase (users, companies, jobs, applications, etc.)
2. Write `prisma/seeds/migrate-from-supabase.ts` — idempotent migration script
3. Migrate users: create `users` rows from Supabase `auth.users` export; mark passwords as `REQUIRES_RESET`; set `migrationSource = supabase`
4. Send password-reset emails to all migrated users via `EmailService`
5. Migrate all other tables in dependency order (companies → jobs → applications → etc.)
6. Validate row counts match

**Acceptance Criteria**:

- Migration script is idempotent (safe to run multiple times)
- All foreign key relationships preserved
- User count in own DB matches Supabase export count
- Password reset emails queued for all migrated users

---

### Task 7.2 — Frontend Big Bang Migration

**Owner**: Senior Engineer + Mid Engineer

**Steps**:

1. Replace all direct Supabase data calls in `src/` routes with NestJS API calls (fetch / axios)
2. Replace Supabase auth (`@supabase/supabase-js`) with NestJS auth endpoints
3. Replace `useAuth` hook — now reads JWT from localStorage, calls `/api/v1/me`
4. Replace `supabase.storage` calls with NestJS storage endpoints / signed URLs
5. Remove Supabase client dependencies from `src/` (keep if needed for auth only during transition)

**Acceptance Criteria**:

- Frontend makes zero direct Supabase Postgres calls
- All existing frontend functionality works via NestJS API
- E2E smoke test: register → verify → login → post job → apply → see applications

---

### Phase 7 Quality Gate

- [ ] Row counts in own DB match Supabase export
- [ ] Password reset emails delivered to all migrated users
- [ ] Frontend E2E smoke test passes
- [ ] Zero direct Supabase data calls in `src/` (grep confirms)
- [ ] All API integration and E2E tests still pass post-migration

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
| `API_KEY_HASH`           | bcrypt hash of the batch ingestion API key | Yes                  |
| `LOG_LEVEL`              | `debug`, `info`, `warn`, `error`           | No (default: `info`) |
| `NODE_ENV`               | `development`, `test`, `production`        | Yes                  |
| `PORT`                   | NestJS listen port                         | No (default: `3001`) |
| `SWAGGER_API_KEY`        | SwaggerHub API key for spec publishing     | No (CI only)         |


