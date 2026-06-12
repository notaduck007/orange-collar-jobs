# TypeScript Standard

## Compiler Config (non-negotiable)

```json
{
  "strict": true,
  "strictNullChecks": true,
  "noImplicitAny": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "exactOptionalPropertyTypes": true
}
```

## Type Safety Rules

- **No `any`** — use `unknown` + narrow with type guard. Never `as any`.
- **No `!` non-null assertion** — narrow with `if (!x) throw new NotFoundError(...)`.
- **No `as` cast** without a Zod schema validation or type guard immediately above it.
- **Explicit return types** on all public service and controller methods.
- **`readonly`** on all immutable interface properties.

## Imports

- Use path aliases: `@core/database`, `@domains/jobs` — never `../../`
- Use `import type` for type-only imports
- Import from module barrels (`index.ts`), never from internal files

## Async

- Always `async/await` — never `.then()/.catch()` chains
- Never fire-and-forget without explicit logging: `this.someService.doThing().catch(e => this.logger.error(e))`

## Enums vs Unions

- **Enums** for domain status values: `JobStatus`, `ApplicationStatus`, `JobSourceType` (Prisma-synced)
- **String unions** for internal toggles and config flags: `type LogLevel = 'debug' | 'info' | 'warn' | 'error'`

## DTOs

```typescript
export class CreateJobDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title: string;

  @IsEnum(EmploymentType)
  employmentType: EmploymentType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  payMin?: number;
}
```

- `class-validator` decorators on every property
- `class-transformer` for type coercion (`@Type(() => Number)`)
- `PartialType(CreateJobDto)` for update DTOs — never redefine
