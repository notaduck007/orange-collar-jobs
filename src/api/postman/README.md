# Postman Collection — WarehouseJobs API

## Files

| File | Purpose |
|---|---|
| `warehousejobs.postman_collection.json` | All API requests, organised by domain |
| `warehousejobs.postman_environment.json` | Environment variables for local dev |

## Setup

1. Open Postman → **Import** → select both files above.
2. Select the **WarehouseJobs — Local Dev** environment (top-right dropdown).
3. Ensure the stack is running: `docker compose up -d && bun run --cwd src/api start:dev`
4. Run **System / Health Check** → expect `200 { status: 'ok' }`.

## Authentication

The collection uses a Bearer token stored in the `bearerToken` environment variable.

Once Phase 2 (Auth Domain) is implemented:
1. Run **Auth — Domain / POST /api/v1/auth/login** with valid credentials.
2. The test script automatically saves the `accessToken` to `bearerToken`.
3. All subsequent requests will use it automatically.

Until then, you can manually paste a JWT (e.g. generated from `bun run --cwd src/api ts-node` + `JwtService.sign()`) into the `bearerToken` variable.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `baseUrl` | `http://localhost:3001` | API base. Change for staging/production. |
| `bearerToken` | *(empty)* | JWT access token. Set by Login request or manually. |
| `swaggerApiKey` | *(empty)* | `X-Api-Key` for batch ingestion. Match `SWAGGER_API_KEY` in `.env`. |
| `testEmail` | `test@warehousejobs.com` | Seed email for register/login requests. |
| `testPassword` | `Test1234!` | Seed password. |

## Running as a CI test suite (Newman)

```bash
# Install Newman
bun add -g newman

# Run the collection against local dev
newman run src/api/postman/warehousejobs.postman_collection.json \
  --environment src/api/postman/warehousejobs.postman_environment.json \
  --reporters cli,json \
  --reporter-json-export newman-results.json
```
