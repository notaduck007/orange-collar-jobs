# Repository Documentation Standard

Every WarehouseJobs repository (and this monorepo) must ship a **root-level `README.md`** that
onboards a new developer without opening other docs first.

---

## Required: root `README.md`

| Section               | Required content                                                 |
| --------------------- | ---------------------------------------------------------------- |
| **Title + one-liner** | What the product is                                              |
| **Monorepo overview** | If applicable: packages, workspaces, what lives where            |
| **Prerequisites**     | Bun, Node, Docker versions with links                            |
| **Quick start**       | Copy-paste commands to run the app in &lt;10 minutes             |
| **Per-surface setup** | Separate sections for **frontend** and **API** (when both exist) |
| **Environment**       | Point to root `.env.example`; `bun run setup:env`                |
| **Testing**           | Commands for unit / integration / E2E; coverage gate             |
| **Quality gates**     | lint, type-check, test, build before PR                          |
| **Project structure** | Directory tree with one-line descriptions                        |
| **CI/CD**             | Workflows table; release process if applicable                   |
| **Documentation map** | Links to `CLAUDE.md`, `AGENTS.md`, `docs/plan.md`, standards     |

### Monorepo README additions

When the repo contains both frontend and API:

1. State explicitly that this is a **monorepo** in the opening paragraphs.
2. Include a **workspaces table** (package name, path, purpose).
3. Document **full-stack local dev** (infra + API + frontend in separate terminals).
4. Document **root vs workspace scripts** (`dev` vs `api:dev`) — see [`monorepo.md`](./monorepo.md).
5. Never document nested `.env` under `src/api/` — root `.env` only.

### Reference implementation

This repository's [`README.md`](../../../README.md) is the canonical example.

---

## Agent / standards docs

| Path                        | Role                                                  |
| --------------------------- | ----------------------------------------------------- |
| `docs/agent/standards/`     | Coding and process standards (human + agent readable) |
| `.cursor/rules/*.mdc`       | Glob-attached editor rules linking to standards       |
| `.cursor/skills/*/SKILL.md` | Auto-discovered agent workflows                       |

New standards must be added to [`standards/README.md`](../README.md) and linked from
[`AGENT-TASK-INDEX.md`](../AGENT-TASK-INDEX.md) when they affect common tasks.

---

## Forbidden

- README only inside `src/api/` without a root README
- Setup instructions that reference `src/api/.env.example`
- Duplicate install flows (`bun install` at root **and** `cd src/api && bun install` as default)

---

## References

- Monorepo layout: [`monorepo.md`](./monorepo.md)
- Security (secrets): [`security.md`](./security.md)
