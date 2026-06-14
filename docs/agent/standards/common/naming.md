# Naming Conventions

## Files

| Type             | Pattern                        | Example                     |
| ---------------- | ------------------------------ | --------------------------- |
| NestJS module    | `{domain}.module.ts`           | `jobs.module.ts`            |
| Service          | `{Domain}Service.ts`           | `JobsService.ts`            |
| Controller       | `{Domain}Controller.ts`        | `JobsController.ts`         |
| DTO (create)     | `Create{Domain}Dto.ts`         | `CreateJobDto.ts`           |
| DTO (update)     | `Update{Domain}Dto.ts`         | `UpdateJobDto.ts`           |
| DTO (search)     | `{Domain}SearchDto.ts`         | `JobSearchDto.ts`           |
| Domain types     | `types.ts`                     | `src/domains/jobs/types.ts` |
| Barrel           | `index.ts`                     | always `index.ts`           |
| Unit test        | `{Source}.spec.ts`             | `JobsService.spec.ts`       |
| Integration test | `{domain}.integration.spec.ts` | `jobs.integration.spec.ts`  |
| E2E test         | `{domain}.e2e-spec.ts`         | `jobs.e2e-spec.ts`          |

## Classes and Symbols

| Symbol             | Convention                  | Example                                     |
| ------------------ | --------------------------- | ------------------------------------------- |
| Classes            | `PascalCase`                | `JobsService`, `CreateJobDto`               |
| Adapter interfaces | `I{Platform}`               | `IStorageProvider`, `IEmailProvider`        |
| Enums              | `PascalCase`                | `JobStatus`, `ApplicationStatus`            |
| Enum values        | `UPPER_SNAKE`               | `JobStatus.ACTIVE`, `ApplicationStatus.NEW` |
| Constants/tokens   | `UPPER_SNAKE`               | `STORAGE_PROVIDER`, `JWT_SECRET`            |
| Methods            | `camelCase`                 | `findBySlug`, `softDelete`                  |
| Private fields     | `camelCase` (no `_` prefix) | `this.prisma`, `this.logger`                |

## Route Paths

- Always `kebab-case`: `/warehouse-jobs`, `/quick-apply`, `/batch-status`
- Resource names plural: `/jobs`, `/applications`, `/companies`
- IDs as path params: `/jobs/:id`, `/applications/:id/status`

## Database Columns

- Prisma schema: `snake_case` (`source_type`, `posted_at`)
- TypeScript: Prisma maps automatically to `camelCase` (`sourceType`, `postedAt`)
- Never use `camelCase` in raw SQL

## Domain-Specific Names

| Concept         | Correct Term | Never Use                  |
| --------------- | ------------ | -------------------------- |
| Job applicant   | `seeker`     | applicant, candidate, user |
| Employer        | `vendor`     | employer, company, poster  |
| Source of job   | `sourceType` | origin, provenance         |
| WJ-posted job   | `direct`     | internal, native           |
| Scraped job     | `scraped`    | external, crawled          |
| Bulk job import | `batch`      | import, feed               |
