# Skills Catalog

**Version**: 1.0
**Status**: Active

---

## Purpose

Skills are reusable, named reasoning processes that enforce architectural invariants, design
standards, and operational constraints. Personas invoke skills to perform specific analysis,
design, or implementation work.

---

## Where skills live now

Skills live in [`.cursor/skills/<name>/SKILL.md`](../../../.cursor/skills/) so Cursor
**auto-discovers** them on demand via YAML `name` + `description` frontmatter (no manual lookup).
Coding/testing standards are glob-attached Cursor rules in [`.cursor/rules/`](../../../.cursor/rules/)
that link back to the full standards under [`../standards/`](../standards/).

The `docs/agent/skills/*.md` files in this folder are **redirect stubs** that point to the
canonical `.cursor/skills/...` locations so existing documentation links keep working.

Cross-repo sharing is described in [`shared-skills.md`](./shared-skills.md).

---

## Available Skills

### Design & Architecture

| Skill                     | Canonical File                                                                                            | Invoked By                                    |
| ------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| **Domain-Driven Design**  | [`.cursor/skills/domain-driven-design/SKILL.md`](../../../.cursor/skills/domain-driven-design/SKILL.md)   | Architecture & Contracts Agent                |
| **Interface Designer**    | [`.cursor/skills/interface-designer/SKILL.md`](../../../.cursor/skills/interface-designer/SKILL.md)       | Architecture & Contracts Agent                |
| **Canonical Type Reuse**  | [`.cursor/skills/canonical-type-reuse/SKILL.md`](../../../.cursor/skills/canonical-type-reuse/SKILL.md)   | Architecture & Contracts Agent, Backend Agent |
| **Module Design Pattern** | [`.cursor/skills/module-design-pattern/SKILL.md`](../../../.cursor/skills/module-design-pattern/SKILL.md) | Architecture & Contracts Agent, Backend Agent |

### Implementation

| Skill                  | Canonical File                                                                                      | Invoked By                        |
| ---------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------- |
| **Coding Conventions** | [`.cursor/skills/coding-conventions/SKILL.md`](../../../.cursor/skills/coding-conventions/SKILL.md) | All agents                        |
| **Testing**            | [`.cursor/skills/testing/SKILL.md`](../../../.cursor/skills/testing/SKILL.md)                       | QA & Testing Agent, Backend Agent |

### Operations & Delivery

| Skill                               | Canonical File                                                                                                      | Invoked By                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| **CI Monitoring Subagents**         | [`.cursor/skills/ci-monitoring-subagents/SKILL.md`](../../../.cursor/skills/ci-monitoring-subagents/SKILL.md)       | CI Monitor Subagent            |
| **Deployments with GitHub Actions** | [`.cursor/skills/deployments-github-actions/SKILL.md`](../../../.cursor/skills/deployments-github-actions/SKILL.md) | Architecture & Contracts Agent |
| **Create PR**                       | [`.cursor/skills/create-pr/SKILL.md`](../../../.cursor/skills/create-pr/SKILL.md)                                   | Code Review / PR Agent         |

---

## Skill Dependency Chain

```
New module or service needed?
    ↓
1. Domain-Driven Design        ← confirm bounded context + module boundary
    ↓
2. Interface Designer          ← design the contract (YAML artifact)
    ↓ invokes
3. Canonical Type Reuse        ← verify no duplicate cross-cutting types
    ↓
4. Module Design Pattern       ← scaffold directory layout + barrel
    ↓
5. Coding Conventions          ← implement to SOLID standards
    ↓
6. Testing                     ← write unit / integration / E2E tests
    ↓
7. Deployments with GitHub Actions ← update CI if a new module affects the pipeline
```

### Fail-Closed Rule

Every skill has a "Preconditions" section. If any precondition is unknown:
**STOP. Ask for the missing information. Do not proceed.**

---

## Quick Task Lookup

See [`../standards/AGENT-TASK-INDEX.md`](../standards/AGENT-TASK-INDEX.md) for the full map of
task → required skills and documents.

---

## Creating a New Skill

1. Create `.cursor/skills/<name>/SKILL.md` with `name` + `description` frontmatter (the
   `description` is the auto-discovery trigger; include WHAT and WHEN).
2. Document it using the standard skill structure; keep `SKILL.md` focused (push long templates
   into a sibling `reference.md`).
3. Add a redirect stub here and a row to the catalog table above.
4. Request Architecture & Contracts Agent (Senior Engineer) approval before it becomes `Active`.

---

## References

- [`../standards/AGENT-TASK-INDEX.md`](../standards/AGENT-TASK-INDEX.md) — task → skill/document map
- [`../analysis/architecture.md`](../analysis/architecture.md) — system overview
- [`../personas/`](../personas/) — personas that invoke these skills
- [`../../plan.md`](../../plan.md) — task assignments by phase
