---
name: coding-conventions
description: Enforce SOLID, NestJS patterns, DTO validation, typed errors, and zero technical debt. Use when writing or refactoring any NestJS service, controller, or adapter, or reviewing a PR for code quality.
---

# Skill: Coding Conventions

**Applicable Personas**: All (Senior Engineer, Mid Engineer, QA Tester)

---

## Purpose

Produce scalable, loosely-coupled, maintainable NestJS/TypeScript code from the first commit.

---

## Preconditions (Fail-Closed)

Before writing code:
1. **Interface approved** — service/adapter interface designed (see `interface-designer`)
2. **Module boundary known** — `src/core/` or `src/domains/{name}/`
3. **OpenAPI spec read** — endpoints you're implementing are defined in `docs/api/openapi.yaml`

If missing: **STOP and request clarification.**

---

## SOLID Principles

### S — Single Responsibility

Each class has **one reason to change**. When a service exceeds ~300 lines, extract responsibilities.

✅ `JobsService` — CRUD + state changes only
✅ `JobSlugService` — slug generation only
✅ `BatchWorker` — batch processing only
❌ `JobsService` that also sends emails, generates slugs, and processes batches

### O — Open/Closed

Add new behaviour via new classes, not by modifying existing ones.

✅ `IStorageProvider` interface → `MinioStorageProvider`, `R2StorageProvider`
❌ `if (env === 'local') { minio } else { r2 }` inside `StorageService`

### D — Dependency Inversion

Services depend on **interfaces**, not concrete implementations.

✅ `constructor(private readonly storage: IStorageProvider)` — injected
❌ `constructor() { this.storage = new MinioStorageProvider() }` — instantiated

---

## NestJS Patterns

### Controllers — Always Thin

```typescript
// ✅ Good
@Post(':jobId/apply')
async apply(@Param('jobId') jobId: string, @Body() dto: ApplyDto, @CurrentUser() user?: UserEntity) {
  return this.applicationsService.apply(jobId, dto, user);
}

// ❌ Bad — business logic in controller
@Post(':jobId/apply')
async apply(@Param('jobId') jobId: string, @Body() dto: ApplyDto) {
  const job = await this.prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new NotFoundException();
  // ... more logic
}
```

### Services — Own the Logic

```typescript
@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly throttle: ThrottleService,
  ) {}

  async apply(jobId: string, dto: ApplyDto, user?: UserEntity): Promise<ApplicationCreatedResult> {
    await this.throttle.check(`apply:${user?.id ?? dto.ip}`, LIMITS.applyPerHour);
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundError('Job', jobId);
    // ... business logic
  }
}
```

### DTOs — Always Validated

```typescript
export class ApplyDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsPhoneNumber()
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  coverNote?: string;
}
```

### Typed Errors — Always

```typescript
// ✅
throw new NotFoundError('Job', jobId);
throw new ConflictError('Already applied to this job');
throw new ForbiddenError('Admin role required');

// ❌
throw new Error('Job not found');
throw new HttpException('Already applied', 409);
```

---

## Error Handling Pattern

```typescript
async findJob(id: string): Promise<Job> {
  const job = await this.prisma.job.findUnique({ where: { id } });
  if (!job) throw new NotFoundError('Job', id);
  return job;
}
```

Never swallow errors:

```typescript
// ❌ Forbidden
try {
  await this.email.send(message);
} catch (e) {
  console.log('Email failed', e); // swallowed
}

// ✅ Correct
try {
  await this.email.send(message);
} catch (e) {
  this.logger.error({ err: e, message }, 'Failed to send email');
  throw new AppError('Email delivery failed', 500);
}
```

---

## Pagination Contract

All list methods must return `PaginatedResult<T>`:

```typescript
async search(params: JobSearchDto): Promise<PaginatedResult<JobSummary>> {
  const [data, total] = await Promise.all([
    this.prisma.job.findMany({ ... skip: (page-1)*pageSize, take: pageSize }),
    this.prisma.job.count({ where }),
  ]);
  return { data, meta: { total, page, pageSize, totalPages: Math.ceil(total/pageSize) } };
}
```
