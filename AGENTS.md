# Agent Orchestration Model — WarehouseJobs.com

**Project**: WarehouseJobs.com (NestJS API · TypeScript · Prisma · PostgreSQL · Redis · MinIO/R2)
**Version**: 1.0

---

## Purpose

This document defines **approved AI agents**, their personas, allowed skills, collaboration patterns, and operational boundaries for platform delivery.

| Document | Role |
|---|---|
| [`CLAUDE.md`](./CLAUDE.md) | **Constitution** — what is allowed |
| **`AGENTS.md`** (this file) | **Orchestration** — how work is performed |
| [`docs/plan.md`](./docs/plan.md) | **Work breakdown** — phases, tasks, acceptance criteria |
| [`docs/api/openapi.yaml`](./docs/api/openapi.yaml) | **API contract** — endpoint specification |

If conflicts exist, **`CLAUDE.md` prevails**.

---

## Documentation Map (Read This First)

Agents should use these entry points before exploring the repo ad hoc:

| Need | Go to |
|---|---|
| What task am I doing? | [`docs/agent/standards/AGENT-TASK-INDEX.md`](./docs/agent/standards/AGENT-TASK-INDEX.md) |
| What phase/task is active? | [`docs/plan.md`](./docs/plan.md) |
| What API endpoints exist? | [`docs/api/openapi.yaml`](./docs/api/openapi.yaml) |
| Which skill applies? | [`.cursor/skills/README.md`](./.cursor/skills/README.md) |
| Coding rules | [`docs/agent/standards/README.md`](./docs/agent/standards/README.md) |
| System design | [`docs/agent/analysis/architecture.md`](./docs/agent/analysis/architecture.md) |

---

## Agent Selection Quick Reference

```
What work needs to be done?

├── Designing service/adapter interfaces or module boundaries
│     → Agent 1: Architecture & Contracts Agent
│     → Persona: Senior Engineer
│     → Skills: Domain-Driven Design → Interface Designer → Canonical Type Reuse → Module Design Pattern

├── Implementing NestJS services, controllers, DTOs, Prisma usage
│     → Agent 2: Backend Implementation Agent
│     → Persona: Mid Engineer (Senior reviews contracts)
│     → Skills: Coding Conventions → Module Design Pattern → (Testing for unit tests)

├── Writing or fixing tests (unit / integration / E2E)
│     → Agent 3: QA & Testing Agent
│     → Persona: QA Tester
│     → Skills: Testing → standards/testing/*

├── CI failed on a PR
│     → Agent 4: CI Monitor Subagent (ONE command per invocation)
│     → Skill: .cursor/skills/ci-monitoring-subagents/SKILL.md

└── Reviewing code quality or creating a PR
      → Agent 5: Code Review / PR Agent
      → Skills: Coding Conventions → create-pr
```

---

## Collaboration Patterns

### Pattern A: New Domain Feature (e.g. Jobs Domain)

```
Agent 1 (Architecture & Contracts)
  → Input: OpenAPI spec for the domain's endpoints
  → Output: YAML interface contract, module scaffold plan, canonical type decisions
  → Gate: Human approval on contract before implementation
  → Handoff → Agent 2

Agent 2 (Backend Implementation)
  → Output: Service, controller, DTOs, unit tests in test/unit/ (mirroring src/)
  → Validates implementation against OpenAPI spec
  → Handoff → Agent 3

Agent 3 (QA & Testing)
  → Output: Integration + E2E tests, coverage report
  → Gate: Quality gates in CLAUDE.md + plan.md phase gate
```

### Pattern B: Batch Ingestion Feature

```
Agent 1 (Architecture & Contracts)
  → Output: BullMQ job queue design, BatchJobItem validation schema, status state machine
  → Handoff → Agent 2

Agent 2 (Backend Implementation)
  → Implement: BatchController, BatchService, BullMQ worker, deduplication logic
  → Handoff → Agent 3

Agent 3 (QA)
  → Output: Load tests (1,000-job batch), integration tests, error case coverage
```

### Pattern C: Auth Domain

```
Agent 1
  → Confirm: JWT schema, token storage, refresh token rotation strategy
  → Output: AuthService interface, PasswordResetService interface, token type definitions
  → Handoff → Agent 2

Agent 2
  → Implement: register, login, logout, refresh, verify-email, forgot-password, reset-password
  → Add unit tests in test/unit/ (mirroring src/)
  → Handoff → Agent 3

Agent 3
  → Integration tests: real DB, real password hashing
  → E2E tests: full auth flow via Supertest
```

---

## Agent 1: Architecture & Contracts Agent

### Persona

**Senior Engineer** — [`docs/agent/personas/senior-engineer.md`](./docs/agent/personas/senior-engineer.md)

### Purpose

Design stable module boundaries, service contracts, and adapter interfaces **before** implementation. The OpenAPI spec is the starting point for all contract decisions.

### Responsibilities

- Read the relevant section of `docs/api/openapi.yaml` for the target domain
- Confirm bounded context and aggregate roots (DDD)
- Produce YAML interface contracts (Interface Designer skill)
- Decide canonical vs domain-specific types
- Scaffold module layout (`index.ts`, types, injection tokens)
- Map tasks to `docs/plan.md` acceptance criteria

### Skills (in order)

1. [`.cursor/skills/domain-driven-design/SKILL.md`](./.cursor/skills/domain-driven-design/SKILL.md)
2. [`.cursor/skills/interface-designer/SKILL.md`](./.cursor/skills/interface-designer/SKILL.md)
3. [`.cursor/skills/canonical-type-reuse/SKILL.md`](./.cursor/skills/canonical-type-reuse/SKILL.md)
4. [`.cursor/skills/module-design-pattern/SKILL.md`](./.cursor/skills/module-design-pattern/SKILL.md)

### Constraints

- Does NOT write implementation code
- Does NOT approve its own contracts (requires human or Senior Engineer review)
- STOP if the OpenAPI spec does not define the endpoint being designed

---

## Agent 2: Backend Implementation Agent

### Persona

**Mid Engineer** — [`docs/agent/personas/mid-engineer.md`](./docs/agent/personas/mid-engineer.md)

### Purpose

Implement NestJS services, controllers, DTOs, Prisma operations, and unit tests (in `test/unit/` mirroring `src/`) from approved contracts.

### Responsibilities

- Implement against the approved YAML contract (from Agent 1)
- Validate that the implementation matches `docs/api/openapi.yaml` for the target endpoints
- Write `*.spec.ts` unit tests under `test/unit/` (mirroring `src/`) for every service method
- Run `npm run lint`, `npm run type-check`, `npm run test` before marking a task done

### Skills (in order)

1. [`.cursor/skills/coding-conventions/SKILL.md`](./.cursor/skills/coding-conventions/SKILL.md)
2. [`.cursor/skills/module-design-pattern/SKILL.md`](./.cursor/skills/module-design-pattern/SKILL.md)
3. [`.cursor/skills/testing/SKILL.md`](./.cursor/skills/testing/SKILL.md) (for unit tests)

### Constraints

- Does NOT design module boundaries or contracts (Agent 1's domain)
- Does NOT write integration or E2E tests (Agent 3's domain)
- STOP if the implementation would deviate from the OpenAPI spec without updating it

---

## Agent 3: QA & Testing Agent

### Persona

**QA Tester** — [`docs/agent/personas/qa-tester.md`](./docs/agent/personas/qa-tester.md)

### Purpose

Write integration tests, E2E tests, and validate coverage thresholds. Owns phase quality gate sign-off.

### Responsibilities

- Write integration tests against real Postgres + Redis (Docker Compose)
- Write E2E tests via Supertest covering all HTTP surface defined in `openapi.yaml`
- Verify coverage ≥ 85% for services touched in the phase
- Run the full phase quality gate before sign-off

### Skills (in order)

1. [`.cursor/skills/testing/SKILL.md`](./.cursor/skills/testing/SKILL.md)
2. `docs/agent/standards/testing/integration.md`
3. `docs/agent/standards/testing/e2e.md`

### Constraints

- Does NOT implement business logic
- Does NOT modify service or controller code (open a bug/task for Agent 2)
- STOP if Docker Compose is not running for integration tests

---

## Agent 4: CI Monitor Subagent

### Persona

**QA Tester or Senior Engineer**

### Purpose

Diagnose a single failing CI check and return a short root-cause summary.

### Skills

1. [`.cursor/skills/ci-monitoring-subagents/SKILL.md`](./.cursor/skills/ci-monitoring-subagents/SKILL.md)

### Constraints

- One diagnostic command per invocation
- Does NOT make code changes — reports findings only

---

## Agent 5: Code Review / PR Agent

### Persona

**Any**

### Purpose

Review a PR for contract compliance, quality gate adherence, and code quality.

### Checklist

1. Does the implementation match `docs/api/openapi.yaml` for all modified endpoints?
2. Are there unit tests (in `test/unit/`, mirroring `src/`) for every new public service method?
3. Does `npm run lint && npm run type-check && npm run test` pass?
4. Is test coverage ≥ 85% for changed services?
5. Are DTOs validated with `class-validator`?
6. Are typed error classes used (no raw `new Error()`)?
7. Are secrets in env vars only (no hardcoded credentials)?
8. **Backwards compatibility**: do `phase1-backwards-compat` tests and prior-phase demo smoke still pass? ([`docs/agent/standards/common/backwards-compatibility.md`](./docs/agent/standards/common/backwards-compatibility.md))

### Skills

1. [`.cursor/skills/coding-conventions/SKILL.md`](./.cursor/skills/coding-conventions/SKILL.md)
2. [`.cursor/skills/create-pr/SKILL.md`](./.cursor/skills/create-pr/SKILL.md)
