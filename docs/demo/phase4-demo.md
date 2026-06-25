# Phase 4 Demo — Batch Ingestion

**Phase**: 4  
**Deliverable**: Bulk job ingestion (JSON + CSV multipart); async BullMQ processing; deduplication by `externalId`.  
**Backwards compatible with**: Phase 1 (`GET /api/health`), Phase 2 (auth + `/api/v1/me`), Phase 3 (jobs CRUD + search).

```bash
./scripts/phase4-demo.sh          # automated gate
bun run demo:phase4               # same
```

---

## Phase 4 deliverables checklist

| #   | Deliverable                              | Location                         | Verified by                          |
| --- | ---------------------------------------- | -------------------------------- | ------------------------------------ |
| 1   | `POST /api/v1/jobs/batch` (JSON + CSV)   | `src/api/src/domains/batch/`     | E2E + Postman + live smoke           |
| 2   | `GET /api/v1/jobs/batch/:id/status`      | `BatchService.getStatus()`       | E2E + integration                    |
| 3   | Sync ≤100 jobs (HTTP 200)                | `BatchService.ingest()`          | Unit + E2E + demo script             |
| 4   | Async >100 jobs (HTTP 202 + poll)        | BullMQ `BatchWorker`             | Integration + live smoke             |
| 5   | Dedup by `externalId`                    | `BatchService.processItem()`     | Unit + integration + demo            |
| 6   | API key + admin Bearer auth              | `BatchAuthGuard`                 | Unit + E2E                           |
| 7   | Scraped batch jobs rank below direct     | `JobsService.search()`           | Integration priority test            |
| 8   | OpenAPI + contract guard                 | `docs/api/openapi.yaml`          | `bun run api:contract:check`         |
| 9   | Phase 1–3 still work                     | health, auth, jobs               | E2E backwards-compat suites          |
| 10  | **FE-3** jobs board on Nest API          | `src/routes/jobs.tsx`, `api-client` | Part D + `validate-phase4-frontend` |
| 11  | **FE-4** batch diagnostics panel         | `dev.diagnostics.tsx`, `api-client` | Part D + `validate-phase4-frontend` |

**Test coverage**: global ≥ 90% on all metrics (`bun run api:test:cov`).

**Frontend**: Batch ingest is partner/scraper-facing (API key). Until **FE-3** lands, `/jobs` reads Supabase; until **FE-4**, use Postman/curl/Swagger for batch. The demo script runs programmatic FE checks (inventory + optional live HTML smoke).

---

## Prerequisites

```bash
bun run setup:env
docker compose up -d postgres redis minio
bun run api:migrate:dev
```

| Variable            | Example                              | Purpose                          |
| ------------------- | ------------------------------------ | -------------------------------- |
| `JWT_SECRET`        | 32+ chars                            | Admin Bearer fallback            |
| `API_KEY_HASH`      | SHA-256 of your dev key (see below)  | Env fallback when no DB key row  |
| `REDIS_URL`         | `redis://localhost:6379`             | BullMQ async batches             |
| `DATABASE_URL`      | `localhost:5433`                     | Postgres                         |
| `VITE_API_BASE_URL` | `http://localhost:3001`              | Frontend diagnostics (optional)  |

Start API (and optional frontend):

```bash
bun run api:dev    # :3001 — Swagger at /api/docs
bun run dev        # :8080 — /dev/diagnostics
```

### Seed a demo API key (local)

```bash
DEMO_KEY="wj-phase4-demo-batch-key"
HASH=$(printf '%s' "$DEMO_KEY" | shasum -a 256 | awk '{print $1}')
docker compose exec -T postgres psql -U wj_user -d warehousejobs -c \
  "INSERT INTO api_keys (id, key_hash, description, created_at)
   VALUES (gen_random_uuid(), '${HASH}', 'Local demo', NOW())
   ON CONFLICT (key_hash) DO NOTHING;"
export BATCH_DEMO_API_KEY="$DEMO_KEY"
```

Set Postman env `swaggerApiKey` to the same plaintext key.

---

## Part A — Postman walkthrough

### Setup

1. Import `src/api/postman/warehousejobs.postman_collection.json`
2. Import `src/api/postman/warehousejobs.postman_environment.json`
3. Select **WarehouseJobs — Local Dev**
4. Set `swaggerApiKey` to your plaintext API key (e.g. `wj-phase4-demo-batch-key`)

Optional: run **Phase 2 — Walkthrough** first if you want to test admin Bearer fallback on batch endpoints.

Run folder **Phase 4 — Walkthrough (run in order)**:

| Step | Request                              | Expected | What to verify                                      |
| ---- | ------------------------------------ | -------- | --------------------------------------------------- |
| 1    | POST /api/v1/jobs/batch (sync JSON)  | 200      | `batchId`, `status: completed`, counters            |
| 2    | GET /api/v1/jobs/batch/:id/status    | 200      | Same `batchId`, `total`, `created`                  |
| 3    | POST dedup re-run (same externalId)  | 200      | `skipped: 1`, `created: 0`                          |
| 4    | POST /api/v1/jobs/batch (CSV file)   | 200      | Multipart upload; `total` matches CSV rows          |
| 5    | GET /api/v1/jobs (search)            | 200      | Ingested jobs appear in `data` array                |
| 6    | POST async batch (101 jobs)          | 202      | `status: queued`, save `batchId`                    |
| 7    | Poll GET …/status until completed    | 200      | `status: completed`, counters sum to `total`        |

---

## Part B — curl recipes

### Sync JSON batch (≤100 jobs)

```bash
curl -s -X POST "http://localhost:3001/api/v1/jobs/batch" \
  -H "X-Api-Key: wj-phase4-demo-batch-key" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "curl-demo",
    "jobs": [{
      "externalId": "curl-001",
      "title": "Warehouse Associate",
      "location": "Dallas, TX",
      "city": "Dallas",
      "state": "TX",
      "employmentType": "full_time",
      "shift": "first",
      "description": "General warehouse duties including picking, packing, and loading.",
      "sourceType": "scraped"
    }]
  }' | jq .
```

### Poll batch status

```bash
BATCH_ID="<uuid-from-create-response>"
curl -s "http://localhost:3001/api/v1/jobs/batch/${BATCH_ID}/status" \
  -H "X-Api-Key: wj-phase4-demo-batch-key" | jq .
```

### CSV multipart upload (same POST path)

```bash
curl -s -X POST "http://localhost:3001/api/v1/jobs/batch" \
  -H "X-Api-Key: wj-phase4-demo-batch-key" \
  -F "source=csv-feed-demo" \
  -F "file=@./sample-batch.csv;type=text/csv" | jq .
```

Sample `sample-batch.csv`:

```csv
title,location,city,state,employmentType,shift,description,sourceType,externalId
Forklift Operator,Dallas TX,Dallas,TX,full_time,first,Operate forklifts safely in a busy warehouse.,scraped,csv-001
```

### Admin Bearer fallback

```bash
ADMIN_TOKEN="$(bun run dev:token -- --role admin --email admin@demo.test 2>/dev/null | grep -E '^eyJ' | head -1)"
curl -s -X POST "http://localhost:3001/api/v1/jobs/batch" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{ "jobs": [{ "title": "Admin Batch Job", "location": "Austin, TX", "employmentType": "full_time", "shift": "first", "description": "Posted via admin bearer token for batch demo.", "sourceType": "api" }] }' | jq .
```

---

## Part C — Swagger UI (browser)

1. Open [http://localhost:3001/api/docs](http://localhost:3001/api/docs)
2. Expand **Batch** → `POST /api/v1/jobs/batch`
3. Authorize with **ApiKeyAuth** (plaintext key) or **BearerAuth** (admin JWT)
4. Try JSON body with a single job → **200**
5. Use **multipart/form-data** with a CSV file → **200**

---

## Part D — Frontend validation (FE-3 + FE-4)

Programmatic checks run automatically in `./scripts/phase4-demo.sh` (step 12) via [`scripts/validate-phase4-frontend.sh`](../../scripts/validate-phase4-frontend.sh).

```bash
# Inventory only (passes while FE-3/FE-4 pending)
./scripts/validate-phase4-frontend.sh

# Require dev server + HTML smoke
./scripts/validate-phase4-frontend.sh --live

# Gate after FE-3 and FE-4 are implemented
./scripts/validate-phase4-frontend.sh --require-fe3 --require-fe4 --live
```

### D.1 — Baseline (available now)

| Step | URL / action | Expected |
| ---- | ------------ | -------- |
| 1 | Start `bun run dev` (:8080) + `bun run api:dev` (:3001) | Both reachable |
| 2 | Open `/dev/diagnostics` | Page title **API Diagnostics**; base URL shows `VITE_API_BASE_URL` |
| 3 | Health panel | Green **ok** badge; db / redis / storage **up** |
| 4 | Auth panel | Paste JWT → **GET /api/v1/me** returns 200 JSON |

Automated: script verifies `VITE_API_BASE_URL`, `api-client` health/me, and (if frontend running) diagnostics HTML contains `API Diagnostics` + `GET /api/health`.

---

### D.2 — FE-3: Job board consumes Nest API (Task 3.3)

**Goal**: After batch ingest (Part A/B), ingested jobs appear on the public job board in the browser — not only via Postman.

| Step | Action | Expected |
| ---- | ------ | -------- |
| 1 | Run Part A step 1 (sync batch) or curl demo | Jobs created with `sourceType: scraped` |
| 2 | Open `/jobs` | Page root has `data-testid="jobs-from-api"` |
| 3 | Search / filter Dallas, TX | **Batch Demo Forklift Operator** (or your ingest title) visible |
| 4 | Open job detail `/jobs/{slug}` | Detail loads from Nest API; view counter increments |
| 5 | DevTools → Network | Requests go to `{VITE_API_BASE_URL}/api/v1/jobs` — **no** Supabase `search_jobs` RPC |

**Implementer markers** (required for programmatic validation):

- Remove `@/integrations/supabase/client` from `src/routes/jobs.tsx` (and related job routes)
- Add `searchJobs()` / `getJobBySlug()` to `src/lib/api-client.ts`
- Add `data-testid="jobs-from-api"` on the jobs list root element

**Search priority visual check** (needs direct + batch jobs in same city):

1. Post a **direct** job via Phase 3 admin POST (or employer UI after FE-3)
2. Ingest a **scraped** batch job for the same city
3. On `/jobs`, direct job appears **above** scraped batch job

Automated: script greps source files; with `--require-fe3 --live`, fails if Supabase still imported or `/jobs` HTML lacks marker / batch job title.

---

### D.3 — FE-4: Batch dev panel on diagnostics (Task 4.4)

**Goal**: Ingest and poll a batch entirely from the browser — no Postman required for Phase 4 sign-off.

| Step | Action | Expected |
| ---- | ------ | -------- |
| 1 | Open `/dev/diagnostics` | **Batch Ingest** panel visible (`data-testid="batch-ingest-panel"`) |
| 2 | Paste plaintext API key | Same key as Postman `swaggerApiKey` |
| 3 | Submit sample JSON (1–2 jobs) | Panel shows **200** + `batchId`, `created` count |
| 4 | Click **Poll status** | Status → `completed`; counters match |
| 5 | Re-submit same `externalId` | Panel shows `skipped: 1` |
| 6 | Open `/jobs` (after FE-3) | New jobs visible on board |

**Implementer markers**:

- `apiClient.submitBatch(apiKey, body)` and `apiClient.getBatchStatus(apiKey, batchId)` in `src/lib/api-client.ts` (use `X-Api-Key` header, not JWT)
- `BatchPanel` component on `dev.diagnostics.tsx` with `data-testid="batch-ingest-panel"`
- Panel hidden in production (same route guard as diagnostics)

Automated: script greps for batch methods + test id; with `--require-fe4 --live`, fails if panel missing from HTML.

---

### D.4 — End-to-end browser flow (FE-3 + FE-4 complete)

Run in order without Postman:

1. `bun run api:dev` + `bun run dev`
2. Seed API key (Prerequisites above)
3. `/dev/diagnostics` → batch panel → ingest 2 jobs
4. `/jobs` → confirm both titles appear
5. `/dev/diagnostics` → dedup re-run → panel shows `skipped`
6. Optional: admin `/admin/jobs` shows **scraped** / **batch** source badge (FE-4 scope)

Cross-check: `./scripts/validate-phase4-frontend.sh --require-fe3 --require-fe4 --live` exits 0.

---

## Part E — DB verification

After sync ingest:

```bash
docker compose exec -T postgres psql -U wj_user -d warehousejobs -c \
  "SELECT id, status, total, created, updated, skipped, failed FROM batch_jobs ORDER BY created_at DESC LIMIT 3;"

docker compose exec -T postgres psql -U wj_user -d warehousejobs -c \
  "SELECT external_id, title, source_type, status FROM jobs WHERE external_id LIKE 'phase4-%' OR external_id LIKE 'curl-%' LIMIT 10;"
```

Dedup check: re-submit the same `externalId` — `batch_jobs.updated` or `skipped` increments; no duplicate job rows.

---

## Part F — Search priority (direct > scraped)

1. Create a **direct** job via Phase 3 admin POST (or integration fixture pattern)
2. Ingest a **scraped** batch job for the same city via batch API
3. `GET /api/v1/jobs?city=Dallas&state=TX` — direct job appears before scraped batch job

Automated: integration test `Search priority (sourceType ordering)`.

---

## Part G — Automated quality gate

```bash
./scripts/phase4-demo.sh
```

Includes lint, type-check, OpenAPI validate, contract guard (+ negative drift proof), unit+coverage, integration, E2E (batch + backwards-compat), build, optional live batch curl smoke, and **step 12 frontend validation** (`validate-phase4-frontend.sh`).

Options: `--skip-docker`, `--skip-integration`, `--live`

Standalone frontend checks:

```bash
./scripts/validate-phase4-frontend.sh --live
./scripts/validate-phase4-frontend.sh --require-fe3 --require-fe4 --live   # after FE tasks land
```

---

## Batch endpoints (implemented — OpenAPI `x-implemented: true`)

| Method | Path                               | Auth                    | Success |
| ------ | ---------------------------------- | ----------------------- | ------- |
| POST   | `/api/v1/jobs/batch`               | X-Api-Key or Bearer     | 200/202 |
| GET    | `/api/v1/jobs/batch/{batchId}/status`| X-Api-Key or Bearer    | 200     |

---

## Related

- Phase plan: [`docs/plan.md`](../plan.md) — Phase 4 + FE-4 tasks
- OpenAPI: [`docs/api/openapi.yaml`](../api/openapi.yaml)
- Phase 3 demo (jobs): [`phase3-demo.md`](./phase3-demo.md)
