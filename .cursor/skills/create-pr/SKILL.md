---
name: create-pr
description: Create a pull request with correct description, checklist, and CI status verification.
---

# Skill: Create PR

**Applicable Personas**: Any

---

## Pre-PR Checklist

```bash
# Run from src/api/
npm run lint           # zero violations
npm run type-check     # no type errors
npm run test           # unit tests pass
npm run test:integration  # if DB/Redis touched
npm run test:e2e          # if HTTP surface touched
npm run test:cov       # ≥ 90% on all global coverage metrics
```

If any command fails: fix before creating the PR.

## Additional Checks

- [ ] `docs/api/openapi.yaml` updated for any new or changed endpoints
- [ ] `.env.example` updated for any new env vars
- [ ] No `console.log` in committed code (use `this.logger`)
- [ ] No hardcoded credentials or secrets
- [ ] Migrations included if schema changed

## PR Description Template

```markdown
## What

Brief description of the change.

## Why

The business / technical reason.

## How

Key implementation decisions.

## Testing

- Unit: [describe tests added]
- Integration: [describe tests added]
- E2E: [describe tests added]
- Coverage: [X]% for changed services

## OpenAPI

[ ] No endpoints changed
[ ] `docs/api/openapi.yaml` updated; SwaggerHub publishing via CI

## Checklist

- [ ] lint passes
- [ ] type-check passes
- [ ] all tests pass
- [ ] coverage ≥ 90% on all global metrics for changed services
- [ ] no hardcoded secrets
```
