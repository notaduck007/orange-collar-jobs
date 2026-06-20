---
name: ci-monitoring-subagents
description: Diagnose a single failing CI check. Use when CI fails on a PR and you need a root-cause summary.
---

# Skill: CI Monitor Subagent

**Applicable Personas**: QA Tester, Senior Engineer
**Rule**: ONE diagnostic command per invocation. Report findings only — do not modify code.

---

## Diagnostic Steps

### Step 1 — Identify failure type

```bash
# Check the failing job and step name from the CI log
# Common failure types:
# - Lint: "ESLint found X problems"
# - TypeScript: "error TS2345: Argument of type..."
# - Unit test: "● JobsService › findBySlug › throws NotFoundError"
# - Integration test: "PrismaClientKnownRequestError: Foreign key constraint"
# - E2E test: "expected 201, got 422"
# - Coverage: "Jest: 'global' coverage threshold for lines (90%) not met"
```

### Step 2 — Run the specific failing command locally

```bash
# Lint
npm run lint 2>&1 | head -50

# TypeScript
npm run type-check 2>&1 | head -50

# Specific test file
npm run test -- --testPathPattern="JobsService" 2>&1

# Coverage for a specific service
npm run test:cov -- --collectCoverageFrom="src/domains/jobs/**"
```

### Step 3 — Report

Return a summary:

- **Failure type**: lint / type-check / unit / integration / e2e / coverage
- **Root cause**: the specific error message and file/line
- **Likely fix**: one-sentence description (do not implement)
- **Which task in `docs/plan.md` this blocks**: phase and task number
