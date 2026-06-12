# Anti-Patterns — Forbidden

## Fat Controllers

❌ Business logic, DB queries, or transformations in a controller method.
✅ Controllers call exactly one service method and return the result.

## Swallowed Errors

❌ `catch (e) { console.log(e); }` — error absorbed, caller sees incorrect success.
✅ Either handle the error specifically with a typed error class, or re-throw. Always log with context.

## `any` Types

❌ `const x: any = response.data`
✅ `const x: unknown = response.data; if (!isJobResponse(x)) throw new ValidationError(...);`

## Cross-Domain Direct Imports

❌ `import { JobsService } from '../jobs/JobsService'` inside the applications domain.
✅ Import from the domain's barrel: `import { JobsService } from '@domains/jobs'`. If that's not exported, it's private.

## Raw Error Strings

❌ `throw new Error('Job not found')`
✅ `throw new NotFoundError('Job', jobId)` — typed, structured, maps to correct HTTP status.

## Missing Pagination

❌ `async findAll(): Promise<Job[]>` — unbounded array.
✅ `async findAll(params: PaginationParams): Promise<PaginatedResult<Job>>` — always paginated.

## Prisma Outside Services

❌ `this.prisma.job.findMany(...)` in a controller.
✅ Prisma calls inside service methods only. Controllers call services.

## Unguarded BullMQ Workers

❌ Worker job handler with no error handling — one malformed job crashes the worker.
✅ `try/catch` on every job; move to dead-letter queue after `MAX_RETRY_ATTEMPTS`.

## Synchronous Blocking in Async Context

❌ `JSON.parse(fs.readFileSync('large-file.json'))` on the main thread.
✅ Use async I/O. Offload CPU-bound work to BullMQ workers.

## Missing Auth Guard

❌ Controller method without `@UseGuards(JwtAuthGuard)` that returns private data.
✅ All endpoints are guarded by default. Use `@Public()` explicitly to opt out, with a comment explaining why.

## Unvalidated DTO

❌ Controller accepts `@Body() body: any` or a class with no `class-validator` decorators.
✅ All DTOs have `class-validator` decorators; `ValidationPipe` rejects invalid input at the HTTP layer.
