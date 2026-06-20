# WarehouseJobs.com

A niche job board and hiring platform for the warehouse and logistics sector.  
Employers post jobs; workers apply via a fast mobile-first flow; admins manage content and advertising.

|                  |                                                                 |
| ---------------- | --------------------------------------------------------------- |
| **Stack**        | React 19 · TanStack Start · NestJS 10 · Prisma · PostgreSQL     |
| **API contract** | [`docs/api/openapi.yaml`](docs/api/openapi.yaml) + drift guard  |
| **Plan**         | [`docs/plan.md`](docs/plan.md) — phases, gates, acceptance criteria |
| **Constitution** | [`CLAUDE.md`](CLAUDE.md) · orchestration: [`AGENTS.md`](AGENTS.md) |

---

## What this repository delivers

| Layer        | Technology                                                          |
| ------------ | ------------------------------------------------------------------- |
| **Frontend** | React 19 · TanStack Start (SSR) · Vite · Tailwind · Supabase (data) |
| **API**      | NestJS 10 · TypeScript · Prisma 6 · PostgreSQL 16 · Redis · MinIO   |
| **Auth**     | NestJS JWT (HS256) — register, login, refresh, password reset       |
| **Testing**  | Jest · Supertest · ≥ 90% unit coverage (all metrics)                |

### Implementation status

| Phase | Focus                                              | Status   | Demo |
| ----- | -------------------------------------------------- | -------- | ---- |
| **1** | Infrastructure, health, guards, core modules       | Complete | [`docs/demo/phase1-demo.md`](docs/demo/phase1-demo.md) |
| **2** | Auth domain (7 endpoints + frontend JWT wiring)      | Complete | [`docs/demo/phase2-demo.md`](docs/demo/phase2-demo.md) |
| **3** | Jobs CRUD, search, vendor credits, **API contract drift guard** | Complete | [`docs/demo/phase3-demo.md`](docs/demo/phase3-demo.md) |
| **4** | Batch job ingestion (BullMQ)                       | Planned  | —    |
| **5** | Applications domain                                | Planned  | —    |
| **6** | Companies & admin                                  | Planned  | —    |

---

## Quick start (≈10 minutes)

### Prerequisites

- [Bun](https://bun.sh) ≥ 1.1
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Postgres, Redis, MinIO)
- Node ≥ 20 (Jest; integration/E2E set `NODE_OPTIONS=--experimental-vm-modules` — see `docs/agent/standards/testing/`)

```bash
git clone <repository-url> orange-collar-jobs
cd orange-collar-jobs
bun install
bash scripts/setup-env.sh
docker compose up -d
bash scripts/ensure-minio-buckets.sh
bun run api:migrate:dev
bun run api:dev          # http://localhost:3001 — Swagger at /api/docs
bun run dev              # frontend — http://localhost:8080
```

Verify:

```bash
curl -s http://localhost:3001/api/health | head -c 200
bun run api:contract:check
```

---

## API surface (implemented)

| Prefix | Endpoints |
| ------ | --------- |
| `/api/health` | Liveness (no version segment) |
| `/api/v1/me` | JWT identity |
| `/api/v1/auth/*` | Register, login, logout, refresh, verify, forgot/reset password |
| `/api/v1/jobs` | Search (GET), create (POST) |
| `/api/v1/jobs/{slug}` | Job detail + view counter |
| `/api/v1/jobs/{id}` | Update (PATCH), soft close (DELETE) |

Full contract (including future phases): [`docs/api/openapi.yaml`](docs/api/openapi.yaml).  
Implemented operations are marked `x-implemented: true`.

---

## Testing

```bash
bun run api:test              # unit
bun run api:test:cov          # unit + ≥90% global coverage
bun run api:test:integration  # real Postgres (docker compose)
bun run api:test:e2e          # Supertest full app
```

### Phase quality gates (automated)

```bash
bun run demo:phase1
bun run demo:phase2
bun run demo:phase3           # jobs + contract guard + Phase 2 regression
```

---

## API contract drift guard

**Technical-debt protection** — as the API grows, a fail-closed CI gate guarantees the published contract (`docs/api/openapi.yaml`), the running NestJS routes, and the committed Postman artifacts never drift apart. The spec cannot silently rot.

| Proposal deliverable | What it means in this repo | How you verify it |
| -------------------- | -------------------------- | ----------------- |
| API contract drift guard | `ApiContractService` + `scripts/check-api-contract.ts` | `bun run api:contract:check` proves code ↔ spec in sync; CI `API Contract Drift Guard` job fails closed on drift |
| OpenAPI `x-implemented` markers | Only shipped routes count toward drift detection | Future spec paths without `x-implemented: true` are ignored until implemented |
| SwaggerHub publish gate | `.github/workflows/publish-swagger.yml` | Contract guard runs **before** any SwaggerHub push |

### How it works

1. `contract:check` boots a mocked NestJS context (Prisma stubbed), introspects the **live route surface** via `DiscoveryService` + `Reflector`, and diffs it against operations marked `x-implemented: true` in `docs/api/openapi.yaml`.
2. The guard reports two kinds of drift and **exits non-zero** on either:
   - **Undocumented route** — exists in code, missing from the spec (or not marked implemented).
   - **Phantom route** — marked implemented in the spec, missing from code.
3. CI runs the guard on every PR/push (no database, Redis, or MinIO required).
4. `publish-swagger.yml` re-runs validate + contract:check before pushing to SwaggerHub (`redbonzai/warehousejobs-api/<version>`).

### Commands

```bash
bun run api:validate          # OpenAPI 3 structural validation
bun run api:contract:check    # live NestJS routes ↔ x-implemented ops in openapi.yaml
bun run api:publish           # SwaggerHub push (local; CI uses publish-swagger.yml)
bun run api:publish -- --dry-run  # validate only, no upload
```

### Negative proof (guard fails closed)

Inject a phantom path into a **throwaway copy** of the spec — the committed file is never modified:

```bash
TAMPER=$(mktemp -d)
export TAMPER
(cd src/api && bun -e "
import fs from 'fs';
import yaml from 'yaml';
const s = yaml.parse(fs.readFileSync('../../docs/api/openapi.yaml', 'utf8'));
s.paths['/api/__drift_probe__'] = {
  get: { tags: ['System'], 'x-implemented': true, responses: { 200: { description: 'probe' } } },
};
fs.writeFileSync(process.env.TAMPER + '/openapi.yaml', yaml.stringify(s));
")
bun --env-file=.env --cwd src/api scripts/check-api-contract.ts --spec "$TAMPER/openapi.yaml"
echo "exit=$?"   # expect 1
rm -rf "$TAMPER"
```

`./scripts/phase3-demo.sh` runs this negative proof automatically in step 5.

### Programmatic test coverage

| Layer | What it proves | Location |
| ----- | -------------- | -------- |
| Unit | `diff()`, spec loader, route normalization | `src/api/test/unit/domains/api-contract/` |
| Integration | Real `AppModule` route surface == `openapi.yaml` | `src/api/test/integration/api-contract.integration.spec.ts` |
| E2E | Guard CLI exits clean on real spec, non-zero on tampered spec | `src/api/test/e2e/api-contract.e2e-spec.ts` |
| Newman (live API) | Postman collection exercises implemented endpoints | `.github/workflows/postman.yml` + `scripts/ci-postman.sh` |

### When CI fails

1. Update `docs/api/openapi.yaml` so method + path + param names match NestJS (mark shipped ops `x-implemented: true`).
2. Update `src/api/postman/` if the HTTP surface changed.
3. Re-run `bun run api:contract:check`.

Design: [`docs/agent/analysis/api-contract-drift-guard.md`](docs/agent/analysis/api-contract-drift-guard.md) · Demo walkthrough: [`docs/demo/phase3-demo.md`](docs/demo/phase3-demo.md) (Part F).

---

## Postman

Import `src/api/postman/warehousejobs.postman_collection.json` + `warehousejobs.postman_environment.json`.

| Folder | Purpose |
| ------ | ------- |
| Phase 2 — Walkthrough | Auth flow (register → reset) |
| Phase 3 — Walkthrough | Jobs CRUD (needs `companyId` + bearer token) |
| Jobs (Phase 3) | Public search smoke |

Details: [`src/api/postman/README.md`](src/api/postman/README.md)

Dev JWT without register: `bun run dev:token --role admin`

---

## Repository structure

```
orange-collar-jobs/
├── src/                    # Frontend (TanStack Start)
│   └── api/                # NestJS API (extractable)
│       ├── src/
│       │   ├── core/       # auth, config, health, email, sms, …
│       │   └── domains/    # auth, jobs, api-contract, …
│       ├── test/           # unit · integration · e2e
│       └── postman/
├── docs/
│   ├── api/openapi.yaml    # source of truth
│   ├── plan.md
│   └── demo/               # phase1/2/3 demo guides
├── scripts/                # setup, phase demos, CI helpers
├── CLAUDE.md               # constitution
└── AGENTS.md               # agent orchestration
```

---

## Environment

Single root `.env` from `.env.example` (API loads via monorepo path). Key variables:

| Variable | Purpose |
| -------- | ------- |
| `DATABASE_URL` | PostgreSQL |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | HS256 (min 32 chars) |
| `REDIS_URL` | BullMQ + health |
| `STORAGE_*` | MinIO / R2 |
| `VITE_API_BASE_URL` | Frontend → API |

---

## CI/CD

| Workflow | Purpose |
| -------- | ------- |
| [`ci.yml`](.github/workflows/ci.yml) | Lint → **API Contract Drift Guard** → type-check → unit+coverage → integration → e2e → build |
| [`publish-swagger.yml`](.github/workflows/publish-swagger.yml) | Validate + contract guard, then push `docs/api/openapi.yaml` to SwaggerHub (on spec changes to `main`) |
| [`postman.yml`](.github/workflows/postman.yml) | Newman smoke against a live API (auth + jobs folders) |
| [`release.yml`](.github/workflows/release.yml) | semantic-release on `main` |

The **API Contract Drift Guard** job is a dedicated, fail-closed gate (no DB/Redis/MinIO): `api:validate` → `api:contract:check`. Unit and integration test jobs depend on it passing.

---

## Quality gates (before merge)

```bash
bun run api:lint
bun run api:type-check
bun run api:validate
bun run api:contract:check
bun run api:test:cov
bun run api:test:integration   # when DB touched
bun run api:test:e2e           # when HTTP touched
```

STOP conditions: [`CLAUDE.md`](CLAUDE.md)

---

## Contributing

1. Read `CLAUDE.md` and active phase in `docs/plan.md`
2. Task routing: `docs/agent/standards/AGENT-TASK-INDEX.md`
3. Branch `feat/<task>` or `fix/<issue>`
4. Run `bun run demo:phase3` (or relevant phase gate) before PR

---

## Related docs

- Platform overview: [`docs/demo/overview.md`](docs/demo/overview.md)
- Architecture: [`docs/agent/standards/common/architecture.md`](docs/agent/standards/common/architecture.md)
- Backwards compatibility: [`docs/agent/standards/common/backwards-compatibility.md`](docs/agent/standards/common/backwards-compatibility.md)
