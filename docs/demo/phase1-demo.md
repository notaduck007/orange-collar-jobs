# Phase 1 Demo — NestJS Scaffold + Core

**Phase**: 1 (complete)  
**Deliverable**: Runnable NestJS API with core infrastructure, Docker Compose, CI, and `GET /api/health`.

This document walks through what Phase 1 built and how to demonstrate it. For an automated run of the quality gate, use:

```bash
./scripts/phase1-demo.sh
```

---

## What Phase 1 delivers

| Component         | Location                   | Demo signal                              |
| ----------------- | -------------------------- | ---------------------------------------- |
| NestJS scaffold   | `src/api/`                 | `bun run api:dev` starts on :3001        |
| Prisma + Postgres | `src/api/prisma/`          | migrations apply cleanly                 |
| Core modules      | `src/api/src/core/*`       | health, auth guards, storage, SMS, queue |
| Docker Compose    | `docker-compose.yml`       | Postgres :5433, Redis :6380, MinIO :9000 |
| OpenAPI contract  | `docs/api/openapi.yaml`    | 27 endpoints (design-first)              |
| CI                | `.github/workflows/ci.yml` | lint, test, integration, e2e, build      |
| Tests             | `src/api/test/unit/**`     | ≥ 90% line coverage on core services     |

---

## Prerequisites

- Bun ≥ 1.3, Node 24 (`nvm use`)
- Docker + Compose
- **Single root `.env`** (not `src/api/.env`):

```bash
bun run setup:env    # cp .env.example → .env; merges legacy src/api/.env if present
```

---

## Demo script (≈10 minutes)

### 1. Start infrastructure

```bash
docker compose up -d postgres redis minio
```

`wj_minio_init` exiting with code **0** is normal (bucket init).

### 2. API

```bash
bun install
bun run api:migrate:dev
bun run api:dev
```

### 3. Health check

```bash
curl -s http://localhost:3001/api/health | jq .
```

Expected: `status: "ok"` with `db`, `redis`, and `storage` indicators up.

### 4. Swagger UI

Open http://localhost:3001/api/docs

### 5. Authenticated surface (Phase 1 core)

`GET /api/v1/me` requires JWT — returns 401 without token (confirms global auth guard).

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/api/v1/me
# 401
```

### 6. Quality gate (automated)

```bash
./scripts/phase1-demo.sh
```

Skips if API is not running for the final curl only; all tests run regardless.

Options:

- `--skip-docker` — data stores already up
- `--skip-integration` — unit + e2e only

---

## Package manager: Bun (not npm)

| Context                         | Tool                                         |
| ------------------------------- | -------------------------------------------- |
| Local dev                       | **Bun** (`bun install`, `bun run api:*`)     |
| CI (`.github/workflows/ci.yml`) | **Bun**                                      |
| Docker image build              | **Bun** (`oven/bun` in `src/api/Dockerfile`) |
| Lockfile                        | **Root `bun.lock`** only (Bun workspaces)    |

Do **not** run `npm ci` in this repo — there is no root `package-lock.json`. Nested `package-lock.json` / `bun.lock` under `src/api/` are removed to avoid confusion.

---

## Phase 1 quality gate checklist

From [`docs/plan.md`](../../plan.md):

- [x] `bun run api:dev` starts without errors
- [x] `bun run api:lint` passes
- [x] `GET /api/health` returns 200 with dependencies healthy
- [x] Prisma migrations apply cleanly
- [x] Core unit tests pass (≥ 90% coverage)
- [x] Integration test for `/health` passes
- [x] CI workflow defined for `main` / PRs

---

## Related docs

- Monorepo conventions: [`docs/agent/standards/common/monorepo.md`](../../agent/standards/common/monorepo.md)
- Architecture: [`docs/agent/analysis/architecture.md`](../../agent/analysis/architecture.md)
- Full overview: [`overview.html`](overview.html)
