# Module Structure, Barrel Imports, and Import Conventions

## Barrel rules

1. Every domain module has an `index.ts` that exports only its **public surface**.
2. Always import from the barrel (`index.ts`), never from internal files.
3. Domain modules import from `src/core/` only for cross-cutting capabilities.
4. Cross-domain imports are **forbidden** — domains are independent bounded contexts.
5. Only `src/core/` modules use `@Global()` — never domain modules.

## Example: Correct barrel

```typescript
// src/domains/jobs/index.ts — public surface only
export { JobsService } from "./jobs.service.js";
export type { JobSummary, JobDetailResponse, PaginatedJobsResponse } from "./types.js";

// Do NOT export: JobsController, internal helpers, DTOs, migration logic
```

## Example: Correct import

```typescript
// From within the applications domain, importing jobs service:
import { JobsService } from "@domains/jobs"; // path alias → barrel — correct

// Never:
import { JobsService } from "../jobs/jobs.service.js"; // direct file — forbidden
```

---

## Import extension rules (NodeNext module resolution)

This project uses `"moduleResolution": "NodeNext"` (inherited from `tsconfig.base.json`).
Under NodeNext, the runtime resolves import paths exactly as written. TypeScript maps `.js` → `.ts`
at compile time; Node.js finds the compiled `.js` in `dist/` at runtime.

| Import type | Extension rule | Example |
|---|---|---|
| **Relative** (own source files) | `.js` **required** | `import { X } from "./x.js"` |
| **Package** (`node_modules`) | None | `import { X } from "@nestjs/common"` |
| **Path alias** (`@core/*`, `@domains/*`) | None | `import { X } from "@core/database/prisma.service"` |
| **Node built-ins** | `node:` prefix, no extension | `import { createHash } from "node:crypto"` |

```typescript
// ✅ All correct
import { Injectable } from "@nestjs/common";           // package — no extension
import { createHash } from "node:crypto";              // built-in — node: prefix
import { PrismaService } from "@core/database/prisma.service"; // alias — no extension
import type { AuthUser } from "./jwt.strategy.js";     // relative — .js required
export { BatchService } from "./batch.service.js";     // re-export — .js required

// ❌ All forbidden
import { X } from "./x";           // missing extension — runtime resolution failure
import { X } from "./x.ts";        // .ts does not exist in dist/ at runtime
import { X } from "@nestjs/common/index.js"; // package specifier with extension
```

---

## Module wiring template

```typescript
@Module({
  imports: [
    // @Global() core modules — always available, do not re-import if already global
    // DatabaseModule, ConfigModule, QueueModule are @Global() — omit here
  ],
  providers: [JobsService, BatchService, BatchAuthGuard],
  controllers: [JobsController],
  exports: [JobsService], // only what other modules genuinely need
})
export class JobsModule {}
```

- Never import a `@Global()` module in domain modules — it is already available everywhere.
- Never include a provider in `exports` unless another module's provider injects it.

---

## DI tokens for adapter interfaces

When a domain depends on an abstraction (not a concrete class):

```typescript
// src/domains/jobs/jobs.tokens.ts
export const JOB_SEARCH_PROVIDER = Symbol("JOB_SEARCH_PROVIDER");

// Provide in module:
{
  provide: JOB_SEARCH_PROVIDER,
  useClass: PrismaJobSearchProvider,
}

// Inject in service:
constructor(
  @Inject(JOB_SEARCH_PROVIDER) private readonly search: IJobSearchProvider,
) {}
```

---

## Path alias scope

Path aliases (`@core/*`, `@domains/*`) are **compile-time only**. They are resolved by the
TypeScript compiler and mapped in `moduleNameMapper` for Jest. They are **not** available at
runtime — do not use them in scripts, seeding files, or anything that runs without `tsc` or
Jest's transformer in the chain.

```typescript
// ✅ Source and test files — alias works (compiled by tsc or Jest)
import { PrismaService } from "@core/database/prisma.service";

// ❌ Shell scripts, raw Node.js, bun -e "..." — alias not resolved
// Use a relative path or compile first
```
