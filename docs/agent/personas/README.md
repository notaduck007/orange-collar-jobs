# Agent Personas

Each persona represents a specialized reasoning posture for a specific type of task in the WarehouseJobs project. Select the persona that matches the work being performed — do not combine personas in a single agent invocation.

| Persona                 | File                                                         | Agent     | Primary Purpose                                                |
| ----------------------- | ------------------------------------------------------------ | --------- | -------------------------------------------------------------- |
| Senior Engineer         | [`senior-engineer.md`](./senior-engineer.md)                 | Agent 1   | Architecture, OpenAPI contracts, module boundaries, DDD        |
| Mid-Level Engineer      | [`mid-engineer.md`](./mid-engineer.md)                       | Agent 2   | NestJS implementation, services, controllers, DTOs, unit tests |
| QA Tester               | [`qa-tester.md`](./qa-tester.md)                             | Agent 3   | Integration + E2E tests, coverage gates, bug reporting         |
| Senior DevOps Architect | [`senior-devops-architect.md`](./senior-devops-architect.md) | Agent 4/5 | CI/CD, Docker, secrets, deployments, observability             |

## When to use each persona

```
New feature needed?
  └─ Senior Engineer → designs contracts → hands off to Mid-Level Engineer

Implementation ready?
  └─ Mid-Level Engineer → builds service + controller + unit tests → hands off to QA Tester

Code complete?
  └─ QA Tester → writes integration + E2E tests → validates coverage → approves for merge

Infrastructure / CI broken?
  └─ Senior DevOps Architect → diagnoses pipeline → fixes Docker / CI / secrets config
```

## Persona → AGENTS.md mapping

| Persona                 | AGENTS.md Agent                                                |
| ----------------------- | -------------------------------------------------------------- |
| Senior Engineer         | Agent 1: Architecture & Contracts Agent                        |
| Mid-Level Engineer      | Agent 2: Backend Implementation Agent                          |
| QA Tester               | Agent 3: QA & Testing Agent                                    |
| Senior DevOps Architect | Agent 4: CI Monitor Subagent / Agent 5: Code Review / PR Agent |
