# Phase 3 Demo — Jobs Domain

**Phase**: 3 (complete)  
**Deliverable**: Job CRUD for admin and vendor posting; full-text search.  
**Backwards compatible with**: Phase 1 (`GET /api/health`) and Phase 2 (auth + `/api/v1/me`).

```bash
./scripts/phase3-demo.sh          # automated gate
bun run demo:phase3               # same
```

**How to use this doc**: Run the automated gate first. For manual proof, follow **Part A (Postman)** or **Part B (curl)** — both cover the same jobs CRUD chain. Parts F–G cover vendor credits and search priority. Part H is the contract drift guard (CI-safe, no live API required).

---

## Phase 3 deliverables checklist

| #   | Deliverable                         | Location                              | Verified by                          |
| --- | ----------------------------------- | ------------------------------------- | ------------------------------------ |
| 1   | `POST /api/v1/jobs` (admin/vendor)  | `src/api/src/domains/jobs/`           | E2E + Postman Part A + curl Part B |
| 2   | `GET /api/v1/jobs` search           | `JobsService.search()`                | Part A/B + integration + E2E        |
| 3   | `GET /api/v1/jobs/:slug` + views    | `JobsService.findBySlug()`            | Part A/B + E2E                    |
| 4   | `PATCH /api/v1/jobs/:id`            | `JobsService.update()`                | Part A/B + E2E                    |
| 5   | `DELETE /api/v1/jobs/:id` (soft)    | `JobsService.softDelete()`            | Part A/B + Part E                 |
| 6   | Vendor package credit deduction     | `JobsService.create()` `$transaction` | Part F + E2E                      |
| 7   | Search priority (direct > scraped)  | `sortForSearch()`                     | Part G + integration              |
| 8   | URL-safe unique slugs               | `job-slug.util.ts`                    | Unit + E2E                           |
| 9   | **API contract drift guard** (tech-debt protection) | `src/api/src/domains/api-contract/` + `scripts/check-api-contract.ts` | `bun run api:contract:check`; CI `API Contract Drift Guard` job; Part H demo |
| 10  | OpenAPI `x-implemented` markers     | `docs/api/openapi.yaml`               | Contract guard + `bun run api:validate` |
| 11  | Phase 1 + 2 still work              | health, auth, `/me`                   | Phase 2 demo + backwards-compat E2E  |

**Test coverage**: global ≥ 90% on all metrics (`bun run api:test:cov`).

**Phase 3 frontend (FE-3)**: Public `/jobs`, job detail, category pages, employer publish/edit/list, and admin moderation use `GET/POST/PATCH/DELETE /api/v1/jobs` via `src/lib/api-client.ts`. Validate with `./scripts/validate-phase4-frontend.sh --require-fe3 --require-fe4`.

### Manual sign-off checklist (jobs API)

- [ ] Part A or Part B complete — full CRUD chain (search → create → detail → patch → delete)
- [ ] Seeker POST returns **403** (Part B3 or Postman negative step)
- [ ] Soft delete: DB row `closed`, listing + detail **404** (Part E)
- [ ] Vendor credit: `used_credits` increments; second POST **400** (Part F) — optional
- [ ] Search priority: direct before scraped (Part G) — optional
- [ ] `./scripts/phase3-demo.sh` exits 0

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

### Auth + company setup (required before job POST)

Mutating jobs endpoints need a **verified** JWT with role `admin` or `vendor`. Pick one path:

**Option A — Dev admin token (fastest for demos)**

```bash
bun run dev:token --role admin
docker compose exec -T postgres psql -U wj_user -d warehousejobs -c \
  "UPDATE users SET email_verified_at = NOW() WHERE email = 'dev@warehousejobs.com';"
export ADMIN_TOKEN="$(bun run dev:token -- --role admin 2>/dev/null | grep -E '^eyJ' | head -1)"
```

**Option B — Full Phase 2 flow**

Run Postman folder **Phase 2 — Walkthrough** or follow [`phase2-demo.md`](phase2-demo.md) until `bearerToken` is set. For admin job POST you still need an **admin** token (register does not create admin users).

**Company ID for admin POST**

Admin `POST /api/v1/jobs` requires `companyId` in the JSON body:

```bash
docker compose exec -T postgres psql -U wj_user -d warehousejobs -c \
  "SELECT id, name FROM companies LIMIT 5;"
```

If no row exists, create one linked to your admin user (replace email if different):

```bash
docker compose exec -T postgres psql -U wj_user -d warehousejobs -c \
  "INSERT INTO companies (id, owner_id, name, slug, created_at, updated_at)
   SELECT gen_random_uuid(), u.id, 'Phase 3 Demo Co',
          'phase3-demo-' || substr(u.id::text, 1, 8), NOW(), NOW()
   FROM users u WHERE u.email = 'dev@warehousejobs.com' LIMIT 1
   RETURNING id, name;"
```

Paste the UUID into Postman env `companyId` or export `COMPANY_ID` for curl below.

---

## Part A — Postman walkthrough

**What this proves**: All five jobs endpoints behave per OpenAPI; Postman test scripts assert status codes and key JSON fields; env vars chain create → detail → patch → delete.

### Setup

1. Import `src/api/postman/warehousejobs.postman_collection.json`
2. Import `src/api/postman/warehousejobs.postman_environment.json`
3. Select **WarehouseJobs — Local Dev**
4. Set `companyId` (see Prerequisites above)
5. Set `bearerToken` — either from **Phase 2 — Walkthrough** step 4 (Login) or paste `ADMIN_TOKEN` from dev token setup

Collection auth: folder **Phase 3** inherits collection-level Bearer `{{bearerToken}}`.

### Run folder: **Phase 3 — Walkthrough (run in order)**

| Step | Request                    | Status | What to inspect (Body / Test Results)                                                                 |
| ---- | -------------------------- | ------ | --------------------------------------------------------------------------------------------------- |
| **1** | GET /api/v1/jobs           | **200** | `data` is an array; `meta.page` and `meta.pageSize` present; no auth header needed                 |
| **2** | POST /api/v1/jobs (admin)  | **201** | `id`, `slug` (URL-safe, includes city); `status: "published"`; `sourceType: "direct"`; Test Results save `jobId`, `jobSlug` |
| **3** | GET /api/v1/jobs/:slug     | **200** | Same title as step 2; `views` ≥ 1 (increments each visit); `screeningQuestions` array (may be empty) |
| **4** | PATCH /api/v1/jobs/:id     | **200** | Response `featured: true` after body `{"featured": true}`                                         |
| **5** | DELETE /api/v1/jobs/:id    | **204** | Empty body; job removed from search (re-run step 1 — slug gone)                                     |

**Sample POST body** (step 2 — matches collection; `companyId` from env):

```json
{
  "title": "Reach Truck Operator — 2nd Shift",
  "category": "Forklift Operator",
  "location": "Dallas, TX",
  "city": "Dallas",
  "state": "TX",
  "zip": "75201",
  "employmentType": "full_time",
  "shift": "second",
  "payMin": 18,
  "payMax": 22,
  "payPeriod": "hour",
  "description": "Operate reach trucks in a fast-paced warehouse environment.",
  "requirements": "1+ years experience",
  "companyId": "{{companyId}}"
}
```

### Negative proof — seeker cannot post (403)

Not in the walkthrough folder; run manually or use Part B curl:

1. Complete Phase 2 Register + Verify + Login as **seeker** (role defaults to seeker)
2. POST `/api/v1/jobs` with the same body as step 2
3. Expect **403 Forbidden** — only `admin` and `vendor` may create jobs

### Ad-hoc requests

| Folder | Use when |
| ------ | -------- |
| **Jobs (Phase 3)** | Public search only (`GET /api/v1/jobs`) — no auth |
| **Phase 2 — Walkthrough** | Obtain `bearerToken` from scratch |

### Postman ↔ curl parity

Part B curl recipes exercise the same proof chain as this folder. Either path is sufficient for manual sign-off; `./scripts/phase3-demo.sh` step 11 automates the curl version when the API is running.

---

## Part B — curl walkthrough (copy-paste proof chain)

**What this proves**: Live HTTP against all jobs endpoints; Phase 1 health still works; seekers blocked; admin CRUD + soft delete; view counter increments.

Set once per terminal session:

```bash
export API_BASE="http://localhost:3001"
export ADMIN_TOKEN="<paste admin JWT>"
export COMPANY_ID="<paste company UUID>"
```

### B1 — Phase 1 backwards compatibility

```bash
curl -s "${API_BASE}/api/health" | jq '{status, db: .info.db.status, redis: .info.redis.status}'
# Expect: status "ok", db/redis "up"

curl -s -o /dev/null -w "GET /me without token → %{http_code}\n" "${API_BASE}/api/v1/me"
# Expect: 401
```

### B2 — Public search (no auth)

```bash
curl -s "${API_BASE}/api/v1/jobs?page=1&pageSize=20" | jq '{count: (.data | length), page: .meta.page, pageSize: .meta.pageSize}'
```

**Success looks like**:

```json
{ "count": 0, "page": 1, "pageSize": 20 }
```

(`count` may be > 0 if you have seed data.)

**Filtered search** (optional):

```bash
curl -s "${API_BASE}/api/v1/jobs?city=Dallas&state=TX&employmentType=full_time&shift=second" | jq '.data[] | {title, city, state, employmentType, shift}'
```

### B3 — RBAC: seeker POST → 403

```bash
DEMO_EMAIL="phase3-seeker-$(date +%s)@warehousejobs.test"
DEMO_PASSWORD="SecureP@ss1"

curl -s -o /dev/null -w "register → %{http_code}\n" -X POST "${API_BASE}/api/v1/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${DEMO_EMAIL}\",\"password\":\"${DEMO_PASSWORD}\",\"role\":\"seeker\",\"fullName\":\"Phase 3 Seeker\"}"

VERIFY_TOKEN="$(docker compose exec -T postgres psql -U wj_user -d warehousejobs -t -A \
  -c "SELECT ev.token FROM email_verifications ev JOIN users u ON u.id = ev.user_id WHERE u.email = '${DEMO_EMAIL}' LIMIT 1;" | tr -d '[:space:]')"

curl -s -o /dev/null -w "verify-email → %{http_code}\n" -X POST "${API_BASE}/api/v1/auth/verify-email" \
  -H 'Content-Type: application/json' \
  -d "{\"token\":\"${VERIFY_TOKEN}\"}"

SEEKER_TOKEN="$(curl -s -X POST "${API_BASE}/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${DEMO_EMAIL}\",\"password\":\"${DEMO_PASSWORD}\"}" | jq -r .accessToken)"

curl -s -o /dev/null -w "POST /jobs as seeker → %{http_code}\n" -X POST "${API_BASE}/api/v1/jobs" \
  -H "Authorization: Bearer ${SEEKER_TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{\"title\":\"Test\",\"category\":\"Forklift\",\"location\":\"Dallas, TX\",\"city\":\"Dallas\",\"state\":\"TX\",\"employmentType\":\"full_time\",\"shift\":\"first\",\"description\":\"Long enough description for validation rules.\"}"
# Expect: 403
```

### B4 — Admin job lifecycle (create → detail → patch → delete)

**Create (201)**

```bash
CREATE_RESP="$(curl -s -X POST "${API_BASE}/api/v1/jobs" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{
    \"title\": \"Reach Truck Operator — 2nd Shift\",
    \"category\": \"Forklift Operator\",
    \"location\": \"Dallas, TX\",
    \"city\": \"Dallas\",
    \"state\": \"TX\",
    \"zip\": \"75201\",
    \"employmentType\": \"full_time\",
    \"shift\": \"second\",
    \"payMin\": 18,
    \"payMax\": 22,
    \"payPeriod\": \"hour\",
    \"description\": \"Operate reach trucks in a fast-paced warehouse environment.\",
    \"requirements\": \"1+ years experience\",
    \"companyId\": \"${COMPANY_ID}\"
  }")"

echo "$CREATE_RESP" | jq '{id, slug, status, sourceType, views}'
export JOB_ID="$(echo "$CREATE_RESP" | jq -r .id)"
export JOB_SLUG="$(echo "$CREATE_RESP" | jq -r .slug)"
```

**Success looks like** (`status: "published"`, `sourceType: "direct"`, slug contains `dallas`):

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "slug": "reach-truck-operator-2nd-shift-dallas-tx",
  "status": "published",
  "sourceType": "direct",
  "views": 0
}
```

**Detail by slug (200) — view counter**

```bash
curl -s "${API_BASE}/api/v1/jobs/${JOB_SLUG}" | jq '{title, slug, views, screeningQuestions: (.screeningQuestions | length)}'
# Expect: views >= 1 after first GET
```

**Patch (200)**

```bash
curl -s -X PATCH "${API_BASE}/api/v1/jobs/${JOB_ID}" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{"featured": true}' | jq '{id, featured}'
# Expect: featured: true
```

**Soft delete (204)**

```bash
curl -s -o /dev/null -w "DELETE → %{http_code}\n" -X DELETE "${API_BASE}/api/v1/jobs/${JOB_ID}" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}"
# Expect: 204, empty body
```

**Proof job left search listing**

```bash
curl -s -o /dev/null -w "GET detail after delete → %{http_code}\n" "${API_BASE}/api/v1/jobs/${JOB_SLUG}"
# Expect: 404

curl -s "${API_BASE}/api/v1/jobs?pageSize=50" | jq --arg slug "$JOB_SLUG" '[.data[].slug] | index($slug)'
# Expect: null (slug not in active listing)
```

### B5 — DB proof after soft delete

```bash
docker compose exec -T postgres psql -U wj_user -d warehousejobs -c \
  "SELECT id, status, slug FROM jobs WHERE id = '${JOB_ID}';"
# Expect: status = closed, row still present
```

### B6 — Automated parity

`./scripts/phase3-demo.sh` step 11 runs the same curl chain when the API is on `:3001`. Use `--live` to fail if the API is not running.

| Symptom | Likely cause | Fix |
| ------- | ------------ | --- |
| POST → **401** | JWT missing or user not email-verified | Run dev token + `UPDATE users SET email_verified_at = NOW()` |
| POST → **422** | Body validation (short description, bad enum) | Use sample bodies verbatim from Part A/B |
| POST → **403** as admin | Wrong role on token | `bun run dev:token --role admin` |
| POST → **400** vendor | Missing `companyPackageId` or no credits | Part F setup |
| GET slug → **404** after create | Job was soft-deleted or wrong slug | Re-run B4 create; use `JOB_SLUG` from create response |

---

## Part C — Swagger UI (browser)

1. Open http://localhost:3001/api/docs
2. **Jobs** tag → `GET /api/v1/jobs` → Execute → **200** paginated JSON (`data` + `meta`)
3. Click **Authorize** → paste Bearer token from `bun run dev:token` (admin, email verified in DB)
4. `POST /api/v1/jobs` — use sample body from Part A; set `companyId` → **201**; copy `slug` and `id`
5. `GET /api/v1/jobs/{slug}` → **200**; note `views` increments on repeat Execute
6. `PATCH /api/v1/jobs/{id}` → body `{"featured": true}` → **200**
7. `DELETE /api/v1/jobs/{id}` → **204**; re-run GET by slug → **404**

Swagger is equivalent to Postman/curl; use whichever tool you prefer for visual inspection.

---

## Part D — Frontend (FE-3)

| Step | URL / action           | What to inspect                                      |
| ---- | ---------------------- | ---------------------------------------------------- |
| 1    | `/dev/diagnostics`     | API health green; jobs search + batch panels (FE-3/FE-4) |
| 2    | Sign in at `/auth`     | Nest JWT stored; `/api/v1/me` works from diagnostics |
| 3    | `/jobs`                | Root element has `data-testid="jobs-from-api"`; listings from Nest API |
| 4    | `/employer/jobs/new`   | Publish hits `POST /api/v1/jobs` (vendor credit errors surface in UI) |
| 5    | `/admin/jobs`          | Moderation list from API; source badges on rows |

Run `./scripts/validate-phase4-frontend.sh --require-fe3 --require-fe4 --live` with `bun run dev` + `bun run api:dev` running.

---

## Part E — Verify soft delete (DB)

After DELETE in Postman or Part B curl:

```bash
docker compose exec -T postgres psql -U wj_user -d warehousejobs -c \
  "SELECT id, status, slug FROM jobs WHERE id = '${JOB_ID}';"
```

| Check | Expected |
| ----- | -------- |
| Row exists | Yes — soft delete, not hard delete |
| `status` | `closed` |
| Public search | Job absent from `GET /api/v1/jobs` |
| Detail by slug | **404** |

---

## Part F — Vendor package credit deduction

**What this proves**: Vendor posts consume one posting credit atomically; exhausted packages return **400**.

### F1 — Seed vendor + company + package

```bash
VENDOR_EMAIL="phase3-vendor-$(date +%s)@warehousejobs.test"
VENDOR_PASSWORD="SecureP@ss1"

curl -s -X POST "${API_BASE}/api/v1/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${VENDOR_EMAIL}\",\"password\":\"${VENDOR_PASSWORD}\",\"role\":\"vendor\",\"fullName\":\"Phase 3 Vendor\"}"

docker compose exec -T postgres psql -U wj_user -d warehousejobs -c \
  "UPDATE users SET email_verified_at = NOW() WHERE email = '${VENDOR_EMAIL}';"

export VENDOR_USER_ID="$(docker compose exec -T postgres psql -U wj_user -d warehousejobs -t -A \
  -c "SELECT id FROM users WHERE email = '${VENDOR_EMAIL}';" | tr -d '[:space:]')"

docker compose exec -T postgres psql -U wj_user -d warehousejobs -c \
  "INSERT INTO companies (id, owner_id, name, slug, created_at, updated_at)
   VALUES (gen_random_uuid(), '${VENDOR_USER_ID}', 'Vendor Demo Co',
           'vendor-demo-' || substr('${VENDOR_USER_ID}', 1, 8), NOW(), NOW());"

export VENDOR_COMPANY_ID="$(docker compose exec -T postgres psql -U wj_user -d warehousejobs -t -A \
  -c "SELECT id FROM companies WHERE owner_id = '${VENDOR_USER_ID}' LIMIT 1;" | tr -d '[:space:]')"

docker compose exec -T postgres psql -U wj_user -d warehousejobs -c \
  "INSERT INTO company_packages (id, company_id, name, total_credits, used_credits)
   VALUES (gen_random_uuid(), '${VENDOR_COMPANY_ID}', 'Demo Pack', 1, 0);"

export PACKAGE_ID="$(docker compose exec -T postgres psql -U wj_user -d warehousejobs -t -A \
  -c "SELECT id FROM company_packages WHERE company_id = '${VENDOR_COMPANY_ID}' ORDER BY created_at DESC LIMIT 1;" | tr -d '[:space:]')"
```

### F2 — Vendor login + POST with credit

```bash
export VENDOR_TOKEN="$(curl -s -X POST "${API_BASE}/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${VENDOR_EMAIL}\",\"password\":\"${VENDOR_PASSWORD}\"}" | jq -r .accessToken)"

curl -s -o /dev/null -w "vendor POST → %{http_code}\n" -X POST "${API_BASE}/api/v1/jobs" \
  -H "Authorization: Bearer ${VENDOR_TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{
    \"title\": \"Vendor Posted Forklift Job\",
    \"category\": \"Forklift Operator\",
    \"location\": \"Dallas, TX\",
    \"city\": \"Dallas\",
    \"state\": \"TX\",
    \"employmentType\": \"full_time\",
    \"shift\": \"first\",
    \"description\": \"Vendor-created job posting for credit deduction demo.\",
    \"companyPackageId\": \"${PACKAGE_ID}\",
    \"status\": \"published\"
  }"
# Expect: 201

docker compose exec -T postgres psql -U wj_user -d warehousejobs -c \
  "SELECT name, total_credits, used_credits FROM company_packages WHERE id = '${PACKAGE_ID}';"
# Expect: used_credits = 1
```

### F3 — Insufficient credits → 400

Re-run the same POST (package has only 1 credit):

```bash
curl -s -X POST "${API_BASE}/api/v1/jobs" \
  -H "Authorization: Bearer ${VENDOR_TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{
    \"title\": \"Second Vendor Job Should Fail\",
    \"category\": \"General\",
    \"location\": \"Dallas, TX\",
    \"city\": \"Dallas\",
    \"state\": \"TX\",
    \"employmentType\": \"full_time\",
    \"shift\": \"first\",
    \"description\": \"This post should fail because credits are exhausted.\",
    \"companyPackageId\": \"${PACKAGE_ID}\"
  }" | jq '{statusCode: .statusCode, message}'
# Expect: 400 with insufficient credits message
```

**Automated**: E2E `POST /api/v1/jobs as vendor with package → 201 and decrements credit`.

---

## Part G — Search priority (direct ranks above scraped)

**What this proves**: `GET /api/v1/jobs` sorts WJ-direct posts above scraped listings in the same market (see `JobsService.sortForSearch()`).

Phase 3 has no public API to create `sourceType: scraped` jobs (batch ingest is Phase 4). For manual proof, seed one scraped row in Postgres, then POST a direct job via Part B:

```bash
docker compose exec -T postgres psql -U wj_user -d warehousejobs -c \
  "INSERT INTO jobs (id, title, slug, category, category_slug, company_id, location, city, state,
    employment_type, shift, description, status, source_type, posted_at, created_at, updated_at, views)
  VALUES (
    gen_random_uuid(),
    'Scraped Warehouse Associate',
    'scraped-warehouse-associate-dallas-tx-demo',
    'General', 'general', '${COMPANY_ID}', 'Dallas, TX', 'Dallas', 'TX',
    'full_time', 'first',
    'Scraped listing used only to demo search priority ordering.',
    'published', 'scraped', NOW(), NOW(), NOW(), 0
  ) ON CONFLICT (slug) DO NOTHING;"

# Create a direct job via Part B4, then:
curl -s "${API_BASE}/api/v1/jobs?city=Dallas&state=TX&pageSize=10" \
  | jq '[.data[] | {title, sourceType}]'
```

**Success**: first item in `data` has `sourceType: "direct"`; scraped job appears later in the array.

**Automated**: integration test in `test/integration/jobs.integration.spec.ts`.

---

## Part H — API contract drift guard (Demo walkthrough)

**Story for stakeholders**: *"As the API grows, a fail-closed CI gate guarantees the published contract (`docs/api/openapi.yaml`), the running NestJS code, and the Postman client artifacts never drift apart. The spec cannot silently rot."*

**Tier**: This demo is **CI-safe** — it needs no live adapters, no running API, and no Docker data stores for the core checks (`api:validate`, `api:contract:check`). `./scripts/phase3-demo.sh` runs the negative proof automatically.

### How it works

1. `contract:check` (`src/api/scripts/check-api-contract.ts`) boots a mocked NestJS context (Prisma stubbed), introspects the **live route surface** via `DiscoveryService` + `Reflector`, and diffs it against operations marked `x-implemented: true` in `docs/api/openapi.yaml`.
2. The guard reports two kinds of drift and **exits non-zero** on either:
   - **Undocumented route** — exists in code, missing from the spec (or not marked `x-implemented: true`).
   - **Phantom route** — marked implemented in the spec, missing from code.
3. Postman runtime validation runs separately in CI via Newman against a live API (`.github/workflows/postman.yml`).
4. SwaggerHub publishing is gated: `.github/workflows/publish-swagger.yml` runs validate + contract:check **before** any push to `redbonzai/warehousejobs-api/<version>`.

### H1 — Validate the spec and prove zero drift (happy path)

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

### H2 — Negative proof (guard fails closed on drift)

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

### H3 — Publish path (operator / CI)

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

### H4 — Programmatic test coverage

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
- [ ] Negative proof: tampered spec copy makes the guard exit non-zero (H2)
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

## Part I — Automated quality gate

```bash
./scripts/phase3-demo.sh
```

Includes lint, type-check, OpenAPI validate, **contract:check + tampered-spec negative proof**, unit+coverage, integration, E2E (jobs + api-contract), backwards-compat smoke, build, and optional live jobs curl smoke (Part B parity).

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

| Method | Path                    | Auth                | Success | Demo proof        |
| ------ | ----------------------- | ------------------- | ------- | ----------------- |
| GET    | `/api/v1/jobs`          | Public              | 200     | Part A step 1, B2 |
| POST   | `/api/v1/jobs`          | Bearer admin/vendor | 201     | Part A step 2, B4 |
| GET    | `/api/v1/jobs/{slug}`   | Public              | 200     | Part A step 3, B4 |
| PATCH  | `/api/v1/jobs/{id}`     | Bearer admin/vendor | 200     | Part A step 4, B4 |
| DELETE | `/api/v1/jobs/{id}`     | Bearer admin/vendor | 204     | Part A step 5, B4 |

---

## Related

- Phase 1: [`phase1-demo.md`](phase1-demo.md)
- Phase 2: [`phase2-demo.md`](phase2-demo.md)
- Platform overview: [`overview.md`](overview.md)
- API contract drift guard (design): [`../agent/analysis/api-contract-drift-guard.md`](../agent/analysis/api-contract-drift-guard.md)
- Postman: `src/api/postman/README.md`
- CI workflows: `.github/workflows/ci.yml` (API Contract Drift Guard job), `.github/workflows/publish-swagger.yml`
