# WarehouseJobs.com — Platform API Overview

> **Version**: 1.0.1 &nbsp;|&nbsp; **Date**: 2026-06-13 &nbsp;|&nbsp; **Status**: Phase 1 complete · Phase 2 complete · Phase 3 pending
>
> **SwaggerHub**: [redbonzai/warehousejobs-api](https://app.swaggerhub.com/apis/redbonzai/warehousejobs-api/1.0.0)

---

## What We're Building

WarehouseJobs.com is a **mobile-first job marketplace** for warehouse, logistics, and light-industrial workers. The platform differentiates on **speed-to-apply** — a worker in the field with no resume should be able to apply for a job in 60 seconds or less, using only their name, phone number, and ZIP code.

### Platform Users

| User | Role | What They Do |
|---|---|---|
| **Admin** | `admin` | Platform operators — moderate jobs, manage ads, view stats, post for any company |
| **Employer** | `vendor` | Post and manage their company's job listings; review applicants |
| **Job Seeker** | `seeker` | Search and apply to jobs; track application status |
| **Feed Partner** | API Key | Automated batch ingestion of scraped or syndicated job feeds |

---

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────┐
│              TanStack Start (SSR) — React 19                 │
│            Vite · Tailwind CSS · Bun · TypeScript            │
├─────────────────────────────────────────────────────────────┤
│              HTTP — JSON REST — JWT Bearer Auth              │
├─────────────────────────────────────────────────────────────┤
│              NestJS 10 API  (src/api/)                       │
│     Controllers → Services → Core → Prisma ORM              │
├──────────────────────────┬──────────────────────────────────┤
│  PostgreSQL 16            │  Redis 7                         │
│  (primary data store)     │  (session cache · BullMQ queues) │
├──────────────────────────┴──────────────────────────────────┤
│  Object Storage: MinIO (local dev) → Cloudflare R2 (prod)   │
└─────────────────────────────────────────────────────────────┘
```

### Local Dev Containers (Docker Compose)

| Container | Image | Port |
|---|---|---|
| `api` | NestJS (Node 24) | 3001 |
| `postgres` | `postgres:16` | 5432 |
| `redis` | `redis:7-alpine` | 6379 |
| `minio` | `minio/minio` | 9000 / 9001 |

---

## Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, TanStack Start (SSR), Vite, Tailwind CSS |
| **Backend** | NestJS 10, TypeScript, Prisma 6 ORM |
| **Database** | PostgreSQL 16 (self-hosted, containerized) |
| **Queues / Cache** | Redis 7 + BullMQ |
| **File Storage** | MinIO (local) → Cloudflare R2 (production) |
| **Auth** | Custom JWT — HS256, access token 15m, refresh 30d |
| **Testing** | Jest — unit, integration, E2E via Supertest |
| **Package Manager** | Bun (workspaces monorepo) |
| **API Contract** | OpenAPI 3.0.3 (design-first, SwaggerHub) |

---

## Key Architectural Decisions

| Decision | Choice | Why |
|---|---|---|
| **Database** | Self-hosted PostgreSQL 16 | Portability; full Prisma control; no Supabase vendor lock-in |
| **Auth** | Custom NestJS JWT (HS256) | Full token/role/refresh control; supports migration from Supabase Auth |
| **Storage** | MinIO → Cloudflare R2 | S3-compatible; R2 has zero egress fees; enterprise-scale |
| **Batch ingest** | Sync ≤100 / BullMQ async >100 | Avoids HTTP timeouts on large feeds; reliable retry |
| **Frontend migration** | Big bang (Phase 7) | Avoids auth session split-brain between Supabase and NestJS |
| **ORM** | Prisma 6 | Type-safe schema; migration history; excellent TS integration |
| **Monorepo** | Bun workspaces (`src/api/`) | Self-contained; extractable at any time with no repo-wide consequences |

---

## API Summary — 27 Endpoints

### System

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/health` | Public | Health check (DB + Redis + Storage) |
| `GET` | `/api/v1/me` | Bearer | Current authenticated user profile |

### Auth (7 endpoints)

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | Public | Create account (seeker or vendor) |
| `POST` | `/api/v1/auth/login` | Public | Login → access + refresh tokens |
| `POST` | `/api/v1/auth/logout` | Bearer | Revoke refresh token |
| `POST` | `/api/v1/auth/refresh` | Public | Rotate tokens |
| `POST` | `/api/v1/auth/verify-email` | Public | Verify email from link token |
| `POST` | `/api/v1/auth/forgot-password` | Public | Request reset email |
| `POST` | `/api/v1/auth/reset-password` | Public | Set new password |

### Jobs (5 endpoints)

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/jobs` | admin / vendor | Post a new job |
| `GET` | `/api/v1/jobs` | Public | Search with full-text + filters + pagination |
| `GET` | `/api/v1/jobs/:slug` | Public | Job detail page (increments views) |
| `PATCH` | `/api/v1/jobs/:id` | admin / vendor | Update job |
| `DELETE` | `/api/v1/jobs/:id` | admin / vendor | Soft-delete (status → closed) |

### Batch Ingestion (2 endpoints)

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/jobs/batch` | API Key | Ingest JSON array or CSV (≤10,000 jobs) |
| `GET` | `/api/v1/jobs/batch/:batchId/status` | API Key | Poll async batch status |

### Applications (4 endpoints)

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/jobs/:jobId/apply` | Public / Bearer | Quick apply — 60s, resume optional |
| `GET` | `/api/v1/applications` | seeker | My application list |
| `GET` | `/api/v1/employer/applications` | vendor | All applicants for my company's jobs |
| `PATCH` | `/api/v1/applications/:id/status` | vendor | Advance/reject application state |

### Companies (3 endpoints)

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/companies` | vendor / admin | Create company profile |
| `GET` | `/api/v1/companies/:slug` | Public | Public company profile + active jobs |
| `PATCH` | `/api/v1/companies/:id` | vendor / admin | Update profile |

### Admin (5 endpoints)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/admin/jobs` | admin | Moderation queue with filters |
| `PATCH` | `/api/v1/admin/jobs/:id/feature` | admin | Toggle featured status |
| `POST` | `/api/v1/admin/ads` | admin | Create ad campaign |
| `GET` | `/api/v1/admin/ads` | admin | List campaigns |
| `GET` | `/api/v1/admin/stats` | admin | Platform aggregate stats |

---

## Authentication Flow

```
1. POST /api/v1/auth/login
   → { accessToken (15m), refreshToken (30d) }

2. Every request: Authorization: Bearer {accessToken}

3. On 401: POST /api/v1/auth/refresh
   → new accessToken + rotated refreshToken
```

**Roles**: `admin` > `vendor` > `seeker`. Wrong role → HTTP 403.

---

## Batch Ingestion Flow

```
Batch ≤ 100 jobs   →  synchronous  →  201 { results[] }
Batch > 100 jobs   →  BullMQ queue →  202 { batchId }
                                           ↓ poll
                         GET /jobs/batch/:batchId/status
                         → { total, created, updated, skipped, failed, errors[] }
```

**Deduplication**: `externalId` per company — unchanged jobs are skipped; changed jobs are updated.
**Formats**: `application/json` array or `text/csv` with header row.

---

## Application State Machine

```
new → reviewing → shortlisted → interview → offer → hired
 ↘                                                    ↗
  →  rejected  (from any state, by employer)
  →  withdrawn (from any state, by seeker)
```

---

## Database Schema (Core Tables)

```
users
  ├── refresh_tokens
  ├── email_verifications
  └── password_resets

companies
  └── company_packages (credit bundles for job posting)

jobs  (source_type: direct | scraped | api | syndicated)
  ├── screening_questions
  └── interview_slots

applications
  ├── application_answers
  └── interview_bookings

ad_campaigns → ad_placements
api_keys  (batch ingestion auth)
batch_jobs (async ingestion status)
```

---

## Development Phases

| Phase | Description | Timeline | Gate |
|---|---|---|---|
| **0** | Documentation + OpenAPI contract (✅ Done) | Day 1 | SwaggerHub live + human approval |
| **1** | NestJS scaffold + Docker Compose + CI | ~2 days | `GET /health` 200, CI green |
| **2** | Auth domain (JWT, register/login/verify/reset) | ~2 days | All 7 auth E2E tests pass |
| **3** | Jobs domain (CRUD, search, vendor credits) | ~3 days | 5 jobs E2E tests pass; search priority correct |
| **4** | Batch ingestion (JSON/CSV + BullMQ + dedup) | ~2 days | 1,000-job batch ingests <30s |
| **5** | Applications domain (quick apply, pipeline) | ~2 days | Unauthenticated apply <3s; 4 E2E pass |
| **6** | Admin, ads, companies, full RBAC | ~2 days | All admin routes return 403 for non-admin |
| **7** | Data migration (Supabase → Postgres) + frontend big bang | ~3 days | Zero direct Supabase calls in frontend |

**Total estimate**: ~17 days of focused development

---

## Testing Strategy

| Type | Location | Tooling | Threshold |
|---|---|---|---|
| **Unit** | `test/unit/**/*.spec.ts` (mirrors `src/`) | Jest + `jest-mock-extended` | ≥90% per service |
| **Integration** | `test/integration/` | Jest + real Docker Compose DB | ≥85% overall |
| **E2E** | `test/e2e/` | Jest + Supertest | Every endpoint × 3 auth cases |

Every endpoint must have: happy path test, wrong-role (403) test, and no-token (401) test.

---

## Repository Structure

```
orange-collar-jobs/            ← monorepo root (Bun workspaces)
├── src/                       ← React frontend (TanStack Start)
│   ├── routes/
│   └── components/
├── src/api/                   ← NestJS API (self-contained, extractable)
│   ├── src/
│   │   ├── core/              ← Database, Auth, Config, Errors, Storage, Queue
│   │   └── domains/           ← auth, jobs, batch, applications, companies, admin
│   ├── prisma/
│   ├── test/
│   └── package.json
├── docs/
│   ├── api/openapi.yaml       ← API contract (source of truth)
│   ├── plan.md                ← Master phase plan
│   ├── demo/                  ← This document
│   └── agent/
│       ├── standards/         ← Coding, testing, naming, security standards
│       ├── personas/          ← API Architect, Backend Engineer, Quality Sentinel
│       └── analysis/          ← Architecture decisions
├── CLAUDE.md                  ← Engineering constitution
├── AGENTS.md                  ← Agent orchestration model
├── .cursor/rules/             ← 10 Cursor rules (TypeScript, testing, modules, etc.)
├── .cursor/skills/            ← 9 agent reasoning skills
└── docker-compose.yml         ← Postgres + Redis + MinIO
```

---

## Environment Variables (API)

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | HS256 secret for access tokens |
| `JWT_REFRESH_SECRET` | HS256 secret for refresh tokens |
| `STORAGE_ENDPOINT` | MinIO or R2 endpoint URL |
| `STORAGE_BUCKET` | Storage bucket name |
| `STORAGE_ACCESS_KEY` | S3-compatible access key |
| `STORAGE_SECRET_KEY` | S3-compatible secret key |
| `EMAIL_PROVIDER` | `resend` or `sendgrid` |
| `EMAIL_API_KEY` | Email provider API key |
| `API_KEY_HASH` | bcrypt hash of batch ingestion key |
| `NODE_ENV` | `development` / `test` / `production` |
| `PORT` | NestJS port (default: 3001) |

---

*Generated from `docs/plan.md`, `docs/api/openapi.yaml`, and `docs/agent/analysis/architecture.md`.*
