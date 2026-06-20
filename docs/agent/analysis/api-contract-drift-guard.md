# API Contract Drift Guard

The HTTP API is **code-first** (controllers under `src/api/src/domains/**` and `src/api/src/core/**`), but the OpenAPI document at [`docs/api/openapi.yaml`](../../api/openapi.yaml) is **hand-authored**. Without enforcement, the published contract (SwaggerHub, Postman) can drift from the running NestJS routes.

This guard **detects drift** by introspecting registered controllers and diffing against operations marked `x-implemented: true` in the spec.

## How it works

```
NestJS controllers  →  ApiContractService.extractRouteSurface()
docs/api/openapi.yaml (x-implemented: true)  →  OpenApiSpecLoader
                              ↓
                    ApiContractService.diff()
                              ↓
              exit 0 (in sync) | exit 1 (drift)
```

- **Route identity**: `METHOD` + normalized path (`/api/v1/jobs/{}`) + ordered param names.
- **Future endpoints** in the spec without `x-implemented: true` are ignored until implemented.
- **No `@nestjs/swagger` required** for detection — only route metadata.

## Commands

```bash
# From repo root
bun run api:validate          # YAML syntax only
bun run api:contract:check    # route surface ↔ implemented spec ops

# From src/api/
bun run contract:check
bun run contract:check -- --spec ../../docs/api/openapi.yaml
```

## CI integration

The **API Contract Drift Guard** job in [`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml) runs on every push/PR that touches `src/api/**` or `docs/api/openapi.yaml`:

1. `bun run api:validate` — OpenAPI 3 structural validation
2. `bun run api:contract:check` — route surface ↔ `x-implemented` operations

No database, Redis, or MinIO required. Unit and integration test jobs **depend on this job passing** (fail-closed).

[`.github/workflows/publish-swagger.yml`](../../../.github/workflows/publish-swagger.yml) runs the same gates before pushing to SwaggerHub on `main` when the spec changes.

Postman **runtime** validation (Newman against a live API) lives in [`.github/workflows/postman.yml`](../../../.github/workflows/postman.yml).

## When CI fails

1. Implement the route **or** remove erroneous `x-implemented: true` from the spec.
2. Update `docs/api/openapi.yaml` so method + path + param names match NestJS.
3. Update `src/api/postman/` if the HTTP surface changed.
4. Re-run `bun run api:contract:check`.

## Implementation

| Piece | Location |
| ----- | -------- |
| Diff service | `src/api/src/domains/api-contract/` |
| CLI | `src/api/scripts/check-api-contract.ts` |
| Tests | `test/unit/domains/api-contract/`, `test/integration/api-contract.integration.spec.ts`, `test/e2e/api-contract.e2e-spec.ts` |

Adapted from the AgentOps prototype (`openclaw-pilot`) contract guard pattern.
