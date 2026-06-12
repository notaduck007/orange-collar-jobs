# WarehouseJobs Agent Skills

Skills are reusable reasoning workflows invoked by agents during specific task types.
Each skill lives in its own subdirectory with a `SKILL.md` file.

## Usage

Before reading any skill, check the task index to find the right one for your work:
→ [`docs/agent/standards/AGENT-TASK-INDEX.md`](../../docs/agent/standards/AGENT-TASK-INDEX.md)

## Available Skills

| Skill | When to Use |
|---|---|
| [`coding-conventions`](./coding-conventions/SKILL.md) | Writing/reviewing any NestJS service, controller, or DTO |
| [`module-design-pattern`](./module-design-pattern/SKILL.md) | Scaffolding a new module or fixing barrel imports |
| [`interface-designer`](./interface-designer/SKILL.md) | Designing a service or adapter contract before implementation |
| [`domain-driven-design`](./domain-driven-design/SKILL.md) | Establishing bounded contexts for a new domain |
| [`canonical-type-reuse`](./canonical-type-reuse/SKILL.md) | Checking whether a type belongs in `src/core/` |
| [`testing`](./testing/SKILL.md) | Writing or reviewing unit, integration, or E2E tests |
| [`create-pr`](./create-pr/SKILL.md) | Creating a pull request with correct description and checklist |
| [`ci-monitoring-subagents`](./ci-monitoring-subagents/SKILL.md) | Diagnosing a failing CI check |
| [`deployments-github-actions`](./deployments-github-actions/SKILL.md) | Setting up or modifying CI/CD workflows |
