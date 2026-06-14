# Postman Collection — WarehouseJobs API

## Files

| File | Purpose |
|---|---|
| `warehousejobs.postman_collection.json` | All API requests, organised by domain |
| `warehousejobs.postman_environment.json` | Environment variables for local dev |

## Setup

1. Open Postman → **Import** → select both files above.
2. Select the **WarehouseJobs — Local Dev** environment (top-right dropdown).
3. Ensure the stack is running: `docker compose up -d && bun run api:dev`
4. Run **System / Health Check** → expect `200 { status: 'ok' }`.

## Phase 2 guided walkthrough

Use folder **Phase 2 — Walkthrough (run in order)** — steps 1–9 with automated tests.

Before step **3** (verify) and **9** (reset), set environment variables from API logs or Postgres:

| Variable | Source |
|----------|--------|
| `verificationToken` | `[DEV EMAIL]` after Register, or `email_verifications.token` |
| `resetToken` | `[DEV EMAIL]` after Forgot password, or `password_resets.token` |

Full narrative: [`docs/demo/phase2-demo.md`](../../../docs/demo/phase2-demo.md)

## Authentication

The collection uses Bearer auth via `bearerToken` (set automatically by Login / Refresh test scripts).

| Variable | Set by |
|----------|--------|
| `bearerToken` | Login, Refresh |
| `refreshToken` | Login, Refresh |
| `testEmail` | Walkthrough Register (unique timestamp email) |
| `verificationToken` | Manual — from email log or DB |
| `resetToken` | Manual — from email log or DB |

Dev JWT without register flow: `bun run dev:token`

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `baseUrl` | `http://localhost:3001` | API base |
| `bearerToken` | *(empty)* | JWT access token |
| `refreshToken` | *(empty)* | Refresh token |
| `verificationToken` | *(empty)* | Email verification opaque token |
| `resetToken` | *(empty)* | Password reset opaque token |
| `testEmail` | `test@warehousejobs.com` | Register/login email |
| `testPassword` | `Test1234!` | Password (min 8 chars) |
| `swaggerApiKey` | *(empty)* | Batch API key |

## Phase backwards compatibility

Phase 1 requests (**System / Health Check**, **Auth — Core / GET /me**) must remain valid after every phase. See [`docs/agent/standards/common/backwards-compatibility.md`](../../../docs/agent/standards/common/backwards-compatibility.md).

## Running as a CI test suite (Newman)

```bash
newman run src/api/postman/warehousejobs.postman_collection.json \
  --environment src/api/postman/warehousejobs.postman_environment.json \
  --folder "Phase 2 — Walkthrough (run in order)" \
  --reporters cli
```

Note: steps 3 and 9 require `verificationToken` / `resetToken` in the environment for a full green run.
