# Security Standard

## Secrets

- Never commit API keys, tokens, or connection strings to the repository
- All credentials via `ConfigService` / environment variables only
- `.env.example` documents every required variable — never copy actual values
- Batch API keys: stored as `bcryptjs` hash in `api_keys` table; never log the plaintext

## Authentication

- Every controller method that isn't `@Public()` requires `JwtAuthGuard`
- Role guards applied at controller level via `@Roles('admin')` decorator
- JWT: HS256 with separate secrets for access (`JWT_SECRET`) and refresh (`JWT_REFRESH_SECRET`)
- Access token TTL: 15 minutes. Refresh token TTL: 30 days (configurable)
- Refresh tokens: stored as bcrypt hash; rotated on every use; all tokens revoked on password change

## Passwords

- `bcryptjs` with cost factor 12 (`bcrypt.hash(password, 12)`)
- Never log password values, even in debug mode
- Password-reset tokens expire after 1 hour and are single-use

## Input Validation

- `ValidationPipe` globally with `{ whitelist: true, forbidNonWhitelisted: true }` — strips unknown fields
- All DTOs have `class-validator` decorators; no raw request body access
- File uploads: validate MIME type and max size server-side (do not trust `Content-Type` header)

## Error Responses

- `GlobalExceptionFilter` strips stack traces from all API responses in production
- Never expose internal details (Prisma query, DB schema, file paths) in error messages
- Use typed error classes from `src/core/error/` — maps to structured `{ code, message }` response

## Rate Limiting

- `@Throttle({ default: { ttl: 60000, limit: 60 } })` on all unauthenticated endpoints
- Apply tighter limits per business rule: apply endpoint (10/hour/IP), auth login (5/minute/IP)
- Batch endpoint: API key required; rate limit per key (1,000 jobs/minute)

## SQL

- Prisma ORM exclusively — no string interpolation of user input into raw SQL
- If `prisma.$executeRaw` is needed, always use template literals: `prisma.$executeRaw`Sql\`SELECT ...\``
