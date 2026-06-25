# Postman Collection — WarehouseJobs API

## Files

| File                                     | Purpose                               |
| ---------------------------------------- | ------------------------------------- |
| `warehousejobs.postman_collection.json`  | All API requests, organised by domain |
| `warehousejobs.postman_environment.json` | Environment variables for local dev   |

## Setup

1. Open Postman → **Import** → select both files above.
2. Select the **WarehouseJobs — Local Dev** environment (top-right dropdown).
3. Ensure the stack is running: `docker compose up -d && bun run api:dev`
4. Run **System / Health Check** → expect `200 { status: 'ok' }`.

## Phase 2 guided walkthrough

Use folder **Phase 2 — Walkthrough (run in order)** — steps 1–9 with automated tests.

## Phase 3 guided walkthrough

After Phase 2 auth (or `bun run dev:token --role admin` + verified email in DB):

1. Set Postman env `companyId` from Postgres (`SELECT id FROM companies LIMIT 1`).
2. Run folder **Phase 3 — Walkthrough (run in order)** — search → create → detail → patch → delete.

Full narrative + curl equivalents: [`docs/demo/phase3-demo.md`](../../../docs/demo/phase3-demo.md) Parts A and B.

Before step **3** (verify) and **9** (reset), set environment variables from API logs or Postgres:

| Variable            | Source                                                          |
| ------------------- | --------------------------------------------------------------- |
| `verificationToken` | `[DEV EMAIL]` after Register, or `email_verifications.token`    |
| `resetToken`        | `[DEV EMAIL]` after Forgot password, or `password_resets.token` |

Full narrative: [`docs/demo/phase2-demo.md`](../../../docs/demo/phase2-demo.md)

## Authentication

The collection uses Bearer auth via `bearerToken` (set automatically by Login / Refresh test scripts).

| Variable            | Set by                                        |
| ------------------- | --------------------------------------------- |
| `bearerToken`       | Login, Refresh                                |
| `refreshToken`      | Login, Refresh                                |
| `testEmail`         | Walkthrough Register (unique timestamp email) |
| `verificationToken` | Manual — from email log or DB                 |
| `resetToken`        | Manual — from email log or DB                 |

Dev JWT without register flow: `bun run dev:token`

## Environment Variables

| Variable            | Default                  | Description                     |
| ------------------- | ------------------------ | ------------------------------- |
| `baseUrl`           | `http://localhost:3001`  | API base                        |
| `bearerToken`       | _(empty)_                | JWT access token                |
| `refreshToken`      | _(empty)_                | Refresh token                   |
| `verificationToken` | _(empty)_                | Email verification opaque token |
| `resetToken`        | _(empty)_                | Password reset opaque token     |
| `testEmail`         | `test@warehousejobs.com` | Register/login email            |
| `testPassword`      | `Test1234!` (Postman UI) | Password; CI uses `SecureP@ss1` (no `!` in bash curl) |
| `swaggerApiKey`     | _(empty)_                | Batch API key                   |

## Phase backwards compatibility

Phase 1 requests (**System / Health Check**, **Auth — Core / GET /me**) must remain valid after every phase. See [`docs/agent/standards/common/backwards-compatibility.md`](../../../docs/agent/standards/common/backwards-compatibility.md).

## CI (GitHub Actions)

Workflow: `.github/workflows/postman.yml`

- Starts Postgres, Redis, MinIO, migrates DB, **starts the real NestJS API** on `:3001`
- Runs `scripts/ci-postman.sh` (Newman + auth curl smoke)
- **No** `POSTMAN_API_KEY` required — uses committed JSON files, not Postman Cloud

Folders exercised in CI:

| Folder            | Purpose                                             |
| ----------------- | --------------------------------------------------- |
| System            | `GET /api/health` assertions                        |
| Auth — Core       | `GET /api/v1/me` → 401 without token                |
| Jobs (Phase 3)    | `GET /api/v1/jobs` search listing                   |
| Auth smoke (curl) | Full Phase 2 register → verify → login → reset flow |

The **Phase 2 — Walkthrough** folder is for manual Postman desktop use (token paste steps 3 & 9). CI uses the curl smoke in `ci-postman.sh` instead.

### Postman Mock Server

A Postman mock URL (e.g. `https://….mock.pstmn.io`) returns **canned examples** — it does **not** run this codebase. Use it for frontend prototyping only. CI validates the **real API** built from this repo.

## Running locally

```bash
docker compose up -d postgres redis minio
export DATABASE_URL=postgresql://wj_user:wj_dev_password@localhost:5433/warehousejobs
export JWT_SECRET=local_dev_jwt_secret_min_32_chars_long
export JWT_REFRESH_SECRET=local_dev_refresh_secret_min_32_chars_long
export POSTMAN_PG_PORT=5433
bash scripts/ci-minio-up.sh   # if MinIO not via compose
bash scripts/ci-api-up.sh
bash scripts/ci-postman.sh
```

## Running as Newman only (manual)

```bash
newman run src/api/postman/warehousejobs.postman_collection.json \
  --environment src/api/postman/warehousejobs.postman_environment.json \
  --folder "Phase 2 — Walkthrough (run in order)" \
  --reporters cli
```

Note: steps 3 and 9 require `verificationToken` / `resetToken` in the environment for a full green run.
