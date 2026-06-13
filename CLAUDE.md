# WarehouseJobs Engineering Constitution

## Purpose

This document defines the **authoritative cognitive, architectural, and operational rules** governing how AI agents participate in the design, implementation, review, and evolution of the WarehouseJobs.com platform.

This file is a **constitution**, not a workflow.
It defines **what is allowed**, **what is forbidden**, and **how authority is structured**.

**Orchestration** (which agent does what, handoffs, collaboration patterns) lives in [`AGENTS.md`](./AGENTS.md).

---

## Repository Intent

This repository delivers **WarehouseJobs.com** — a niche job board and hiring platform focused on the warehouse and logistics sector. The platform connects warehouse employers with workers via a fast mobile-first application flow, batch job ingestion, and an admin-managed advertising and content system.

### Technology Stack

- **Frontend**: React 19 + TanStack Start (SSR) + Vite + Tailwind CSS + Supabase Auth
- **API**: NestJS 10 + TypeScript + Prisma ORM + PostgreSQL — lives at `src/api/`
- **Queue**: BullMQ + Redis
- **Storage**: MinIO (local dev) → Cloudflare R2 (production)
- **Auth**: NestJS JWT (HS256); Supabase Auth retained for the frontend during migration
- **Testing**: Jest (API) — unit, integration, E2E

### Monorepo Structure

```
orange-collar-jobs/
├── src/                         ← Frontend (TanStack Start, Vite)
│   └── api/                     ← NestJS API (self-contained, extractable)
├── docs/
│   ├── api/openapi.yaml         ← OpenAPI 3.0 contract (source of truth)
│   ├── plan.md                  ← Phase plan (tasks, acceptance criteria, gates)
│   └── agent/                   ← Agent documentation
├── .cursor/
│   ├── rules/                   ← Always-on Cursor rules
│   └── skills/                  ← Reusable reasoning workflows
├── CLAUDE.md                    ← This file (constitution)
└── AGENTS.md                    ← Agent orchestration model
```

This repository prioritizes:

- Correctness over speed
- Explicit contracts (OpenAPI spec, interfaces, DTOs, YAML design artifacts) before implementation
- Typed errors, audit trails, and fail-closed guards throughout
- Canonical type reuse over interface fragmentation
- Long-term maintainability over short-term shortcuts

**Scope authority**: The phase plan in [`docs/plan.md`](./docs/plan.md) is the source of truth for phases, tasks, and acceptance criteria.

---

## Authoritative Sources & Precedence

Sources are authoritative in **descending** order:

| Order | Source | Role |
|---|---|---|
| 1 | This `CLAUDE.md` | Constitution — boundaries and authority |
| 2 | [`AGENTS.md`](./AGENTS.md) | Agent orchestration — how work is performed |
| 3 | [`docs/plan.md`](./docs/plan.md) | Phase tasks, deliverables, quality gates |
| 4 | [`docs/api/openapi.yaml`](./docs/api/openapi.yaml) | API contract — endpoint spec is source of truth |
| 5 | [`docs/agent/standards/`](./docs/agent/standards/) | Coding and process standards |
| 6 | [`.cursor/skills/`](./.cursor/skills/) | Reusable reasoning workflows |
| 7 | [`docs/agent/personas/`](./docs/agent/personas/) | Persona responsibilities and expectations |
| 8 | [`docs/agent/analysis/`](./docs/agent/analysis/) | Architecture, data flow, design decisions |

**Rules**:

- If required sources are missing from context, **STOP and ask** — do not infer requirements
- If sources conflict, higher-precedence documents win
- The OpenAPI contract (`docs/api/openapi.yaml`) is the source of truth for all endpoint signatures, request/response shapes, and error codes — no implementation may deviate without updating the spec first
- This repository operates under a **fail-closed principle**

**Fast routing for agents**: Before reading widely, consult [`docs/agent/standards/AGENT-TASK-INDEX.md`](./docs/agent/standards/AGENT-TASK-INDEX.md) for task → document read order.

---

## Architecture (Hard Boundaries)

### Layer Model

```
HTTP Controllers (src/api/src/domains/*/controllers)
        ↓
Domain Services (src/api/src/domains/*/services)
        ↓
Core Capabilities (src/api/src/core/*)  ← auth, config, logging, error, database, health
        ↓
Prisma ORM (src/api/prisma/)
        ↓
PostgreSQL + Redis + MinIO/R2
```

### Directory Rules

| Path | Contains | Must NOT contain |
|---|---|---|
| `src/api/src/core/` | Canonical cross-cutting modules | Domain business rules |
| `src/api/src/domains/{context}/` | One bounded context per folder | Direct imports from another domain's internals |
| `test/unit/` | Unit specs mirroring `src/` (mocked I/O) | Real DB/Redis/HTTP; co-located specs in `src/` |
| `test/integration/` | Real DB + Redis tests | Live external API calls |
| `test/e2e/` | Supertest HTTP tests | Unguarded data mutations |

**Layering rules**:

- Controllers are thin: validate input → call one service method → return result
- Services own business logic and orchestration within a bounded context
- Cross-cutting types live in `src/api/src/core/` — see [`docs/agent/standards/common/canonical-types.md`](./docs/agent/standards/common/canonical-types.md)
- Import from module **barrels** (`index.ts`) only — never import internal files directly
- Only `src/core/` modules are `@Global()`

Full architecture: [`docs/agent/analysis/architecture.md`](./docs/agent/analysis/architecture.md)

---

## API Contract Rule (Hard Rule)

The OpenAPI spec at [`docs/api/openapi.yaml`](./docs/api/openapi.yaml) is **the source of truth** for all API behaviour.

- No endpoint may be implemented that deviates from the spec without first updating the spec
- No new endpoint may be added without first adding it to the spec
- Response shapes, error codes, and authentication requirements in the spec are authoritative
- The spec is published to SwaggerHub (org: `redbonzai`) — the published version must always match the repo version

---

## Testing Requirements (Non-Negotiable)

Testing is mandatory before merge and before phase quality gates.

| Layer | Location | Standard |
|---|---|---|
| Unit | `src/api/test/unit/**/*.spec.ts` (mirrors `src/`) | [`docs/agent/standards/testing/unit.md`](./docs/agent/standards/testing/unit.md) |
| Integration | `src/api/test/integration/**` | [`docs/agent/standards/testing/integration.md`](./docs/agent/standards/testing/integration.md) |
| E2E | `src/api/test/e2e/**` | [`docs/agent/standards/testing/e2e.md`](./docs/agent/standards/testing/e2e.md) |

**Test pyramid** (target): ~70% unit · ~20% integration · ~10% E2E.

**Rules**:

- Integration tests use Docker Compose Postgres + Redis; truncate tables in `beforeEach`
- Coverage ≥ **85%** line coverage for services before phase gate sign-off
- Never commit with failing tests
- No real external HTTP calls in unit or integration tests (use typed mocks)

Skill workflow: [`.cursor/skills/testing/SKILL.md`](./.cursor/skills/testing/SKILL.md)

---

## Security-by-Default (Hard Rule)

Standards: [`docs/agent/standards/common/security.md`](./docs/agent/standards/common/security.md)

- **Secrets**: Never commit API keys, tokens, or connection strings — use environment variables only
- **Input validation**: `class-validator` on all DTOs; Zod for env schema in `src/api/src/core/config/`
- **Errors**: Typed errors from `src/api/src/core/error/` — never expose stack traces or internal details in API responses
- **Auth**: Every protected endpoint verified by `JwtAuthGuard` + role guard before the service is called
- **Rate limiting**: Applied at the controller level via `@Throttle()` — apply to all public endpoints
- **Batch auth**: API key (`X-Api-Key`) validated against a hashed key in the DB — never store plaintext keys

Security issues are **blocking** until resolved or explicitly accepted by the project owner.

---

## Quality Gates (Non-Negotiable)

Agents must **STOP** if any gate fails. Do not proceed to the next task or phase.

### Per-PR / Per-Task Gates

```bash
# Run from src/api/
npm run lint
npm run type-check
npm run test
npm run test:integration   # when DB/Redis features touched
npm run test:e2e           # when HTTP surface touched
npm run test:cov           # ≥ 85% line coverage for changed services
```

### Phase Gates

Defined per phase in [`docs/plan.md`](./docs/plan.md). A phase does not start until the prior phase quality gate is cleared.

### STOP Conditions

- Build or type-check fails
- Any test suite fails
- New lint errors introduced
- Coverage below threshold for owned services
- Endpoint implemented without updating `docs/api/openapi.yaml` first
- Interface implemented without approved YAML contract (Interface Designer skill)
- No test coverage on a new service method

Agents may **not** skip gates, bypass CI, or merge with known failures.

---

## Module & Type Standards

| Topic | Document |
|---|---|
| Module layout & barrels | [`.cursor/skills/module-design-pattern/SKILL.md`](./.cursor/skills/module-design-pattern/SKILL.md) |
| Canonical types | [`docs/agent/standards/common/canonical-types.md`](./docs/agent/standards/common/canonical-types.md) |
| TypeScript rules | [`docs/agent/standards/common/typescript.md`](./docs/agent/standards/common/typescript.md) |
| Naming conventions | [`docs/agent/standards/common/naming.md`](./docs/agent/standards/common/naming.md) |
| Anti-patterns | [`docs/agent/standards/common/anti-patterns.md`](./docs/agent/standards/common/anti-patterns.md) |

---

## NestJS API — Self-Containment Rule

The `src/api/` directory is a **self-contained NestJS application**:

- It has its own `package.json`, `tsconfig.json`, `nest-cli.json`, `jest.config.js` (+ `test/jest-*.json`); env vars load from the **repo root** `.env` (see `docs/agent/standards/common/monorepo.md`)
- It can be copied to a standalone repository at any time with no consequence to the monorepo
- It does **not** import from the frontend (`src/`) and the frontend does **not** import from `src/api/`
- Shared configuration only: `tsconfig.base.json` at the root (strict TypeScript base)
