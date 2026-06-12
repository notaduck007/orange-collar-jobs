---
name: interface-designer
description: Design a service or adapter contract in YAML before any implementation begins. Use when designing any new service interface, adapter, or cross-domain contract.
---

# Skill: Interface Designer

**Applicable Personas**: Senior Engineer

---

## Purpose

Produce a stable YAML interface contract **before** any implementation code is written.
No implementation begins until the contract is reviewed and approved.

---

## When to Use

- Designing a new domain service (`JobsService`, `BatchService`, `AuthService`)
- Designing an adapter interface (`IStorageProvider`, `IEmailProvider`)
- Designing a cross-domain shared type

---

## Workflow

### Step 1 — Read the OpenAPI spec

Find the relevant endpoints in `docs/api/openapi.yaml`. Extract:
- Request/response schemas
- Error codes
- Auth requirements
- State machine transitions (if applicable)

### Step 2 — Produce the YAML contract

```yaml
# docs/agent/analysis/contracts/{domain}-service.yaml
service: JobsService
domain: jobs
boundedContext: Job lifecycle — creation, search, update, and close

methods:
  - name: create
    description: Creates a job and returns the persisted entity. Validates company ownership (vendor) or admin override.
    inputs:
      - name: dto
        type: CreateJobDto
      - name: user
        type: UserEntity
    returns: Promise<Job>
    throws:
      - NotFoundError: company not found
      - ForbiddenError: vendor does not own the company
      - ConflictError: duplicate slug
      - InsufficientCreditsError: no posting credits remaining
    sideEffects:
      - Decrements company_package.posts_remaining (vendor only)
      - Creates screening_questions rows atomically (if provided)
      - Writes AuditEntry

  - name: search
    description: Full-text search with filters. WJ-direct posts rank above scraped.
    inputs:
      - name: params
        type: JobSearchDto
    returns: Promise<PaginatedResult<JobSummary>>
    throws: []
    notes: sourceType ordering — direct/api/syndicated above scraped at equal recency
```

### Step 3 — Canonical Type Check

Before defining new types, run the canonical-type-reuse skill to check `src/core/`.

### Step 4 — Get Approval

Present the YAML contract. Do NOT write implementation until it is approved.

### Step 5 — Hand Off to Agent 2

Pass the approved YAML contract to the Backend Implementation Agent.
