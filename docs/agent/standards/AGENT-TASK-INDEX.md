# Agent Task Index

**Purpose**: Fast lookup — task → required reading order + required skills + key decision points
**Use This First**: Before reading any other document, find your task here and follow the prescribed reading order.

---

## How to Use

1. Find your task type below
2. Read only the documents listed under "Read Order" (skip the rest)
3. Follow "Key Decision Points" before writing code
4. Invoke the listed "Required Skills" in order

---

## Task: Design a New Module or Service

**Persona**: Senior Engineer
**Read Order**:
1. `.cursor/skills/domain-driven-design/SKILL.md` — **PRIMARY**: confirm bounded context + ubiquitous language
2. `.cursor/skills/interface-designer/SKILL.md` — **REQUIRED**: design contract before implementation
3. `.cursor/skills/canonical-type-reuse/SKILL.md` — **REQUIRED**: invoked inside Interface Designer
4. `.cursor/skills/module-design-pattern/SKILL.md` — **REQUIRED**: scaffold layout
5. `docs/agent/standards/common/typescript.md` — **REFERENCE**: compiler rules

**Key Decision Points**:
- Does this belong in `src/core/` or `src/domains/{name}/`?
- Are the endpoints for this domain defined in `docs/api/openapi.yaml`? If not, update the spec first.
- Is there an existing canonical type for any cross-cutting concern?
- What is exported from `index.ts`? (public surface only)

---

## Task: Implement a NestJS Service

**Persona**: Mid Engineer
**Read Order**:
1. `.cursor/skills/coding-conventions/SKILL.md` — **PRIMARY**: SOLID rules, DTO rules, error handling
2. `.cursor/skills/module-design-pattern/SKILL.md` — **REQUIRED**: correct file layout
3. `docs/api/openapi.yaml` (relevant domain section) — **REQUIRED**: verify implementation matches spec
4. `docs/agent/standards/common/typescript.md` — **REQUIRED**: strict type rules
5. `docs/agent/standards/common/anti-patterns.md` — **REFERENCE**: what to avoid

**Key Decision Points**:
- Is logic in the service (not controller)?
- Does the implementation match the OpenAPI spec response shape?
- Are all external dependencies injected (not instantiated)?
- Are DTOs validated with `class-validator`?

---

## Task: Design a TypeScript Interface or Contract

**Persona**: Senior Engineer
**Read Order**:
1. `.cursor/skills/interface-designer/SKILL.md` — **PRIMARY**: full workflow
2. `.cursor/skills/canonical-type-reuse/SKILL.md` — **REQUIRED**: invoked automatically
3. `docs/agent/standards/common/typescript.md` — **REQUIRED**: `readonly`, explicit types
4. `docs/agent/standards/common/canonical-types.md` — **REFERENCE**: canonical type catalog

**Key Decision Points**:
- Are the relevant endpoints defined in `docs/api/openapi.yaml`?
- Are all cross-cutting concerns (logging, error, pagination) using canonical types?
- Are properties `readonly`?
- Is the YAML contract produced before any implementation?

---

## Task: Write Tests

**Persona**: QA Tester
**Read Order**:
1. `.cursor/skills/testing/SKILL.md` — **PRIMARY**: full workflow
2. `docs/agent/standards/testing/unit.md` — **REQUIRED** for unit tests
3. `docs/agent/standards/testing/integration.md` — **CONDITIONAL** for integration tests
4. `docs/agent/standards/testing/e2e.md` — **CONDITIONAL** for E2E tests

**Key Decision Points**:
- What test type? (unit → integration → E2E)
- Is Docker Compose running for integration tests?
- Does every E2E test check the status code per the OpenAPI spec?
- Is coverage ≥ 85% for the touched services?

---

## Task: Review Code

**Persona**: Any
**Read Order**:
1. `docs/agent/standards/common/anti-patterns.md` — **PRIMARY**: check for violations
2. `docs/agent/standards/common/naming.md` — **REQUIRED**: naming compliance
3. `docs/agent/standards/common/typescript.md` — **REQUIRED**: type safety checks
4. `.cursor/skills/coding-conventions/SKILL.md` — **REFERENCE**: SOLID checks

**Key Decision Points**:
- Does the implementation match `docs/api/openapi.yaml` for all modified endpoints?
- Fat controller? (business logic in controller instead of service)
- `any` types used?
- Swallowed errors?
- Raw strings for error messages?

---

## Task: Create a Pull Request

**Persona**: Any
**Read Order**:
1. `.cursor/skills/create-pr/SKILL.md` — **PRIMARY**: full template + checklist

**Key Decision Points**:
- Are all CI checks green?
- Is test coverage ≥ 85% for changed services?
- Is `docs/api/openapi.yaml` updated for changed endpoints?

---

## Task: Set Up or Modify CI/CD

**Persona**: Senior Engineer
**Read Order**:
1. `.cursor/skills/deployments-github-actions/SKILL.md` — **PRIMARY**: full workflow
2. `.cursor/skills/ci-monitoring-subagents/SKILL.md` — **REQUIRED**: monitoring setup

**Key Decision Points**:
- Does `ci.yml` run lint + typecheck + unit + integration + E2E?
- Are secrets sourced from GitHub Secrets (never hardcoded)?

---

## Task: Diagnose a CI Failure

**Persona**: QA Tester or Senior Engineer
**Read Order**:
1. `.cursor/skills/ci-monitoring-subagents/SKILL.md` — **PRIMARY**: one-shot diagnostic

**Key Decision Points**:
- Is this a compile error, test failure, lint failure, or coverage failure?
- Which command to run first (lint → type-check → test)?

---

## Task: Batch Ingestion Feature

**Persona**: Senior Engineer → Mid Engineer → QA Tester
**Read Order**:
1. `docs/api/openapi.yaml` (Batch section) — **PRIMARY**: `BatchRequest`, `BatchResponse`, `BatchStatus` schemas
2. `.cursor/skills/interface-designer/SKILL.md` — **REQUIRED**: BatchService contract
3. `.cursor/skills/coding-conventions/SKILL.md` — **REQUIRED**: BullMQ worker patterns
4. `.cursor/skills/testing/SKILL.md` — **REQUIRED**: load test patterns

**Key Decision Points**:
- ≤100 jobs: sync (200 OK with full `BatchStatus`)
- >100 jobs: async BullMQ (202 Accepted with `batchId`)
- Deduplication key: `externalId` + source
- Priority ordering: `direct`/`api` > `scraped` in search results

---

## Task: Auth Domain Feature

**Persona**: Senior Engineer → Mid Engineer → QA Tester
**Read Order**:
1. `docs/api/openapi.yaml` (Auth section) — **PRIMARY**: all 7 auth endpoints
2. `.cursor/skills/interface-designer/SKILL.md` — **REQUIRED**: AuthService contract
3. `docs/agent/standards/common/security.md` — **REQUIRED**: JWT, bcrypt, token rotation

**Key Decision Points**:
- Access token TTL: 15 minutes (env: `JWT_ACCESS_EXPIRES_IN`)
- Refresh token rotation on every use
- `forgot-password` always returns 200 (prevents email enumeration)
- Migrated users: `passwordRequiresReset: true` flag until they set a new password

---

## Task: Monorepo / Repository Setup

**Persona**: Any engineer or agent touching root layout
**Read Order**:
1. `docs/agent/standards/common/monorepo.md` — **PRIMARY**: workspaces, scripts, env, tests
2. `docs/agent/standards/common/repository-setup.md` — **REQUIRED**: root README + `.env.example`
3. [`README.md`](../../../README.md) — **REFERENCE**: canonical onboarding doc

**Key Decision Points**:
- Single `bun install` at repo root (workspaces)
- Root `.env` only — no `src/api/.env.example`
- API scripts in `src/api/package.json`; root `api:*` delegates only
- semantic-release at root for CI; `@semantic-release/*` also in `src/api` for extractability

---

## Task: Quick Apply Feature

**Persona**: Mid Engineer → QA Tester
**Read Order**:
1. `docs/api/openapi.yaml` (`POST /api/v1/jobs/:jobId/apply`) — **PRIMARY**
2. `.cursor/skills/coding-conventions/SKILL.md` — **REQUIRED**: rate limiting, duplicate check
3. `docs/agent/standards/common/security.md` — **REFERENCE**: rate limiting patterns

**Key Decision Points**:
- Unauthenticated apply: `name` + `phone` required in body
- Authenticated apply: profile snapshot applied; `name`/`phone` optional
- Duplicate check: 409 if already applied (unique constraint on job_id + applicant_id)
- Rate limit: 10 applies/IP/hour
- Interview slot booking is atomic (transaction)
