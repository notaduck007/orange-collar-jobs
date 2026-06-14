# Phase Backwards Compatibility Standard

**Status**: Mandatory for all phases (Phase 2 onward)  
**Applies to**: API endpoints, tests, demo scripts, Postman collections, frontend routes, agent workflows

---

## Purpose

Each phase adds capabilities **without breaking** deliverables from prior phases. Clients, demo scripts, CI, and documentation from earlier phases must continue to work unless an explicit, versioned API deprecation is approved and documented in OpenAPI.

This is a **hard gate**: no phase is complete until backwards compatibility is demonstrated by automated tests and documented walkthroughs.

---

## Rules

### 1. API surface

| Rule | Detail |
|------|--------|
| **No silent removals** | Endpoints, paths, and response shapes from prior phases must remain available at the same URI version (`/api/v1/…`) until a major API version bump. |
| **Additive changes only** | New phases add modules, routes, or optional fields — they do not rename, relocate, or change semantics of existing contract fields without updating `docs/api/openapi.yaml` first. |
| **Version-neutral health** | `GET /api/health` (Phase 1) must remain unversioned and healthy after every phase. |
| **Core auth guard** | `GET /api/v1/me` (Phase 1) must remain protected by JWT; behaviour may extend (e.g. verified-email check) but must not return 200 without a valid token. |

### 2. Tests (mandatory per phase)

Every phase PR must include:

1. **Phase N tests** — unit, integration, and E2E coverage for new deliverables.
2. **Backwards-compat tests** — automated proof that prior phase critical paths still pass:
   - File: `src/api/test/e2e/phase{N-1}-backwards-compat.e2e-spec.ts` (or cumulative `phase1-backwards-compat.e2e-spec.ts` updated each phase).
   - Integration: prior phase health (and other DB-touching paths) still green in `test/integration/`.
3. **Demo script** — `./scripts/phase{N}-demo.sh` runs Phase N gate **and** invokes or embeds Phase 1 smoke (health + prior critical endpoints).

### 3. Documentation & tooling

| Artifact | Requirement |
|----------|-------------|
| `docs/demo/phase{N}-demo.md` | Step-by-step Postman + frontend walkthrough with **expected status codes and JSON shapes** for visual inspection. |
| Postman collection | Prior requests remain; new requests added; walkthrough folder documents order. |
| `docs/plan.md` | Phase quality gate includes backwards-compat checklist item. |
| Agent docs | `CLAUDE.md`, `AGENTS.md`, `AGENT-TASK-INDEX.md` reference this standard. |

### 4. Frontend

- New API integration must not remove Phase 1 diagnostics (`/dev/diagnostics`, `GET /api/health`) or break existing public routes.
- Auth migration (Phase 2+) may replace Supabase for **auth flows** but must not break unauthenticated browsing of public pages.

### 5. Deprecation (exception path)

Breaking changes require:

1. OpenAPI change with deprecation notice and timeline.
2. Entry in `docs/plan.md` and changelog.
3. Human approval before merge.
4. Major version path (`/api/v2/…`) if the breaking change cannot be avoided.

---

## Phase 1 critical paths (baseline registry)

Maintain this list as the minimum backwards-compat surface. Extend when a phase adds a **stable** endpoint that later phases must not break.

| Path | Method | Phase | Expected |
|------|--------|-------|----------|
| `/api/health` | GET | 1 | 200, `status: ok`, dependencies reported |
| `/api/v1/me` | GET | 1 | 401 without token; 200 with valid verified JWT |
| `/api/docs` | GET | 1 | 200 in development |

Phase 2 additions (also protected going forward):

| Path | Method | Phase | Expected |
|------|--------|-------|----------|
| `/api/v1/auth/register` | POST | 2 | 201 |
| `/api/v1/auth/login` | POST | 2 | 200 verified / 401 unverified |
| `/api/v1/auth/logout` | POST | 2 | 204 with Bearer |
| `/api/v1/auth/refresh` | POST | 2 | 200 |
| `/api/v1/auth/verify-email` | POST | 2 | 200 |
| `/api/v1/auth/forgot-password` | POST | 2 | 200 |
| `/api/v1/auth/reset-password` | POST | 2 | 200 |

---

## Agent checklist (before marking a phase complete)

- [ ] All new endpoints match `docs/api/openapi.yaml`.
- [ ] Unit + integration + E2E tests for new domain code.
- [ ] `phase1-backwards-compat` (or cumulative) E2E tests pass.
- [ ] `./scripts/phase{N}-demo.sh` passes (includes prior-phase smoke).
- [ ] `docs/demo/phase{N}-demo.md` covers Postman + frontend visual inspection.
- [ ] Postman collection updated; Phase 1 requests still valid.
- [ ] `bun run api:validate` passes on OpenAPI spec.

---

## Related

- Phase plan: [`docs/plan.md`](../../../plan.md)
- Testing: [`testing/e2e.md`](./e2e.md), [`testing/integration.md`](./integration.md)
- API versioning: [`.cursor/skills/api-versioning/SKILL.md`](../../../../.cursor/skills/api-versioning/SKILL.md)
