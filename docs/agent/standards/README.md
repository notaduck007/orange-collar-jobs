# Standards Index

Agent coding and process standards for the WarehouseJobs NestJS API.

## How to Use

Always start with the [AGENT-TASK-INDEX.md](./AGENT-TASK-INDEX.md) to find the right reading order for your task.

## Common Standards

| File | What It Covers |
|---|---|
| [`common/typescript.md`](./common/typescript.md) | Strict TypeScript rules |
| [`common/security.md`](./common/security.md) | Auth, secrets, rate limiting, input validation |
| [`common/anti-patterns.md`](./common/anti-patterns.md) | Forbidden code patterns |
| [`common/naming.md`](./common/naming.md) | File, class, method, and route naming |
| [`common/modules.md`](./common/modules.md) | Module structure and barrel imports |
| [`common/backwards-compatibility.md`](./common/backwards-compatibility.md) | **Mandatory** phase additive changes; prior endpoints/tests/demos must pass |
| [`common/monorepo.md`](./common/monorepo.md) | Monorepo layout, nested `package.json`, env, `test/unit/` |
| [`common/repository-setup.md`](./common/repository-setup.md) | Root README, `.env.example`, onboarding requirements |
| [`common/monorepo.md`](./common/monorepo.md) | Workspaces, scripts, root `.env`, test layout |
| [`common/repository-documentation.md`](./common/repository-documentation.md) | Root README requirements |

## Testing Standards

| File | What It Covers |
|---|---|
| [`testing/unit.md`](./testing/unit.md) | Unit test rules and templates (specs in `test/unit/`, mirroring `src/`) |
| [`testing/integration.md`](./testing/integration.md) | Integration test rules |
| [`testing/e2e.md`](./testing/e2e.md) | E2E test rules and templates |

## Cursor Rules & Skills

These standards are also enforced in-editor:

- **Glob-attached rules** — [`.cursor/rules/`](../../../.cursor/rules/) (each `*.mdc` links back to its full standard above).
- **Auto-discovered skills** — [`.cursor/skills/<name>/SKILL.md`](../../../.cursor/skills/) (load-on-demand via `name` + `description` frontmatter). Catalog + redirect stubs: [`../skills/README.md`](../skills/README.md).
