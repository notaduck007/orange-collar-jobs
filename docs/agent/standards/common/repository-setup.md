# Repository Setup Standard

Every repository in this project must include a **root-level `README.md`** that lets a new developer run the app without reading internal docs first.

---

## Required: root `README.md`

The README is the **onboarding entry point**. It must include:

1. **Project title and one-paragraph purpose**
2. **Monorepo declaration** — list every deployable app/package and its path (e.g. frontend at root, API at `src/api/`)
3. **Prerequisites** — Bun, Node version (`.nvmrc`), Docker
4. **Quick start** — clone → install → env → infra → run (≤10 commands)
5. **Per-app setup** — separate sections for **Frontend** and **API** (install, env vars, dev server URL, test commands)
6. **Environment** — pointer to root `.env.example` (never nested env templates)
7. **Testing** — how to run unit / integration / E2E for the API; frontend lint/build if applicable
8. **CI/CD** — link to workflows (`ci.yml`, `release.yml`)
9. **Documentation map** — links to `CLAUDE.md`, `AGENTS.md`, `docs/plan.md`, `docs/api/openapi.yaml`

Optional but recommended: architecture diagram, Docker paths, SwaggerHub publish, semantic-release notes.

### Anti-patterns

- ❌ README only documents one half of a monorepo (API without frontend, or vice versa).
- ❌ Setup instructions that require nested `src/api/.env` without mentioning root `.env`.
- ❌ README buried in `docs/` instead of repo root.
- ❌ "Run scripts from `src/api`" without listing equivalent root `api:*` shortcuts.

---

## Required: root `.env.example`

- Single file at repository root documenting **all** environment variables (frontend build-time, API runtime, CI tooling).
- Group with comments: Frontend, API, Tooling.
- Nested packages must **not** maintain a separate full `.env.example`; use a one-line redirect stub if a path is required for legacy tooling.

---

## Required: root scripts for nested packages

For a nested API at `src/api/`, the root `package.json` must expose delegation scripts:

| Root script | Delegates to |
|---|---|
| `setup:env` | `cp .env.example .env` (root only) |
| `api:install` | `bun install` in workspace (or redundant if workspaces) |
| `api:dev`, `api:build`, `api:test`, … | matching script in `src/api/package.json` |

See [`monorepo.md`](./monorepo.md) for the full two-`package.json` model.

---

## Cursor / agent discovery

- Standards live under `docs/agent/standards/` and are linked from `.cursor/rules/*.mdc`.
- Skills live under `.cursor/skills/<name>/SKILL.md` (auto-discovered); catalog at `docs/agent/skills/README.md`.

---

## References

- Monorepo layout: [`monorepo.md`](./monorepo.md)
- Security (secrets): [`security.md`](./security.md)
- Task index: [`../AGENT-TASK-INDEX.md`](../AGENT-TASK-INDEX.md)
