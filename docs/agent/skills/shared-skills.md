# Shared Skills Model (Cross-Repo)

**Purpose**: Define how WarehouseJobs skills are organized so the same reasoning workflows can be
reused across related repositories, while keeping repo-specific knowledge local.

---

## Two Tiers

### Tier 1 — Repo-specific skills (live here)

Committed under [`.cursor/skills/`](../../../.cursor/skills/). These encode WarehouseJobs-specific
knowledge and stay in this repository:

- `domain-driven-design`, `interface-designer`, `canonical-type-reuse`,
  `module-design-pattern`, `coding-conventions`, `testing`,
  `ci-monitoring-subagents`, `deployments-github-actions`, `create-pr`, `api-versioning`

### Tier 2 — Shared/common skills (candidates for promotion)

Reusable across multiple repos. A skill is promoted to a shared skills repository only once a
second repo needs it; the local copy is then replaced by the installed shared copy:

- `coding-conventions`, `testing`, `interface-designer`,
  `ci-monitoring-subagents`, `deployments-github-actions`, `create-pr`

---

## Auto-Discovery

Cursor auto-discovers each skill from its `name` + `description` YAML frontmatter in
`.cursor/skills/<name>/SKILL.md` (load-on-demand). Glob-attached coding/testing rules in
`.cursor/rules/*.mdc` reference the full standards under [`../standards/`](../standards/).
The redirect stubs in this folder keep older `docs/agent/skills/*.md` links pointing at the
canonical `.cursor` locations.

---

## References

- Skills catalog: [`README.md`](./README.md)
- Standards index: [`../standards/README.md`](../standards/README.md)
- Orchestration model: [`../../../AGENTS.md`](../../../AGENTS.md)
