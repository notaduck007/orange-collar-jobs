# Canonical Types

Types that MUST come from `src/api/src/core/` and must not be redefined in any domain.

## Pagination

```typescript
// src/core/types.ts
export interface PaginationParams {
  readonly page: number;      // default: 1
  readonly pageSize: number;  // default: 20, max: 100
}

export interface PaginationMeta {
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
}

export interface PaginatedResult<T> {
  readonly data: T[];
  readonly meta: PaginationMeta;
}
```

## Typed ID Aliases

```typescript
// src/core/types.ts
export type UserId = string;       // UUID — never accept raw string where UserId expected
export type JobId = string;        // UUID
export type CompanyId = string;    // UUID
export type ApplicationId = string; // UUID
```

## Error Classes

All in `src/core/error/`:

```typescript
AppError(message, code, statusCode)        // base
NotFoundError(resource, id)                // 404
ConflictError(message)                     // 409
ValidationError(message, details?)         // 422
UnauthorizedError(message?)                // 401
ForbiddenError(message?)                   // 403
InsufficientCreditsError(companyPackageId) // 402 (domain-specific 4xx)
```

## Storage

```typescript
// src/core/storage/types.ts
export interface StorageUploadResult {
  readonly key: string;
  readonly bucket: string;
  readonly url: string;
}
```

## Audit

```typescript
// src/core/audit/types.ts
export interface AuditEntry {
  readonly entityType: string;
  readonly entityId: string;
  readonly action: string;
  readonly actorId: string | null;
  readonly payload?: Record<string, unknown>;
}
```

## Rule: New Cross-Cutting Types

Before defining a new type, check whether it:
1. Is used in 2+ domains → belongs in `src/core/types.ts`
2. Is an error variant → belongs in `src/core/error/`
3. Is domain-specific (only used in one domain) → belongs in `src/domains/{name}/types.ts`
