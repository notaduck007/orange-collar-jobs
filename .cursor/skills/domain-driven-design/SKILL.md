---
name: domain-driven-design
description: Establish bounded contexts and aggregate roots for a new domain. Use before designing any new service or module.
---

# Skill: Domain-Driven Design

**Applicable Personas**: Senior Engineer

---

## WarehouseJobs Domain Map

| Domain       | Bounded Context                                | Aggregate Root  | Module Path                 |
| ------------ | ---------------------------------------------- | --------------- | --------------------------- |
| Auth         | User identity, sessions, tokens                | `User`          | `src/domains/auth/`         |
| Jobs         | Job lifecycle — create, publish, search, close | `Job`           | `src/domains/jobs/`         |
| Batch        | Bulk job ingestion, deduplication              | `BatchJob`      | `src/domains/batch/`        |
| Applications | Application submission and pipeline            | `Application`   | `src/domains/applications/` |
| Companies    | Employer company profile                       | `Company`       | `src/domains/companies/`    |
| Admin        | Platform moderation, advertising, stats        | `Advertisement` | `src/domains/admin/`        |

## Ubiquitous Language

| Term             | Meaning                                                                            |
| ---------------- | ---------------------------------------------------------------------------------- |
| **Seeker**       | A job applicant (registered or guest)                                              |
| **Vendor**       | An authenticated employer (company owner/admin)                                    |
| **Direct post**  | A job posted by a vendor or admin via the platform (`sourceType: direct` or `api`) |
| **Scraped post** | A job ingested via the batch endpoint from an external source                      |
| **Quick Apply**  | The ≤60-second application flow (unauthenticated or authenticated)                 |
| **Package**      | A purchased posting credit bundle (`company_packages`)                             |
| **Feature**      | Paying to promote a job to the top of search results                               |
| **Pipeline**     | The employer's view of applicants moving through stages                            |

## Rules

- Each domain owns its own Prisma queries — no cross-domain Prisma access
- `Job` aggregate owns `ScreeningQuestion` and `InterviewSlot` (created/deleted together)
- `Application` aggregate owns `ApplicationAnswer` and `InterviewBooking`
- `Company` owns `CompanyPackage` — credit lifecycle is internal to the companies domain
- `Admin` domain has read access to all other domains for moderation and reporting

## New Domain Checklist

1. [ ] Identify the aggregate root and its invariants
2. [ ] Map to the ubiquitous language above
3. [ ] Determine which other domains this domain depends on (only via `src/core/` barrels)
4. [ ] Define the domain's public surface in `index.ts` before implementation
5. [ ] Confirm the domain's endpoints are covered in `docs/api/openapi.yaml`
