---
name: testing
description: Write and review unit, integration, and E2E tests for the NestJS API. Use when writing any test file or reviewing test coverage.
---

# Skill: Testing

**Applicable Personas**: QA Tester (primary), Mid Engineer (unit tests under test/unit/)

---

## Test Type Decision Tree

```
Is the test verifying logic in isolation (no real I/O)?
  → Unit test (test/unit/**/*.spec.ts — mirrors the src/ tree)

Is the test verifying behaviour against real Postgres + Redis?
  → Integration test (test/integration/*.integration.spec.ts)

Is the test verifying an HTTP endpoint end-to-end?
  → E2E test (test/e2e/*.e2e-spec.ts)
```

---

## Unit Tests

### Template

```typescript
import { createMock } from 'jest-mock-extended';
import { JobsService } from './JobsService';
import { PrismaService } from '@core/database';
import { NotFoundError } from '@core/error';

describe('JobsService', () => {
  let service: JobsService;
  let prisma: ReturnType<typeof createMock<PrismaService>>;

  beforeEach(() => {
    prisma = createMock<PrismaService>();
    service = new JobsService(prisma);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findBySlug', () => {
    it('returns the job when found', async () => {
      const job = makeJob({ slug: 'forklift-dallas-tx' });
      prisma.job.findUnique.mockResolvedValue(job);

      const result = await service.findBySlug('forklift-dallas-tx');

      expect(result).toEqual(job);
    });

    it('throws NotFoundError when job does not exist', async () => {
      prisma.job.findUnique.mockResolvedValue(null);

      await expect(service.findBySlug('unknown')).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
```

### Rules

- Mock ALL external deps (`jest-mock-extended`)
- Use factories from `test/helpers/factories/` for deterministic data
- Four categories per public method: happy path, validation, edge cases, error
- Assert specific error classes, not raw messages
- Coverage ≥ 90% lines/branches/functions for services

---

## Integration Tests

### Template

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@core/database';

describe('JobsService (integration)', () => {
  let app: TestingModule;
  let service: JobsService;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    service = app.get(JobsService);
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await truncateAllTables(prisma); // helper in test/helpers/
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates and retrieves a job', async () => {
    const company = await seedCompany(prisma);
    const job = await service.create(makeCreateJobDto({ companyId: company.id }), adminUser);
    const found = await service.findBySlug(job.slug);
    expect(found.id).toBe(job.id);
  });
});
```

### Rules

- Real Postgres + Redis via Docker Compose
- `truncateAllTables()` in `beforeEach`
- Dedicated `TEST_DATABASE_URL` env var

---

## E2E Tests

### Template

```typescript
import * as request from 'supertest';

describe('POST /api/v1/jobs/:jobId/apply', () => {
  let app: INestApplication;
  let seekerToken: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    await app.init();
    seekerToken = await loginAsSeeker(app);
  });

  it('returns 201 for valid apply', async () => {
    const { jobId } = await seedActiveJob(app);
    await request(app.getHttpServer())
      .post(`/api/v1/jobs/${jobId}/apply`)
      .set('Authorization', `Bearer ${seekerToken}`)
      .send({ coverNote: 'Ready to start Monday' })
      .expect(201)
      .expect((res) => {
        expect(res.body.applicationId).toBeDefined();
      });
  });

  it('returns 403 when called with a vendor token', async () => {
    const vendorToken = await loginAsVendor(app);
    const { jobId } = await seedActiveJob(app);
    await request(app.getHttpServer())
      .post(`/api/v1/jobs/${jobId}/apply`)
      .set('Authorization', `Bearer ${vendorToken}`)
      .send({})
      .expect(403);
  });
});
```

### Rules

- Every endpoint in `docs/api/openapi.yaml` must have at least one E2E test
- Test status codes, response shapes, and RBAC (wrong role → 403)
- Use `supertest` against the bootstrapped NestJS app
