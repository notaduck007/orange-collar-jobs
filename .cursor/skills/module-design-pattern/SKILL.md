---
name: module-design-pattern
description: Enforce consistent NestJS module structure, barrel exports, and public-surface boundaries. Use when scaffolding a new module, wiring @Module imports/exports, or fixing cross-module import boundary violations.
---

# Skill: Module Design Pattern

**Applicable Personas**: Senior Engineer, Mid Engineer

---

## Canonical Domain Module Layout

```
src/api/src/domains/{domain}/
├── {domain}.module.ts         # @Module decorator — wires imports/exports
├── {Domain}Controller.ts      # HTTP endpoints
├── {Domain}Service.ts         # Primary service — business logic
├── {SubConcept}Service.ts     # Additional services (one per responsibility)
├── dtos/
│   ├── Create{Domain}Dto.ts
│   ├── Update{Domain}Dto.ts
│   └── {Domain}SearchDto.ts
├── types.ts                   # Domain types, interfaces, enums
└── index.ts                   # Barrel — public surface only
```

## Canonical Core Module Layout

```
src/api/src/core/{capability}/
├── {capability}.module.ts     # @Global() @Module
├── types.ts                   # Shared canonical types
├── {Capability}Service.ts     # Stateful service (if any)
└── index.ts                   # Barrel — all public symbols
```

## Module Wiring Rules

```typescript
@Module({
  imports: [DatabaseModule, ConfigModule], // only what this module needs
  providers: [JobsService, JobSlugService],
  controllers: [JobsController],
  exports: [JobsService], // only what other modules need
})
export class JobsModule {}
```

## Barrel Rules

```typescript
// index.ts — export only what other modules may import
export { JobsService } from "./JobsService";
export type { Job, JobSummary } from "./types";
// Do NOT export: DTOs, internal helpers, controller
```

## Forbidden

- `import { JobsService } from '../jobs/JobsService'` — always use barrel
- Cross-domain direct import: `import { AuthService } from '../auth/AuthService'` inside `jobs/`
- `@Global()` on domain modules
- Business logic in `@Module()` decorator
