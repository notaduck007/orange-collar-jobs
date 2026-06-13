# API Versioning Skill

**Use when**: Adding a new controller, changing a route path, introducing a breaking change, or reviewing how versioning works.

---

## Guiding Principle

Versioning must be **invisible to unchanged consumers**. Upgrading from v1 to v2 of a single endpoint should take seconds, with no side effects on any v1 consumer. Upgrading in the other direction (rolling back) must also be safe.

---

## How Versioning Works in This Codebase

### Setup (already configured in `src/app.factory.ts`)

```typescript
app.setGlobalPrefix('api');
app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
```

This produces:

| Controller decorator | Resolved URL |
|---|---|
| `@Controller({ path: 'me', version: '1' })` | `GET /api/v1/me` |
| `@Controller({ path: 'jobs', version: '1' })` | `GET /api/v1/jobs` |
| `@Controller({ path: 'jobs', version: ['1','2'] })` | `GET /api/v1/jobs` AND `GET /api/v2/jobs` |
| `@Controller({ path: 'health', version: VERSION_NEUTRAL })` | `GET /api/health` (no version segment) |

### Rules

1. **Always put `version` on the controller class**, not individual methods.
   ```typescript
   // CORRECT
   @Controller({ path: 'jobs', version: '1' })
   export class JobsController {}

   // WRONG — version on method creates inconsistency within a controller
   @Controller('jobs')
   export class JobsController {
     @Version('1')
     @Get() list() {}
   }
   ```

2. **Health is always `VERSION_NEUTRAL`** — load balancers probe `/api/health` without a version segment.

3. **Tests must go through `configureApp()`** — use `createTestApp()` from `test/helpers/create-test-app.ts`. Never bootstrap NestJS manually in tests because manually-created apps skip `enableVersioning()` and produce misleading 404s.

4. **`defaultVersion: '1'`** means controllers annotated with `version: '1'` get the `v1` segment. Controllers with no version annotation also get `v1` (the default). Prefer explicit `version: '1'` on every controller — it makes promotions to v2 explicit and reviewable.

---

## Adding a New v1 Controller

```typescript
@ApiTags('Jobs')
@ApiBearerAuth()
@Controller({ path: 'jobs', version: '1' })   // ← always on the class
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  @Roles('EMPLOYER', 'ADMIN')
  list(): Promise<Job[]> { return this.jobsService.list(); }
}
```

The route is: `GET /api/v1/jobs`.

---

## Introducing a Breaking Change (v1 → v2)

Backward-compatible changes (adding optional fields, new endpoints, looser validation) do **not** require a version bump. Only use v2 for changes that would break existing v1 consumers.

**Step 1** — Add `v2` to the OpenAPI spec first (`docs/api/openapi.yaml`). A phase gate blocks implementation until the spec is updated.

**Step 2** — Create the new controller version. Do NOT modify the v1 controller.

```typescript
// src/domains/jobs/controllers/jobs-v2.controller.ts
@Controller({ path: 'jobs', version: '2' })
export class JobsV2Controller {
  // new shape — v1 consumers are unaffected
}
```

**Step 3** — Register both controllers in the module. Both routes are now live:
- `GET /api/v1/jobs` → `JobsController` (unchanged)
- `GET /api/v2/jobs` → `JobsV2Controller` (new behaviour)

**Step 4** — Add E2E tests for v2. Run the full quality gate.

**Step 5** — When all consumers have migrated, remove `JobsController` (v1) in a separate PR with a clear migration notice in the changelog.

### Multiple-version support on a single controller

For cases where v1 and v2 differ only slightly, a controller can handle both:

```typescript
@Controller({ path: 'jobs', version: ['1', '2'] })
export class JobsController {
  @Get()
  list() { /* shared logic */ }
}
```

Use this sparingly — it couples the versions. A separate controller per version is cleaner for significant changes.

---

## Deprecating a Version

1. Add a `Deprecation` response header via a custom interceptor.
2. Log a warning in the service when the deprecated version is called.
3. Set a sunset date in the OpenAPI spec.
4. Remove after the sunset date and bump the OpenAPI spec version.

---

## Architecture Decision: Where Versioning Lives

The `configureApp()` function in `src/app.factory.ts` is the **single source of versioning truth**. It is imported by both `main.ts` (production) and `test/helpers/create-test-app.ts` (tests). This eliminates drift.

Never call `app.enableVersioning()` or `app.setGlobalPrefix()` anywhere else.
