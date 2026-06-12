# WarehouseJobs Architecture Analysis

> Authoritative description of the current and target system architecture.
> Last updated: 2026-06-12

---

## System Overview

WarehouseJobs.com is a job marketplace connecting warehouse, logistics, and light-industrial job seekers ("seekers") with employers ("vendors"). The platform prioritizes **speed-to-apply** — a mobile-first, sub-60-second application experience designed for workers who are often in the field, have limited time, and may not have a resume on hand.

---

## Architectural Layers

```
┌─────────────────────────────────────────────────────────────┐
│                   TanStack Start (SSR)                       │
│            React 19 · Vite · Tailwind CSS · Bun             │
│                  src/routes/ · src/components/               │
├─────────────────────────────────────────────────────────────┤
│              HTTP (JSON REST · JWT Bearer Auth)              │
├─────────────────────────────────────────────────────────────┤
│              NestJS 10 API  (src/api/)                       │
│  Controllers → Services → Core → Prisma ORM                  │
├──────────────────────────┬──────────────────────────────────┤
│  PostgreSQL 16            │  Redis 7                         │
│  (primary data store)     │  (session cache · BullMQ)        │
├──────────────────────────┴──────────────────────────────────┤
│  Object Storage                                              │
│  MinIO (local dev) / Cloudflare R2 (production)             │
└─────────────────────────────────────────────────────────────┘
```

---

## Runtime Containers (Docker Compose — local dev)

| Container | Image | Purpose | Port |
|---|---|---|---|
| `api` | `node:24-slim` (NestJS) | REST API | 3001 |
| `postgres` | `postgres:16` | Primary data | 5432 |
| `redis` | `redis:7-alpine` | Cache + queues | 6379 |
| `minio` | `minio/minio` | S3-compatible local object store | 9000 / 9001 |
| `web` (optional) | Vite dev server | SSR frontend | 5173 |

---

## Database Architecture

### ORM: Prisma 5

All database access goes through Prisma ORM. No raw SQL except for trusted admin migration scripts. Schema lives in `src/api/prisma/schema.prisma`.

### Core Domain Tables

```
users
  └── refresh_tokens
  └── email_verifications
  └── password_resets

companies
  └── company_packages (job post credits)

jobs
  ├── screening_questions
  ├── interview_slots
  └── (source_type: direct | scraped | batch)
  └── (external_id for deduplication)

applications
  ├── application_answers
  └── interview_bookings

ad_campaigns
  └── ad_placements

api_keys (batch ingestion auth)
```

### Migration from Supabase

The original frontend used Supabase-managed PostgreSQL directly. Migration strategy:
1. Export Supabase schema → adapt to Prisma schema (`prisma/schema.prisma`)
2. Export Supabase data → import via seeder scripts (`prisma/seeds/`)
3. Export Supabase Auth users → import to `users` table with hashed placeholder passwords
4. Send password-reset emails to all migrated users

---

## Authentication Architecture

### JWT Flow (custom NestJS, replacing Supabase Auth)

```
Client                          API
  │── POST /api/v1/auth/login ──►│
  │                              │ verify credentials
  │                              │ issue access token (15m) + refresh token (30d)
  │◄── { accessToken, refreshToken } ─│
  │
  │── GET /api/v1/jobs (Authorization: Bearer {accessToken}) ──►│
  │                                                              │ JwtAuthGuard validates
  │◄── 200 Job[] ──────────────────────────────────────────────│
  │
  │── POST /api/v1/auth/refresh ──►│
  │   { refreshToken }             │ verify hash, rotate
  │◄── { accessToken, refreshToken } ─│
```

### Roles

| Role | Capabilities |
|---|---|
| `admin` | Full access; post jobs for any company; manage all users and ads |
| `vendor` | Post/manage jobs for their own company; view own applications |
| `seeker` | Apply to jobs; manage own profile and applications |

### Guards

- `JwtAuthGuard` — validates access token; applied globally
- `RolesGuard` — checks `@Roles(...)` decorator; applied globally
- `@Public()` — explicitly opts endpoint out of auth (search, public job detail, health)

---

## Batch Ingestion Architecture

### Decision: Hybrid (Sync + Async)

| Batch Size | Strategy | Response |
|---|---|---|
| ≤ 100 jobs | Synchronous | 201 with all results |
| 101–10,000 jobs | BullMQ queue (async) | 202 with `{ batchId }` |

### Formats Supported

- `application/json` — array of job objects
- `text/csv` — CSV with header row; normalized server-side

### Deduplication

Batches include `externalId` (vendor's own ID). The `jobs` table has a unique constraint on `(companyId, externalId)`. On conflict: `upsert` — update if the job has changed, skip if identical.

### Queue Architecture (BullMQ)

```
Batch endpoint → Redis Queue (batch-ingestion)
                        │
                        ▼
              BatchWorker (BullMQ Worker)
                  - processes 10 jobs per job
                  - writes to Postgres via Prisma
                  - updates batch_status table
                        │
              GET /api/v1/batches/:batchId/status
                  - polls batch_status
```

---

## File Storage Architecture

### Local Development (MinIO)

MinIO provides an S3-compatible API on `localhost:9000`. The NestJS API uses `@aws-sdk/client-s3` with a MinIO endpoint override in `ConfigService`.

### Production (Cloudflare R2)

Cloudflare R2 is S3-compatible and supports enterprise-level throughput. The same `@aws-sdk/client-s3` code path is used — only the endpoint URL and credentials change via environment variables.

### Use Cases

| Bucket | Contents |
|---|---|
| `resumes` | Seeker resume uploads (PDF, DOCX) |
| `company-logos` | Employer brand logos |
| `ad-assets` | Banner creative assets |

---

## Module Structure (NestJS)

```
src/api/
├── src/
│   ├── app.module.ts           # Root module
│   ├── main.ts                 # Bootstrap
│   ├── core/                   # Global cross-cutting modules
│   │   ├── database/           # PrismaService (@Global)
│   │   ├── config/             # ConfigService (@Global)
│   │   ├── auth/               # JwtAuthGuard, RolesGuard, CurrentUser
│   │   ├── error/              # Typed error classes, GlobalExceptionFilter
│   │   ├── queue/              # BullMQ module
│   │   ├── storage/            # StorageService (MinIO/R2)
│   │   └── types.ts            # PaginatedResult, PaginationParams, typed IDs
│   └── domains/                # Business feature modules
│       ├── jobs/               # Job CRUD, search, slug, admin
│       ├── applications/       # Quick-apply, status management
│       ├── batch/              # Batch ingestion, BullMQ workers
│       ├── companies/          # Company profile, package management
│       ├── auth/               # Register, login, refresh, verify, reset
│       └── admin/              # Dashboard stats, ad campaigns
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seeds/
└── test/
    ├── helpers/
    │   ├── factories/          # makeJob(), makeUser(), makeApplication()
    │   ├── seeders/            # seedActiveJob(), seedVendorUser()
    │   ├── auth.helper.ts      # loginAsSeeker(), loginAsVendor(), loginAsAdmin()
    │   └── truncate.ts         # truncateAllTables()
    ├── integration/
    └── e2e/
```

---

## Frontend Architecture (Current → Target)

### Current State

The frontend calls Supabase directly via `@supabase/supabase-js`. There is no intermediary API layer — all business logic lives in React route components.

### Target State

The frontend consumes the NestJS API exclusively. `@supabase/supabase-js` is removed. Auth tokens are stored in `httpOnly` cookies or `localStorage` (decision: localStorage for simplicity, with CSRF protection in API).

### Migration Strategy: Big Bang

All routes migrate together in Phase 3 of the plan. No hybrid period where some routes use Supabase and others use the API. This avoids auth session split-brain.

---

## Key Technical Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Database | Self-hosted PostgreSQL 16 (containerized) | Portability; full Prisma ORM control; no Supabase vendor lock-in |
| Auth | Custom NestJS JWT (HS256) | Full control over tokens, roles, refresh flow |
| Storage | MinIO → Cloudflare R2 | S3-compatible; R2 has zero egress fees; enterprise-scale |
| Batch ingest | BullMQ (async) for >100 jobs | Avoids HTTP timeout on large batches; reliable retry |
| Frontend migration | Big bang | Avoids auth session fragmentation; simpler mental model |
| ORM | Prisma 5 | Type-safe; migration management; excellent TS integration |
| Monorepo | Bun workspaces | Single repo; independent extraction possible at any time |
