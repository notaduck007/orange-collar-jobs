#!/usr/bin/env bash
# Phase 4 quality gate demo — Batch ingestion (JSON + CSV + BullMQ + dedup).
# Usage: ./scripts/phase4-demo.sh [--skip-docker] [--skip-integration] [--live]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SKIP_DOCKER=false
SKIP_INTEGRATION=false
LIVE=false
for arg in "$@"; do
  case "$arg" in
    --skip-docker) SKIP_DOCKER=true ;;
    --skip-integration) SKIP_INTEGRATION=true ;;
    --live) LIVE=true ;;
  esac
done

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

API_BASE="${API_BASE_URL:-http://localhost:3001}"
DEMO_API_KEY="${BATCH_DEMO_API_KEY:-wj-phase4-demo-batch-key}"
DEMO_API_KEY_HASH="$(bun -e "process.stdout.write(require('crypto').createHash('sha256').update(process.argv[1]).digest('hex'))" "$DEMO_API_KEY")"

step() { echo -e "\n${BOLD}${CYAN}==>${RESET} $1"; }
ok() { echo -e "${GREEN}✓${RESET} $1"; }
fail() { echo -e "${RED}✗${RESET} $1"; exit 1; }
http_code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }

step "1. Environment (root .env only)"
bash scripts/setup-env.sh
ok "Root .env present"

step "2. Install dependencies (Bun workspaces)"
bun install --frozen-lockfile
ok "bun install"

if [[ "$SKIP_DOCKER" == false ]]; then
  step "3. Docker Compose data stores"
  docker compose up -d postgres redis minio
  echo "  Waiting for Postgres..."
  for i in $(seq 1 30); do
    if docker compose exec -T postgres pg_isready -U wj_user -d warehousejobs >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
  bash scripts/ensure-minio-buckets.sh
  ok "postgres + redis + minio ready"
else
  step "3. Docker (skipped)"
fi

step "4. Prisma migrations + client generate"
bun run api:migrate:dev
bun run api:generate
ok "migrations applied"

step "5. Lint + type-check + OpenAPI + contract drift guard + Postman sync check"
bun run api:lint
bun run api:type-check
bun run api:validate
bun run api:contract:check
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
if bun --env-file=.env --cwd src/api scripts/check-api-contract.ts --spec "$TAMPER/openapi.yaml"; then
  rm -rf "$TAMPER"
  fail "contract guard should exit non-zero on phantom route"
fi
rm -rf "$TAMPER"
bun run api:postman:check
ok "lint + types + openapi + contract guard (in sync + fail-closed on drift) + Postman in sync"

step "6. Unit tests + coverage (≥ 90% global)"
bun run api:test:cov
ok "unit tests + coverage"

if [[ "$SKIP_INTEGRATION" == false ]]; then
  step "7. Integration tests (batch + jobs + auth + api-contract)"
  bun run api:test:integration
  ok "integration tests"
else
  step "7. Integration tests (skipped)"
fi

step "8. E2E (batch + jobs + auth + api-contract + Phase 1 compat)"
bun run api:test:e2e
ok "e2e tests"

step "9. Phase 1–3 backwards-compat smoke (live API)"
if curl -sf "${API_BASE}/api/health" >/dev/null 2>&1; then
  HEALTH="$(curl -s "${API_BASE}/api/health")"
  echo "  GET /api/health → $(echo "$HEALTH" | sed -n 's/.*"status":"\([^"]*\)".*/\1/p')"
  ME_CODE="$(http_code "${API_BASE}/api/v1/me")"
  echo "  GET /api/v1/me (no token) → ${ME_CODE}"
  [[ "$ME_CODE" == "401" ]] || fail "Phase 1 /me without token expected 401, got ${ME_CODE}"
  JOBS_CODE="$(http_code "${API_BASE}/api/v1/jobs")"
  echo "  GET /api/v1/jobs → ${JOBS_CODE}"
  [[ "$JOBS_CODE" == "200" ]] || fail "Phase 3 jobs list expected 200, got ${JOBS_CODE}"
  ok "Phase 1–3 endpoints still compatible"
else
  echo "  API not running — backwards-compat live smoke skipped (covered by E2E)"
fi

step "10. API build"
bun run api:build
ok "nest build"

step "11. Live batch smoke (API on :3001)"
if curl -sf "${API_BASE}/api/health" >/dev/null 2>&1; then
  echo "  API reachable at ${API_BASE}"
  echo "  Demo API key (X-Api-Key): ${DEMO_API_KEY}"

  docker compose exec -T postgres psql -U wj_user -d warehousejobs -c \
    "INSERT INTO api_keys (id, key_hash, description, created_at)
     VALUES (gen_random_uuid(), '${DEMO_API_KEY_HASH}', 'Phase 4 demo key', NOW())
     ON CONFLICT (key_hash) DO UPDATE SET description = EXCLUDED.description;" >/dev/null 2>&1 || true

  SYNC_OUT="$(mktemp)"
  SYNC_CODE="$(curl -s -o "$SYNC_OUT" -w "%{http_code}" -X POST "${API_BASE}/api/v1/jobs/batch" \
    -H "X-Api-Key: ${DEMO_API_KEY}" \
    -H 'Content-Type: application/json' \
    -d '{
      "source": "phase4-demo-sync",
      "jobs": [
        {
          "externalId": "phase4-demo-001",
          "title": "Batch Demo Forklift Operator",
          "location": "Dallas, TX",
          "city": "Dallas",
          "state": "TX",
          "employmentType": "full_time",
          "shift": "first",
          "description": "Operate forklifts safely in a high-volume warehouse environment.",
          "sourceType": "scraped"
        },
        {
          "externalId": "phase4-demo-002",
          "title": "Batch Demo Picker Packer",
          "location": "Austin, TX",
          "city": "Austin",
          "state": "TX",
          "employmentType": "part_time",
          "shift": "second",
          "description": "Pick and pack customer orders accurately for same-day shipping.",
          "sourceType": "scraped"
        }
      ]
    }')"
  echo "  POST /api/v1/jobs/batch (sync, 2 jobs) → ${SYNC_CODE}"
  if [[ "$SYNC_CODE" == "404" ]]; then
    echo "  Batch route not found — restart API: bun run api:dev (picks up Phase 4 routes)"
    if [[ "$LIVE" == true ]]; then
      fail "sync batch expected 200, got 404 (restart API with latest code)"
    fi
    ok "live batch smoke skipped (stale API process; E2E covers batch routes)"
  else
  [[ "$SYNC_CODE" == "200" ]] || fail "sync batch expected 200, got ${SYNC_CODE}"

  BATCH_ID="$(bun -e 'const j=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")); process.stdout.write(j.batchId)' "$SYNC_OUT")"
  CREATED="$(bun -e 'const j=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")); process.stdout.write(String(j.created))' "$SYNC_OUT")"
  rm -f "$SYNC_OUT"
  [[ -n "$BATCH_ID" ]] || fail "sync batch missing batchId"
  echo "  batchId=${BATCH_ID} created=${CREATED}"

  STATUS_CODE="$(http_code "${API_BASE}/api/v1/jobs/batch/${BATCH_ID}/status" -H "X-Api-Key: ${DEMO_API_KEY}")"
  echo "  GET /api/v1/jobs/batch/${BATCH_ID}/status → ${STATUS_CODE}"
  [[ "$STATUS_CODE" == "200" ]] || fail "batch status expected 200"

  DEDUP_CODE="$(http_code -X POST "${API_BASE}/api/v1/jobs/batch" \
    -H "X-Api-Key: ${DEMO_API_KEY}" \
    -H 'Content-Type: application/json' \
    -d '{
      "jobs": [{
        "externalId": "phase4-demo-001",
        "title": "Batch Demo Forklift Operator",
        "location": "Dallas, TX",
        "employmentType": "full_time",
        "shift": "first",
        "description": "Operate forklifts safely in a high-volume warehouse environment.",
        "sourceType": "scraped"
      }]
    }')"
  echo "  POST dedup re-run (same externalId) → ${DEDUP_CODE}"
  [[ "$DEDUP_CODE" == "200" ]] || fail "dedup batch expected 200"

  ASYNC_OUT="$(mktemp)"
  ASYNC_JOBS="$(bun -e "
const items = Array.from({ length: 101 }, (_, i) => ({
  externalId: 'phase4-async-' + (i + 1),
  title: 'Async Batch Job ' + (i + 1),
  location: 'Houston, TX',
  city: 'Houston',
  state: 'TX',
  employmentType: 'full_time',
  shift: 'first',
  description: 'Warehouse associate role for async batch demo validation run.',
  sourceType: 'scraped',
}));
process.stdout.write(JSON.stringify({ jobs: items }));
")"
  ASYNC_CODE="$(curl -s -o "$ASYNC_OUT" -w "%{http_code}" -X POST "${API_BASE}/api/v1/jobs/batch" \
    -H "X-Api-Key: ${DEMO_API_KEY}" \
    -H 'Content-Type: application/json' \
    -d "$ASYNC_JOBS")"
  echo "  POST /api/v1/jobs/batch (async, 101 jobs) → ${ASYNC_CODE}"
  [[ "$ASYNC_CODE" == "202" ]] || fail "async batch expected 202, got ${ASYNC_CODE}"

  ASYNC_BATCH_ID="$(bun -e 'const j=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")); process.stdout.write(j.batchId)' "$ASYNC_OUT")"
  rm -f "$ASYNC_OUT"
  [[ -n "$ASYNC_BATCH_ID" ]] || fail "async batch missing batchId"

  echo "  Polling async batch status (up to 30s)..."
  FINAL_STATUS=""
  LAST_POLL_BODY=""
  for i in $(seq 1 15); do
    LAST_POLL_BODY="$(curl -sf "${API_BASE}/api/v1/jobs/batch/${ASYNC_BATCH_ID}/status" -H "X-Api-Key: ${DEMO_API_KEY}")"
    FINAL_STATUS="$(echo "$LAST_POLL_BODY" | sed -n 's/.*"status":"\([^"]*\)".*/\1/p')"
    echo "    poll ${i}: status=${FINAL_STATUS}"
    [[ "$FINAL_STATUS" == "completed" || "$FINAL_STATUS" == "failed" ]] && break
    sleep 2
  done
  if [[ "$FINAL_STATUS" != "completed" ]]; then
    echo "  Async batch errors:"
    echo "$LAST_POLL_BODY" | bun -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{try{const j=JSON.parse(s);console.log(JSON.stringify({status:j.status,created:j.created,failed:j.failed,errors:(j.errors||[]).slice(0,5)},null,2))}catch{console.log(s)}})' 2>/dev/null || echo "$LAST_POLL_BODY"
    fail "async batch did not complete (status=${FINAL_STATUS})"
  fi

  SEARCH_CODE="$(http_code "${API_BASE}/api/v1/jobs?city=Dallas&state=TX")"
  echo "  GET /api/v1/jobs?city=Dallas (includes batch jobs) → ${SEARCH_CODE}"
  [[ "$SEARCH_CODE" == "200" ]] || fail "jobs search expected 200"

  ok "live batch smoke complete"
  fi
elif [[ "$LIVE" == true ]]; then
  fail "API not running on ${API_BASE} — start with: bun run api:dev"
else
  echo "  API not running — skipping live curl (covered by E2E). Use --live to require."
fi

step "12. Frontend validation (FE-3 / FE-4 inventory + live smoke)"
FE_VALIDATE_ARGS=()
[[ "$LIVE" == true ]] && FE_VALIDATE_ARGS+=(--live)
bash scripts/validate-phase4-frontend.sh "${FE_VALIDATE_ARGS[@]}"
ok "frontend validation (see above for FE-3/FE-4 pending vs passed)"

echo ""
echo -e "${GREEN}${BOLD}Phase 4 demo complete.${RESET}"
echo "See docs/demo/phase4-demo.md for Postman, curl, Swagger UI, and browser validation steps."
echo "After FE-3/FE-4 land, re-run with: ./scripts/validate-phase4-frontend.sh --require-fe3 --require-fe4 --live"
