---
name: canonical-type-reuse
description: Check whether a type belongs in src/core/ before defining it in a domain. Use inside Interface Designer before creating any new type.
---

# Skill: Canonical Type Reuse

**Applicable Personas**: Senior Engineer (invoked inside Interface Designer)

---

## Before Defining Any New Type

1. Search `src/api/src/core/` for an existing type
2. Check `docs/agent/standards/common/canonical-types.md`
3. If a matching type exists, use it — do not redefine
4. If a type will be used in 2+ domains, it belongs in `src/core/`, not a domain

---

## Canonical Types (already defined in `src/core/`)

| Type | Location | Use for |
|---|---|---|
| `PaginatedResult<T>` | `src/core/types.ts` | All list/search returns |
| `PaginationParams` | `src/core/types.ts` | All search/filter DTOs |
| `AppError` | `src/core/error/` | Base error class |
| `NotFoundError` | `src/core/error/` | 404 errors |
| `ConflictError` | `src/core/error/` | 409 errors |
| `ValidationError` | `src/core/error/` | 422 errors |
| `UnauthorizedError` | `src/core/error/` | 401 errors |
| `ForbiddenError` | `src/core/error/` | 403 errors |
| `AuditEntry` | `src/core/audit/` | Mutation audit records |
| `StorageUploadResult` | `src/core/storage/` | File upload responses |
| `UserId` | `src/core/types.ts` | User UUID typed alias |

## Domain-Specific Types (defined in domain `types.ts`)

These are NOT canonical — they live in the domain that owns them:

- `Job`, `JobSummary`, `JobStatus`, `JobSourceType` → `src/domains/jobs/types.ts`
- `Application`, `ApplicationStatus` → `src/domains/applications/types.ts`
- `Company` → `src/domains/companies/types.ts`
- `BatchJobItem`, `BatchStatus` → `src/domains/batch/types.ts`
- `UserEntity`, `TokenPair` → `src/domains/auth/types.ts`
