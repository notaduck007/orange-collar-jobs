# Architecture Standard — Core vs Domains

This document answers definitively: **which code belongs in `src/core/` and which belongs in `src/domains/`?**

---

## The Layer Model

```
HTTP (Express)
      │
┌─────▼──────────────────────────────────────────────┐
│  Controllers  (src/domains/*/controllers/)          │  HTTP adapters — thin, no business logic
│  or           (src/core/*/me.controller.ts)         │
└─────┬──────────────────────────────────────────────┘
      │
┌─────▼──────────────────────────────────────────────┐
│  Domain Services  (src/domains/*/services/)         │  Business rules, orchestration
└─────┬──────────────────────────────────────────────┘
      │
┌─────▼──────────────────────────────────────────────┐
│  Core Capabilities  (src/core/*)                    │  Infrastructure, cross-cutting concerns
│    config · database · logging · error              │
│    auth (JWT guards/strategy) · health              │
│    queue (BullMQ wiring) · storage (S3/MinIO)       │
│    sms (Twilio adapter)                             │
└─────┬──────────────────────────────────────────────┘
      │
┌─────▼──────────────────────────────────────────────┐
│  Prisma ORM / Redis / MinIO / Twilio                │
└────────────────────────────────────────────────────┘
```

---

## `src/core/` — Infrastructure & Cross-Cutting Concerns

`core/` modules are `@Global()`. Every domain can use them without importing them explicitly. They provide **capabilities** — not business rules.

| Module | What it provides | Why it is core |
|---|---|---|
| `config` | Validated env vars via Zod + `ConfigService` | Needed by every other module |
| `database` | `PrismaService` — singleton DB connection | Shared across all domains |
| `logging` | Pino-structured request logging | Cross-cutting; applies to every request |
| `error` | `GlobalExceptionFilter` + typed error classes | Applies to all routes globally |
| `health` | `/api/health` liveness check | Infrastructure probe, not business logic |
| `auth` | JWT strategy, `JwtAuthGuard`, `RolesGuard`, `@Public`, `@Roles`, `@CurrentUser` | The **infrastructure** of auth — guards applied globally to every controller |
| `queue` | BullMQ / Redis connection setup | Infrastructure shared by any domain that queues work |
| `storage` | `StorageService` — S3/MinIO adapter | Infrastructure shared by any domain that stores files |
| `sms` | `SmsService` — Twilio adapter | Infrastructure shared by any domain that sends SMS |

### auth in core — rationale

`core/auth` contains **only** the JWT infrastructure layer:

- `JwtStrategy` — extracts and cryptographically validates the token, looks up the user row once
- `JwtAuthGuard` — applies `JwtStrategy` to every request (skipped for `@Public` routes)
- `RolesGuard` — enforces the `@Roles()` decorator
- `MeController` — one-liner: returns the already-validated `AuthUser` from the request context
- `@CurrentUser`, `@Public`, `@Roles` — decorators that are shared across every domain controller

These are **infrastructure concerns**: they apply globally, they depend only on `ConfigService` and `PrismaService`, and they contain no product-specific business logic.

**Auth business logic belongs in `src/domains/auth/`**:

| Feature | Location |
|---|---|
| `POST /api/v1/auth/register` | `src/domains/auth/` |
| `POST /api/v1/auth/login` | `src/domains/auth/` |
| `POST /api/v1/auth/logout` | `src/domains/auth/` |
| `POST /api/v1/auth/refresh` | `src/domains/auth/` |
| `POST /api/v1/auth/forgot-password` | `src/domains/auth/` |
| `POST /api/v1/auth/reset-password` | `src/domains/auth/` |
| `POST /api/v1/auth/verify-email` | `src/domains/auth/` |
| Password hashing, token rotation, refresh-token storage | `src/domains/auth/` |

---

## `src/domains/` — Bounded Contexts

Each domain is a **bounded context**: it owns a coherent slice of the product. Domains depend on core modules and on each other only through explicit interfaces (never by importing internal files of another domain).

| Domain | Planned phase | Business rules it owns |
|---|---|---|
| `auth` | Phase 2 | Register, login, logout, token refresh, email verification, password reset |
| `jobs` | Phase 3 | Job CRUD, batch ingestion, deduplication, search, status lifecycle |
| `applications` | Phase 5 | Apply to a job, track application status, employer review |
| `companies` | Phase 6 | Company profile, logo upload, billing |
| `admin` | Phase 6 | Content moderation, ad management, user management |

### Domain structure template

```
src/domains/{name}/
├── index.ts                  ← barrel — exports the module and public types only
├── {name}.module.ts
├── controllers/
│   └── {name}.controller.ts  ← version: '1' on the @Controller decorator
├── services/
│   └── {name}.service.ts
├── dto/
│   ├── create-{name}.dto.ts
│   └── update-{name}.dto.ts
└── types.ts                  ← domain-specific types (internal); shared types live in core
```

---

## Hard Rules

1. **`core/` modules never import from `domains/`.**
2. **`domains/` never import another domain's internal files** — only that domain's barrel (`index.ts`).
3. **Infrastructure adapters (queue, storage, sms) live in `core/`** even though they feel like "services" — they expose a capability, not a business rule.
4. **When a domain needs to send SMS, it injects `SmsService` from `core/sms`** — it does not own the adapter.
5. **Only `@Global()` modules are in `core/`** — each domain module is registered locally in `AppModule`.

---

## Decision Tree: Core or Domain?

```
Does this module contain product-specific business rules?
├── YES → domains/
└── NO
    └── Is it a technical adapter / cross-cutting concern?
        ├── YES → core/
        └── UNSURE → ask: "would a second product reuse this module unchanged?"
            ├── YES → core/
            └── NO  → domains/
```
