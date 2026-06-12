# Module Structure and Barrel Imports

## Rules

1. Every domain module has an `index.ts` that exports only its **public surface**
2. Always import from the barrel (`index.ts`), never from internal files
3. Domain modules import from `src/core/` only for cross-cutting capabilities
4. Cross-domain imports are **forbidden** (domains are independent bounded contexts)
5. Only `src/core/` modules use `@Global()` — never domain modules

## Example: Correct Barrel

```typescript
// src/domains/jobs/index.ts — public surface only
export { JobsService } from './JobsService';
export type { Job, JobSummary, JobStatus, JobSourceType } from './types';

// Do NOT export: JobsController, internal helpers, DTOs, migrations
```

## Example: Correct Import

```typescript
// From within the applications domain, importing jobs service:
import { JobsService } from '@domains/jobs';  // barrel import — correct

// Never:
import { JobsService } from '../jobs/JobsService';  // direct file — forbidden
```

## Module Wiring

```typescript
@Module({
  imports: [
    DatabaseModule,     // from src/core/ — always available via @Global
    ConfigModule,       // from src/core/ — always available via @Global
    QueueModule,        // from src/core/ — BullMQ
  ],
  providers: [JobsService, JobSlugService, JobSearchService],
  controllers: [JobsController],
  exports: [JobsService],  // only what other modules need
})
export class JobsModule {}
```

## DI Tokens for Adapter Interfaces

When a domain depends on an abstraction (not a concrete class):

```typescript
// src/domains/jobs/jobs.tokens.ts
export const JOB_SEARCH_PROVIDER = Symbol('JOB_SEARCH_PROVIDER');

// Provide in module:
{
  provide: JOB_SEARCH_PROVIDER,
  useClass: PrismaJobSearchProvider,
}

// Inject in service:
constructor(
  @Inject(JOB_SEARCH_PROVIDER) private readonly search: IJobSearchProvider,
) {}
```
