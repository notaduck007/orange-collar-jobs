---
name: deployments-github-actions
description: Set up or modify CI/CD GitHub Actions workflows. Use when creating or modifying .github/workflows/*.yml files.
---

# Skill: Deployments with GitHub Actions

**Applicable Personas**: Senior Engineer

---

## CI Workflow Requirements (`ci.yml`)

Every CI run must execute in this order:

1. Checkout code
2. Setup Node.js 22
3. Install dependencies (`npm ci` in `src/api/`)
4. `npm run lint`
5. `npm run type-check`
6. Start Docker Compose services (Postgres + Redis + MinIO)
7. Wait for services to be healthy
8. Run Prisma migrations against test DB
9. `npm run test` (unit only)
10. `npm run test:integration`
11. `npm run test:e2e`
12. `npm run test:cov` — fail if < 85% line coverage

## Secrets Required in GitHub

| Secret                  | Description                                  |
| ----------------------- | -------------------------------------------- |
| `TEST_DATABASE_URL`     | Postgres connection string for CI            |
| `TEST_REDIS_URL`        | Redis connection string for CI               |
| `TEST_STORAGE_ENDPOINT` | MinIO endpoint for CI                        |
| `SWAGGER_API_KEY`       | For publishing OpenAPI spec on merge to main |

## CI Rules

- Never hardcode secrets in workflow files — use `${{ secrets.* }}`
- Docker Compose `--wait` flag to ensure services are healthy before tests
- Use `actions/cache` for `node_modules` and `~/.npm` to speed up builds
- Upload coverage report as artifact (`actions/upload-artifact`)

## Optional: Deploy Workflow (`deploy.yml`)

Triggers only after CI passes (`workflow_run`):

- Build Docker image for `src/api/`
- Push to container registry
- Deploy to target platform (Railway / Fly.io / AWS ECS)
