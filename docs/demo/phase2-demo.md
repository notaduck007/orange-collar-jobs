# Phase 2 Demo — Auth Domain (JWT)

**Phase**: 2 (complete)  
**Deliverable**: JWT authentication (7 endpoints) + frontend auth wired to NestJS API.  
**Backwards compatible with**: Phase 1 (`GET /api/health`, `GET /api/v1/me`, core modules, Docker, CI).

```bash
./scripts/phase2-demo.sh          # automated gate
bun run demo:phase2               # same
```

---

## Phase 2 deliverables checklist

| #   | Deliverable                      | Location                                    | Verified by                     |
| --- | -------------------------------- | ------------------------------------------- | ------------------------------- |
| 1   | Register, login, logout, refresh | `src/api/src/domains/auth/`                 | E2E + Postman walkthrough       |
| 2   | Email verification               | `verify-email` endpoint + frontend route    | Integration + E2E               |
| 3   | Forgot / reset password          | API + `/forgot-password`, `/reset-password` | Integration + E2E               |
| 4   | Unverified users blocked         | `AuthService.login`, `JwtStrategy`          | Unit + E2E                      |
| 5   | Token rotation on refresh        | `AuthService.refreshTokens`                 | Unit + E2E                      |
| 6   | Email adapter (dev logs)         | `src/api/src/core/email/`                   | Manual / Postman                |
| 7   | Frontend API auth                | `src/lib/auth.tsx`, `api-client.ts`         | Frontend walkthrough            |
| 8   | Phase 1 still works              | health, `/me`, guards                       | `phase1-backwards-compat` tests |
| 9   | OpenAPI contract                 | `docs/api/openapi.yaml`                     | `bun run api:validate`          |
| 10  | Postman collection               | `src/api/postman/`                          | Guided walkthrough folder       |

**Test coverage**: `AuthService` ≥ 85%, `AuthController` 100%, global ≥ 90% (see `bun run api:test:cov`).

---

## Prerequisites

```bash
bun run setup:env
docker compose up -d postgres redis minio
bun run api:migrate:dev
```

| Variable            | Example                 | Purpose             |
| ------------------- | ----------------------- | ------------------- |
| `JWT_SECRET`        | 32+ chars               | Token signing       |
| `CORS_ORIGIN`       | `http://localhost:8080` | Email link base URL |
| `VITE_API_BASE_URL` | `http://localhost:3001` | Frontend → API      |
| `DATABASE_URL`      | `localhost:5433`        | Postgres            |

Start API and frontend:

```bash
bun run api:dev    # :3001
bun run dev        # Vite :8080
```

---

## Part A — Postman walkthrough (visual inspection)

### Setup

1. Import `src/api/postman/warehousejobs.postman_collection.json`
2. Import `src/api/postman/warehousejobs.postman_environment.json`
3. Select environment **WarehouseJobs — Local Dev**

### Run folder: **Phase 2 — Walkthrough (run in order)**

| Step   | Request                 | What to inspect                             | Expected                                                   |
| ------ | ----------------------- | ------------------------------------------- | ---------------------------------------------------------- |
| **1**  | Health (Phase 1 compat) | Body tab                                    | `status: "ok"`, `info.db/redis/storage.status: "up"`       |
| **2**  | Register                | Sets unique `testEmail` automatically       | **201**, `userId`, message about verification              |
| **2b** | _(manual)_              | API terminal `[DEV EMAIL]` or Postgres      | Copy token → set env `verificationToken`                   |
| **3**  | Verify email            | Body                                        | **200**, `"Email verified successfully"`                   |
| **4**  | Login                   | Test Results: `bearerToken` saved           | **200**, `accessToken`, `refreshToken`, `expiresIn`        |
| **5**  | GET /me                 | Body                                        | **200**, `id`, `email`, `role` (`seeker`/`vendor`/`admin`) |
| **6**  | Refresh                 | `refreshToken` env updated                  | **200**, new token pair                                    |
| **7**  | Logout                  | Status only                                 | **204**                                                    |
| **8**  | Forgot password         | Body                                        | **200** (always, even unknown emails)                      |
| **8b** | _(manual)_              | `[DEV EMAIL]` or Postgres `password_resets` | Set env `resetToken`                                       |
| **9**  | Reset password          | Body                                        | **200**, password updated message                          |

### Get tokens from Postgres (when dev email is easier)

**Verification token** (after step 2):

```bash
docker compose exec -T postgres psql -U wj_user -d warehousejobs -c \
  "SELECT u.email, ev.token FROM email_verifications ev
   JOIN users u ON u.id = ev.user_id WHERE u.email = 'YOUR_EMAIL';"
```

**Reset token** (after step 8):

```bash
docker compose exec -T postgres psql -U wj_user -d warehousejobs -c \
  "SELECT u.email, pr.token FROM password_resets pr
   JOIN users u ON u.id = pr.user_id WHERE u.email = 'YOUR_EMAIL'
   ORDER BY pr.created_at DESC LIMIT 1;"
```

Paste values into Postman environment: `verificationToken`, `resetToken`.

### Re-register same email (409 CONFLICT)

Register only works once per email. To retry:

- **Option A**: Use walkthrough step 2 (auto unique email), or
- **Option B**: Delete user: `DELETE FROM users WHERE email = '...';` then register again.

### Individual Auth — Domain requests

Use the **Auth — Domain (Phase 2)** folder for ad-hoc calls (`verify-email`, `reset-password`, etc.).

---

## Part B — Frontend walkthrough (visual inspection)

| Step | URL / action              | What to inspect                                 |
| ---- | ------------------------- | ----------------------------------------------- |
| 1    | `/dev/diagnostics`        | Health panel green; API base URL correct        |
| 2    | `/auth?mode=signup`       | Register as seeker or employer                  |
| 3    | API terminal              | Copy verify link → open `/verify-email?token=…` |
| 4    | Verify page               | Success message + “Sign in” button              |
| 5    | `/auth?mode=login`        | Sign in with same credentials                   |
| 6    | Site header               | Shows signed-in state; role-appropriate nav     |
| 7    | `/forgot-password`        | Submit email → success message                  |
| 8    | Reset link from logs      | `/reset-password?token=…` → new password        |
| 9    | Sign in with new password | Header still shows authenticated user           |
| 10   | Sign out                  | Header returns to guest state                   |

**Phase 1 compat**: `/dev/diagnostics` health check still works without login.

---

## Part C — Automated quality gate

```bash
./scripts/phase2-demo.sh
```

Includes:

- Lint, type-check, **`bun run api:validate`**
- Unit tests + coverage (≥ 90% global, AuthService ≥ 85%)
- Integration (auth + Phase 1 health + password reset)
- E2E (all 7 auth endpoints + Phase 1 backwards compat)
- Phase 1 live smoke when API running (`/api/health`, `/me` → 401)
- Full auth live curl smoke with `--live`

Options: `--skip-docker`, `--skip-integration`, `--live`

---

## Part D — Phase 1 backwards compatibility

After Phase 2, these must still behave as in [`phase1-demo.md`](phase1-demo.md):

| Check              | Command / test                                                           | Expected |
| ------------------ | ------------------------------------------------------------------------ | -------- |
| Health             | `curl -s http://localhost:3001/api/health \| jq .status`                 | `"ok"`   |
| Me unauthenticated | `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/v1/me` | `401`    |
| Automated          | `test/e2e/phase1-backwards-compat.e2e-spec.ts`                           | Pass     |
| Phase 1 demo       | `./scripts/phase1-demo.sh --skip-integration`                            | Pass     |

Standard: [`docs/agent/standards/common/backwards-compatibility.md`](../../agent/standards/common/backwards-compatibility.md)

---

## Auth endpoints (OpenAPI)

| Method | Path                           | Auth              | Success |
| ------ | ------------------------------ | ----------------- | ------- |
| POST   | `/api/v1/auth/register`        | Public            | 201     |
| POST   | `/api/v1/auth/login`           | Public            | 200     |
| POST   | `/api/v1/auth/logout`          | Bearer            | 204     |
| POST   | `/api/v1/auth/refresh`         | Public            | 200     |
| POST   | `/api/v1/auth/verify-email`    | Public            | 200     |
| POST   | `/api/v1/auth/forgot-password` | Public            | 200     |
| POST   | `/api/v1/auth/reset-password`  | Public            | 200     |
| GET    | `/api/v1/me`                   | Bearer (verified) | 200     |

---

## Intentional boundary (not Phase 2)

Jobs, employer, seeker, and admin **data** pages still use Supabase for application data. API login provides a Prisma `user.id` — data migration is a later phase.

---

## Related

- Phase 1: [`phase1-demo.md`](phase1-demo.md)
- Postman README: `src/api/postman/README.md`
- Platform overview: [`overview.md`](overview.md)
