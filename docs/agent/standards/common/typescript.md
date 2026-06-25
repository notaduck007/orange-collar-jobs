# TypeScript Standard

## Compiler Configuration (non-negotiable)

### Root `tsconfig.base.json` — governs all packages

```json
{
  "module": "NodeNext",
  "moduleResolution": "NodeNext",
  "strict": true,
  "strictNullChecks": true,
  "noImplicitAny": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "exactOptionalPropertyTypes": true,
  "target": "ES2022"
}
```

These settings are **inherited by every `tsconfig.json`** in the monorepo.
**Never override `module` or `moduleResolution`** in a child tsconfig — doing so breaks the
extension contract and hides resolution errors that would surface in production.

### `src/api/tsconfig.json` — API-specific additions only

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "baseUrl": "./",
    "paths": {
      "@core/*": ["src/core/*"],
      "@domains/*": ["src/domains/*"]
    }
  }
}
```

`module` and `moduleResolution` are **not overridden** here. They inherit `NodeNext` from the
base.  Output format stays **CommonJS** because `src/api/package.json` has no `"type": "module"`.
When the project migrates to full ESM, only `"type": "module"` needs to be added — no import
paths change.

### Frontend `tsconfig.json` — Vite projects

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "moduleResolution": "Bundler"
  }
}
```

The frontend overrides `moduleResolution` to `"Bundler"` because Vite owns resolution at build
time. No `.js` extensions are needed in frontend source files — Vite resolves them.

---

## Import Rules

### Rule 1 — Relative imports MUST use `.js` extensions

`"moduleResolution": "NodeNext"` follows the Node.js ESM spec literally: the runtime resolves
the path as written. TypeScript maps `.js` → `.ts` at compile time; Node.js finds the compiled
`.js` in `dist/` at runtime.

```typescript
// ✅ Correct — NodeNext requires the .js extension on relative paths
import { PrismaService } from "../../core/database/prisma.service.js";
import type { AuthUser } from "../auth/jwt.strategy.js";

// ❌ Forbidden — NodeNext cannot resolve these at runtime
import { PrismaService } from "../../core/database/prisma.service";   // no extension
import { PrismaService } from "../../core/database/prisma.service.ts"; // .ts not valid at runtime
```

### Rule 2 — Package imports need no extension

Imports from `node_modules` are resolved by the package's own `exports` field. Never add `.js`
to package specifiers.

```typescript
// ✅ Correct
import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { Queue } from "bullmq";

// ❌ Forbidden
import { Injectable } from "@nestjs/common/index.js";
```

### Rule 3 — Path aliases (`@core/*`, `@domains/*`) need no extension

TypeScript path aliases are resolved by the compiler's `paths` map, not by the runtime. The
compiler handles extension resolution internally.

```typescript
// ✅ Correct — alias imports use no extension
import { PrismaService } from "@core/database/prisma.service";
import { JobsService } from "@domains/jobs";

// ❌ Technically works but misleading — alias resolution is not NodeNext path resolution
import { PrismaService } from "@core/database/prisma.service.js";
```

**Note**: Unit test files use path aliases (`@core/*`, `@domains/*`) which are mapped in
`jest-unit.json`'s `moduleNameMapper`. Integration and E2E tests use relative imports with
`.js` extensions to match the compiled output.

### Rule 4 — `import type` for type-only imports

```typescript
// ✅ Correct — no runtime cost, cleaner tree-shaking
import type { AuthUser } from "../auth/jwt.strategy.js";
import type { Env } from "../config/env.schema.js";

// ❌ Imports the entire module at runtime just for types
import { AuthUser } from "../auth/jwt.strategy.js";
```

### Rule 5 — Barrel imports for cross-module access

```typescript
// ✅ Import from the domain's public barrel
import { JobsService } from "@domains/jobs";

// ❌ Direct internal file access — breaks encapsulation
import { JobsService } from "../../jobs/jobs.service.js";
```

---

## Why NodeNext? (rationale for agents)

| Concern | CommonJS + `"Node"` resolution | NodeNext resolution |
|---|---|---|
| Extension on relative imports | Optional (ambiguous) | Required (explicit) |
| Resolution ambiguity | `"./foo"` could be `./foo.ts`, `./foo/index.ts`, `./foo.js` | `"./foo.js"` maps to exactly `./dist/foo.js` |
| ESM migration cost | High — all imports must be updated when migrating | Zero — imports are already correct |
| Prisma 7 / Node 24 alignment | Misaligned (Prisma 7 generates ESM-first) | Aligned |
| IDE go-to-definition accuracy | Occasionally wrong path | Exact |
| Horizontal scaling readiness | Requires full rewrite to ESM for tree-shaking | Add `"type":"module"` to `package.json` only |

---

## Type Safety Rules

- **No `any`** — use `unknown` + narrow with a type guard. Never `as any`.
- **No `!` non-null assertion** — narrow with `if (!x) throw new NotFoundError(...)`.
- **No `as` cast** without a Zod schema validation or type guard immediately above it.
- **Explicit return types** on all public service and controller methods.
- **`readonly`** on all immutable interface properties.
- **`exactOptionalPropertyTypes: true`** is active — optional properties must not be assigned `undefined` explicitly; omit them instead.

## Async

- Always `async/await` — never `.then()/.catch()` chains.
- Never fire-and-forget without explicit error handling:
  ```typescript
  // ✅ Correct
  void this.service.thing().catch((e: unknown) => this.logger.error(e));

  // ❌ Silent failure — swallowed error, no log
  this.service.thing();
  ```

## Enums vs Unions

- **Enums** for domain status values synced to Prisma: `JobStatus`, `ApplicationStatus`, `JobSourceType`.
- **String unions** for internal toggles and config flags: `type LogLevel = 'debug' | 'info' | 'warn' | 'error'`.

## DTOs

```typescript
export class CreateJobDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title!: string;               // definite assignment (!) — set by class-transformer

  @IsEnum(EmploymentType)
  employmentType!: EmploymentType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  payMin?: number;              // optional: no "!" needed
}
```

- `class-validator` decorators on every property.
- `class-transformer` for type coercion (`@Type(() => Number)`).
- `PartialType(CreateJobDto)` for update DTOs — never redefine shared fields.
