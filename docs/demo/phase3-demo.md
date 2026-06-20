# Phase 3 Demo — Jobs Domain

**Phase**: 3 (complete)  
**Deliverable**: Job CRUD for admin and vendor posting; full-text search.  
**Backwards compatible with**: Phase 1 (`GET /api/health`) and Phase 2 (auth + `/api/v1/me`).

```bash
./scripts/phase3-demo.sh          # automated gate
bun run demo:phase3               # same
```

---

## Phase 3 deliverables checklist

| #   | Deliverable                         | Location                              | Verified by                          |
| --- | ----------------------------------- | ------------------------------------- | ------------------------------------ |
| 1   | `POST /api/v1/jobs` (admin/vendor)  | `src/api/src/domains/jobs/`           | E2E + Postman + live smoke           |
| 2   | `GET /api/v1/jobs` search           | `JobsService.search()`                | Unit + integration + E2E             |
| 3   | `GET /api/v1/jobs/:slug` + views    | `JobsService.findBySlug()`            | E2E                                  |
| 4   | `PATCH /api/v1/jobs/:id`            | `JobsService.update()`                | E2E + integration                    |
| 5   | `DELETE /api/v1/jobs/:id` (soft)    | `JobsService.softDelete()`            | E2E (status → `closed`, row kept)    |
| 6   | Vendor package credit deduction     | `JobsService.create()` `$transaction` | Unit + E2E                           |
| 7   | Search priority (direct > scraped)  | `sortForSearch()`                     | Unit + integration                   |
| 8   | URL-safe unique slugs               | `job-slug.util.ts`                    | Unit + E2E                           |
| 9   | **API contract drift guard** (tech-debt protection) | `src/api/src/domains/api-contract/` + `scripts/check-api-contract.ts` | `bun run api:contract:check`; CI `API Contract Drift Guard` job; Part F demo |
| 10  | OpenAPI `x-implemented` markers     | `docs/api/openapi.yaml`               | Contract guard + `bun run api:validate` |
| 11  | Phase 1 + 2 still work              | health, auth, `/me`                   | Phase 2 demo + backwards-compat E2E  |

**Test coverage**: global ≥ 90% on all metrics (`bun run api:test:cov`).

**Not Phase 3** (frontend `/jobs` page still reads Supabase; Nest API jobs are validated via Swagger, Postman, and `/dev/diagnostics` health).

---

## Prerequisites

```bash
bun run setup:env
docker compose up -d postgres redis minio
bun run api:migrate:dev
```

| Variable            | Example                 | Purpose                          |
| ------------------- | ----------------------- | -------------------------------- |
| `JWT_SECRET`        | 32+ chars               | Token signing                    |
| `CORS_ORIGIN`       | `http://localhost:8080` | Email links + dev CORS           |
| `VITE_API_BASE_URL` | `http://localhost:3001` | Frontend → API (diagnostics)   |
| `DATABASE_URL`      | `localhost:5433`        | Postgres                         |

Start API (and optional frontend):

```bash
bun run api:dev    # :3001 — Swagger at /api/docs
bun run dev        # :8080 — diagnostics at /dev/diagnostics
```

---

## Part A — Postman walkthrough

### Setup

1. Import `src/api/postman/warehousejobs.postman_collection.json`
2. Import `src/api/postman/warehousejobs.postman_environment.json`
3. Select **WarehouseJobs — Local Dev**

### Option 1 — Full stack (auth + jobs)

Run folder **Phase 2 — Walkthrough** first (steps 1–4) so `bearerToken` is set.

Then run **Phase 3 — Walkthrough (run in order)**:

| Step | Request                    | Expected | What to verify                                      |
| ---- | -------------------------- | -------- | --------------------------------------------------- |
| 1    | GET /api/v1/jobs           | 200      | `data` array + `meta.page`                          |
| 2    | POST /api/v1/jobs (admin)  | 201      | `slug` URL-safe; saves `jobId` / `jobSlug` to env   |
| 3    | GET /api/v1/jobs/:slug     | 200      | `views` ≥ 1; `screeningQuestions` array             |
| 4    | PATCH /api/v1/jobs/:id     | 200      | e.g. `featured: true`                               |
| 5    | DELETE /api/v1/jobs/:id    | 204      | Row still in DB with `status: closed` (see Part D)  |
| 6    | POST /api/v1/jobs (seeker) | 403      | Wrong role blocked                                  |

**Admin job POST** requires `companyId` in the environment. Set it from Postgres:

```bash
docker compose exec -T postgres psql -U wj_user -d warehousejobs -c \
  "SELECT id, name FROM companies LIMIT 5;"
```

Or create a dev admin JWT and company:

```bash
bun run dev:token --role admin
# Then verify email in DB if /me returns 401:
docker compose exec -T postgres psql -U wj_user -d warehousejobs -c \
  "UPDATE users SET email_verified_at = NOW() WHERE email = 'dev@warehousejobs.com';"
```

Paste `companyId` into Postman env before step 2.

### Option 2 — Jobs folder only

Folder **Jobs (Phase 3)** contains `GET /api/v1/jobs` (public, no auth).

---

## Part B — Swagger UI (browser)

1. Open http://localhost:3001/api/docs
2. **Jobs** tag → `GET /api/v1/jobs` → Execute → 200 paginated JSON
3. Authorize with Bearer token from `bun run dev:token` (after verifying email in DB)
4. `POST /api/v1/jobs` with sample body + `companyId`
5. `GET /api/v1/jobs/{slug}` using returned slug
6. `PATCH` / `DELETE` using returned `id`

This is the primary **browser** validation path for Phase 3 API behavior.

---

## Part C — Frontend (limited Phase 3 scope)

| Step | URL / action           | What to inspect                                      |
| ---- | ---------------------- | ---------------------------------------------------- |
| 1    | `/dev/diagnostics`     | API health green; base URL `http://localhost:3001`   |
| 2    | Sign in (Phase 2 auth) | JWT from Nest API; `/api/v1/me` works from diagnostics |
| 3    | `/jobs`                | **Still Supabase-backed** — not Nest jobs API yet    |

Phase 3 API jobs are not wired to the public job board UI; use Postman or Swagger for jobs CRUD.

---

## Part D — Verify soft delete (DB)

After DELETE in Postman:

```bash
docker compose exec -T postgres psql -U wj_user -d warehousejobs -c \
  "SELECT id, status FROM jobs WHERE id = '<jobId>';"
```

Expect `status = closed` and row still present.

Closed jobs disappear from `GET /api/v1/jobs` (only `published` / `active` listed).

---

## Part E — Vendor credit deduction

1. Create vendor user + company + package (or use integration test fixtures pattern).
2. Note `company_packages.used_credits` before POST.
3. `POST /api/v1/jobs` as vendor with `companyPackageId` → 201.
4. `used_credits` increments by 1 in the same transaction as job create.
5. Exhaust credits → next POST returns **400** with insufficient credits message.

Automated: E2E `POST as vendor with package → 201 and decrements credit`.

---

## Part F — API contract drift guard (Demo walkthrough)

**Story for stakeholders**: *"As the API grows, a fail-closed CI gate guarantees the published contract (`docs/api/openapi.yaml`), the running NestJS code, and the Postman client artifacts never drift apart. The spec cannot silently rot."*

**Tier**: This demo is **CI-safe** — it needs no live adapters, no running API, and no Docker data stores for the core checks (`api:validate`, `api:contract:check`). `./scripts/phase3-demo.sh` runs the negative proof automatically.

### How it works

1. `contract:check` (`src/api/scripts/check-api-contract.ts`) boots a mocked NestJS context (Prisma stubbed), introspects the **live route surface** via `DiscoveryService` + `Reflector`, and diffs it against operations marked `x-implemented: true` in `docs/api/openapi.yaml`.
2. The guard reports two kinds of drift and **exits non-zero** on either:
   - **Undocumented route** — exists in code, missing from the spec (or not marked `x-implemented: true`).
   - **Phantom route** — marked implemented in the spec, missing from code.
3. Postman runtime validation runs separately in CI via Newman against a live API (`.github/workflows/postman.yml`).
4. SwaggerHub publishing is gated: `.github/workflows/publish-swagger.yml` runs validate + contract:check **before** any push to `redbonzai/warehousejobs-api/<version>`.

### F1 — Validate the spec and prove zero drift (happy path)

```bash
bun run api:validate          # OpenAPI 3 structural validation
bun run api:contract:check    # live NestJS routes vs docs/api/openapi.yaml
```

**Verify visually**: in-sync report with matching code/spec fingerprints and exit code `0`.

```text
API contract is in sync with .../docs/api/openapi.yaml.
  code fingerprint: 89755c237d18
  spec fingerprint: 89755c237d18
```

### F2 — Negative proof (guard fails closed on drift)

Inject a phantom path into a **throwaway copy** of the spec — the committed file is never modified:

```bash
TAMPER=$(mktemp -d)
export TAMPER
(cd src/api && bun -e "
import fs from 'fs';
import yaml from 'yaml';
const s = yaml.parse(fs.readFileSync('../../docs/api/openapi.yaml', 'utf8'));
s.paths['/api/__drift_probe__'] = {
  get: { tags: ['System'], 'x-implemented': true, responses: { 200: { description: 'probe' } } },
};
fs.writeFileSync(process.env.TAMPER + '/openapi.yaml', yaml.stringify(s));
")
bun --env-file=.env --cwd src/api scripts/check-api-contract.ts --spec "$TAMPER/openapi.yaml"
echo "exit=$?"   # expect 1 — phantom route in spec, not in code
rm -rf "$TAMPER"
```

**Verify visually**: drift report flagging `/api/__drift_probe__` as present in spec but missing in code, and `exit=1`.

### F3 — Publish path (operator / CI)

Local dry-run (no SwaggerHub upload):

```bash
bash scripts/publish-swagger.sh --dry-run
```

Live publish (requires `SWAGGER_API_KEY` in `.env`):

```bash
bun run api:publish
# or version bump + publish:
bash scripts/bump-api-version.sh patch --push
```

On `main`, when `docs/api/openapi.yaml` changes, GitHub Actions runs `publish-swagger.yml` — contract guard first, then SwaggerHub push.

### F4 — Programmatic test coverage

The guard is covered across the test pyramid (included in `./scripts/phase3-demo.sh` step 6–8):

```bash
cd src/api
bun run test -- --testPathPattern=api-contract          # unit
bun run test:integration -- --testPathPattern=api-contract
bun run test:e2e -- --testPathPattern=api-contract
```

| Layer       | What it proves                                            | File |
| ----------- | --------------------------------------------------------- | ---- |
| Unit        | `diff()`, spec loader, route path normalization         | `test/unit/domains/api-contract/*.spec.ts` |
| Integration | Real `AppModule` route surface == `openapi.yaml`          | `test/integration/api-contract.integration.spec.ts` |
| E2E         | Guard CLI exits clean on real spec, non-zero on tampered  | `test/e2e/api-contract.e2e-spec.ts` |
| Newman      | Postman folders exercise live HTTP surface                | `.github/workflows/postman.yml` |

### Stakeholder checklist

- [ ] `bun run api:validate` exits `0`
- [ ] `bun run api:contract:check` reports in sync and exits `0`
- [ ] Negative proof: tampered spec copy makes the guard exit non-zero (F2)
- [ ] Unit + integration + e2e api-contract suites pass
- [ ] CI **API Contract Drift Guard** job is green on the PR (fail-closed gate)
- [ ] `publish-swagger.yml` runs contract guard before SwaggerHub push (on spec changes to `main`)

### Troubleshooting

| Symptom | Fix |
| ------- | --- |
| `Undocumented route(s)` reported | You added/changed a controller route — update `docs/api/openapi.yaml` and mark `x-implemented: true`, then update Postman |
| `Phantom route(s)` reported | Spec references a route that no longer exists in code — remove or unmark in `openapi.yaml` |
| Publish workflow skipped | Only runs on `docs/api/openapi.yaml` changes to `main`, or trigger manually in Actions |
| `SWAGGER_API_KEY` missing | Add to repo secret / root `.env` for local `api:publish` |

Full design + developer remediation workflow: [`docs/agent/analysis/api-contract-drift-guard.md`](../../agent/analysis/api-contract-drift-guard.md)

---

## Part G — Automated quality gate

```bash
./scripts/phase3-demo.sh
```

Includes lint, type-check, OpenAPI validate, **contract:check + tampered-spec negative proof**, unit+coverage, integration, E2E (jobs + api-contract), backwards-compat smoke, build, and optional live jobs curl smoke.

Options: `--skip-docker`, `--skip-integration`, `--live`

### Troubleshooting

| Error | Cause | Fix |
| ----- | ----- | --- |
| `Script not found "dun"` | Typo: `dun run` instead of `bun run` | Use `bun run …` (see commands below) |
| `register` → 500 in integration | Live Resend/Twilio creds in `.env` | Integration setup forces dry-run email; run via `bun run api:test:integration` |
| `job detail expected 200` in live smoke | Wrong slug parsed from create response | Fixed in `phase3-demo.sh` (uses JSON parse, not `sed`) |

Correct commands (always `bun`, not `dun`):

```bash
bun run api:test:integration
bun run demo:phase3
```

---

## Jobs endpoints (implemented — OpenAPI `x-implemented: true`)

| Method | Path                    | Auth              | Success |
| ------ | ----------------------- | ----------------- | ------- |
| GET    | `/api/v1/jobs`          | Public            | 200     |
| POST   | `/api/v1/jobs`          | Bearer admin/vendor | 201   |
| GET    | `/api/v1/jobs/{slug}`   | Public            | 200     |
| PATCH  | `/api/v1/jobs/{id}`     | Bearer admin/vendor | 200   |
| DELETE | `/api/v1/jobs/{id}`     | Bearer admin/vendor | 204   |

---

## Related

- Phase 1: [`phase1-demo.md`](phase1-demo.md)
- Phase 2: [`phase2-demo.md`](phase2-demo.md)
- Platform overview: [`overview.md`](overview.md)
- API contract drift guard (design): [`../../agent/analysis/api-contract-drift-guard.md`](../../agent/analysis/api-contract-drift-guard.md)
- Postman: `src/api/postman/README.md`
- CI workflows: `.github/workflows/ci.yml` (API Contract Drift Guard job), `.github/workflows/publish-swagger.yml`
