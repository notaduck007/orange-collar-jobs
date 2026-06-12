# Unit Testing Standard

## Rules

- Co-locate `*.spec.ts` with the source file
- Mock ALL external dependencies — no real DB, no real Redis, no real HTTP
- Use `jest-mock-extended` for typed Prisma and service mocks
- Reset mocks in `afterEach(() => jest.clearAllMocks())`
- Use deterministic fixtures via factories in `src/api/test/helpers/factories/`
- Coverage target: ≥ 90% lines/branches/functions per service

## Four Required Test Categories

For each public method, write at least one test per category:

1. **Happy path** — valid input, expected output
2. **Validation** — invalid input throws `ValidationError` or `UnprocessableEntityException`
3. **Edge cases** — empty arrays, zero values, nulls, boundary conditions
4. **Error conditions** — `NotFoundError`, `ConflictError`, `ForbiddenError` at the right moments

## Template

```typescript
import { createMock } from 'jest-mock-extended';
import { JobsService } from './JobsService';
import { PrismaService } from '@core/database';
import { NotFoundError, ConflictError } from '@core/error';
import { makeJob, makeCreateJobDto, makeUser } from 'test/helpers/factories';

describe('JobsService', () => {
  let service: JobsService;
  let prisma: ReturnType<typeof createMock<PrismaService>>;

  beforeEach(() => {
    prisma = createMock<PrismaService>();
    service = new JobsService(prisma);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('creates a job and returns it', async () => {
      const dto = makeCreateJobDto();
      const user = makeUser({ role: 'admin' });
      const expected = makeJob({ title: dto.title });
      prisma.job.create.mockResolvedValue(expected);

      const result = await service.create(dto, user);

      expect(result).toEqual(expected);
      expect(prisma.job.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ title: dto.title }) }),
      );
    });

    it('throws ForbiddenError when vendor tries to post for another company', async () => {
      const dto = makeCreateJobDto({ companyId: 'other-company-id' });
      const user = makeUser({ role: 'vendor', companyId: 'my-company-id' });

      await expect(service.create(dto, user)).rejects.toBeInstanceOf(ForbiddenError);
    });
  });
});
```

## Factory Pattern

```typescript
// test/helpers/factories/job.factory.ts
import { v4 as uuid } from 'uuid';
import type { Job } from '@domains/jobs';

export function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-00000000-0000-0000-0000-000000000001',
    title: 'Test Forklift Operator',
    slug: 'test-forklift-operator-dallas-tx',
    status: 'active',
    sourceType: 'direct',
    // ... all required fields with stable defaults
    ...overrides,
  };
}
```
