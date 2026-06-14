# Integration Testing Standard

## Requirements

- Docker Compose must be running: `docker-compose up -d postgres redis minio`
- Use `TEST_DATABASE_URL` pointing to the Docker Compose Postgres instance
- Truncate all tables in `beforeEach` — never share state between tests
- No mocks for Prisma, Redis, or MinIO in integration tests
- No live HTTP calls to external services

## Table Truncation Helper

```typescript
// test/helpers/truncate.ts
import { PrismaService } from "@core/database";

export async function truncateAllTables(prisma: PrismaService): Promise<void> {
  // Truncate in FK-safe reverse dependency order
  await prisma.$executeRaw`TRUNCATE TABLE application_answers, interview_bookings, applications CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE screening_questions, interview_slots, jobs CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE company_packages, companies CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE refresh_tokens, email_verifications, password_resets CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE users CASCADE`;
}
```

## Template

```typescript
import { Test, TestingModule } from "@nestjs/testing";
import { AppModule } from "../../src/app.module";
import { PrismaService } from "@core/database";
import { truncateAllTables, seedCompany, seedVendorUser } from "../helpers";

describe("JobsService (integration)", () => {
  let app: TestingModule;
  let service: JobsService;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await Test.createTestingModule({ imports: [AppModule] }).compile();
    service = app.get(JobsService);
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await truncateAllTables(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it("creates a job and it appears in search results", async () => {
    const { company, user } = await seedVendorUser(prisma);
    const dto = makeCreateJobDto({ companyId: company.id });

    const job = await service.create(dto, user);
    const results = await service.search({ q: dto.title, page: 1, pageSize: 10 });

    expect(results.data.some((j) => j.id === job.id)).toBe(true);
  });
});
```
