#!/usr/bin/env bash
# Phase 4 frontend validation — FE-3 (jobs API) + FE-4 (batch diagnostics panel).
#
# Usage:
#   ./scripts/validate-phase4-frontend.sh              # inventory + optional live smoke
#   ./scripts/validate-phase4-frontend.sh --live     # fail if frontend dev server unreachable
#   ./scripts/validate-phase4-frontend.sh --require-fe3 --require-fe4  # gate after tasks land
#
# Markers (implementers — keep in sync with docs/demo/phase4-demo.md):
#   FE-3: src/routes/jobs.tsx imports @/lib/api-client (not supabase for job search)
#         data-testid="jobs-from-api" on /jobs root element
#   FE-4: apiClient.submitBatch + getBatchStatus in src/lib/api-client.ts
#         data-testid="batch-ingest-panel" on /dev/diagnostics batch panel
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REQUIRE_FE3=false
REQUIRE_FE4=false
LIVE=false
BATCH_TITLE="${PHASE4_BATCH_JOB_TITLE:-Batch Demo Forklift Operator}"

for arg in "$@"; do
  case "$arg" in
    --require-fe3) REQUIRE_FE3=true ;;
    --require-fe4) REQUIRE_FE4=true ;;
    --live) LIVE=true ;;
  esac
done

FE_BASE="${FRONTEND_BASE_URL:-http://localhost:8080}"
API_BASE="${API_BASE_URL:-http://localhost:3001}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

PASS=0
PENDING=0
FAIL=0

pass() { echo -e "  ${GREEN}✓${RESET} $1"; PASS=$((PASS + 1)); }
pending() { echo -e "  ${YELLOW}○${RESET} $1 (pending — FE task not complete)"; PENDING=$((PENDING + 1)); }
fail() { echo -e "  ${RED}✗${RESET} $1"; FAIL=$((FAIL + 1)); }

file_contains() {
  grep -q "$2" "$1" 2>/dev/null
}

echo -e "${BOLD}${CYAN}Frontend validation — Phase 4 (FE-3 / FE-4)${RESET}"

# ── Baseline (Phase 2 diagnostics surface) ───────────────────────────────────

echo -e "\n${BOLD}Baseline${RESET} — auth + diagnostics scaffolding"

if [[ -f .env ]] && grep -q '^VITE_API_BASE_URL=' .env; then
  pass "VITE_API_BASE_URL set in root .env"
else
  fail "VITE_API_BASE_URL missing from root .env"
fi

if [[ -f src/routes/dev.diagnostics.tsx ]] && file_contains src/routes/dev.diagnostics.tsx 'apiClient'; then
  pass "dev.diagnostics route uses apiClient"
else
  fail "dev.diagnostics route missing or not wired to apiClient"
fi

if [[ -f src/lib/api-client.ts ]] && file_contains src/lib/api-client.ts 'health():' && file_contains src/lib/api-client.ts 'me(token'; then
  pass "api-client exposes health + me (Phase 2)"
else
  fail "api-client missing health() or me()"
fi

if [[ -f src/hooks/use-api-health.ts ]]; then
  pass "use-api-health hook present"
else
  fail "use-api-health hook missing"
fi

# ── FE-3 — Jobs board on Nest API ────────────────────────────────────────────

echo -e "\n${BOLD}FE-3${RESET} — public job board uses NestJS API"

FE3_COMPLETE=true

if file_contains src/routes/jobs.tsx '@/integrations/supabase/client'; then
  FE3_COMPLETE=false
  if [[ "$REQUIRE_FE3" == true ]]; then
    fail "jobs.tsx still imports Supabase (FE-3 incomplete)"
  else
    pending "jobs.tsx still uses Supabase — wire to GET /api/v1/jobs"
  fi
else
  pass "jobs.tsx does not import Supabase client"
fi

if grep -qE 'searchJobs|getJobs|listJobs' src/lib/api-client.ts 2>/dev/null; then
  pass "api-client exposes jobs search/list methods"
elif [[ "$FE3_COMPLETE" == false ]]; then
  pending "api-client jobs methods not added yet"
else
  if [[ "$REQUIRE_FE3" == true ]]; then
    fail "api-client missing jobs search/list methods"
  else
    pending "api-client jobs methods not added yet"
  fi
  FE3_COMPLETE=false
fi

if file_contains src/routes/jobs.tsx 'data-testid="jobs-from-api"'; then
  pass "jobs route has data-testid=jobs-from-api marker"
elif [[ "$FE3_COMPLETE" == true ]]; then
  if [[ "$REQUIRE_FE3" == true ]]; then
    fail "jobs route missing data-testid=jobs-from-api (see phase4-demo.md)"
  else
    pending "jobs route missing data-testid=jobs-from-api marker"
  fi
fi

# ── FE-4 — Batch diagnostics panel ───────────────────────────────────────────

echo -e "\n${BOLD}FE-4${RESET} — batch ingest dev panel on /dev/diagnostics"

FE4_COMPLETE=true

if file_contains src/lib/api-client.ts 'submitBatch' && file_contains src/lib/api-client.ts 'getBatchStatus'; then
  pass "api-client exposes submitBatch + getBatchStatus"
else
  FE4_COMPLETE=false
  if [[ "$REQUIRE_FE4" == true ]]; then
    fail "api-client missing submitBatch/getBatchStatus (FE-4 incomplete)"
  else
    pending "api-client batch methods not added yet"
  fi
fi

if file_contains src/routes/dev.diagnostics.tsx 'data-testid="batch-ingest-panel"'; then
  pass "diagnostics has data-testid=batch-ingest-panel"
elif file_contains src/routes/dev.diagnostics.tsx 'Batch Ingest' || \
     file_contains src/routes/dev.diagnostics.tsx 'BatchPanel' || \
     file_contains src/routes/dev.diagnostics.tsx 'batch-ingest'; then
  pass "diagnostics batch panel UI present (informal marker)"
else
  FE4_COMPLETE=false
  if [[ "$REQUIRE_FE4" == true ]]; then
    fail "dev.diagnostics missing batch ingest panel (FE-4 incomplete)"
  else
    pending "dev.diagnostics batch panel not built yet"
  fi
fi

# ── Live frontend smoke (dev server) ───────────────────────────────────────

echo -e "\n${BOLD}Live smoke${RESET} — frontend at ${FE_BASE}"

if curl -sf "${FE_BASE}/dev/diagnostics" >/dev/null 2>&1; then
  DIAG_HTML="$(curl -sf "${FE_BASE}/dev/diagnostics" | tr -d '\0')"

  if echo "$DIAG_HTML" | grep -q 'API Diagnostics'; then
    pass "GET /dev/diagnostics renders API Diagnostics page"
  else
    fail "GET /dev/diagnostics did not contain expected page title"
  fi

  if echo "$DIAG_HTML" | grep -q 'GET /api/health'; then
    pass "diagnostics page references GET /api/health panel"
  else
    fail "diagnostics page missing health panel marker"
  fi

  if echo "$DIAG_HTML" | grep -qE 'data-testid="batch-ingest-panel"|Batch Ingest'; then
    pass "diagnostics page includes batch ingest panel (FE-4 live)"
  elif [[ "$REQUIRE_FE4" == true ]]; then
    fail "diagnostics HTML missing batch panel (FE-4)"
  else
    pending "diagnostics HTML — batch panel not present yet (FE-4)"
  fi

  JOBS_CODE="$(curl -s -o /dev/null -w "%{http_code}" "${FE_BASE}/jobs" 2>/dev/null || echo "000")"
  if [[ "$JOBS_CODE" == "200" ]]; then
    JOBS_HTML="$(curl -sf "${FE_BASE}/jobs" | tr -d '\0')"
    if echo "$JOBS_HTML" | grep -q 'data-testid="jobs-from-api"'; then
      pass "GET /jobs has jobs-from-api marker (FE-3 live)"
      if curl -sf "${API_BASE}/api/health" >/dev/null 2>&1; then
        if curl -sf "${API_BASE}/api/v1/jobs?pageSize=50" | grep -q "$BATCH_TITLE"; then
          if echo "$JOBS_HTML" | grep -q "$BATCH_TITLE"; then
            pass "batch-ingested job visible on /jobs (API ↔ browser cross-check)"
          elif [[ "$REQUIRE_FE3" == true ]]; then
            fail "/jobs HTML missing batch job title \"${BATCH_TITLE}\" (ingest via API first)"
          else
            pending "/jobs does not yet show batch job \"${BATCH_TITLE}\" (complete FE-3 + run batch ingest)"
          fi
        else
          echo -e "  ${CYAN}i${RESET} No batch job \"${BATCH_TITLE}\" in API — run Part B curl or demo step 11 first"
        fi
      fi
    elif echo "$JOBS_HTML" | grep -qE 'supabase|search_jobs'; then
      pending "/jobs still SSR/CSR via Supabase (FE-3)"
    else
      pending "/jobs missing jobs-from-api marker (FE-3)"
    fi
  elif [[ "$REQUIRE_FE3" == true ]]; then
    fail "GET /jobs returned ${JOBS_CODE}"
  else
    pending "GET /jobs returned ${JOBS_CODE} — FE-3 live checks skipped"
  fi
elif [[ "$LIVE" == true ]]; then
  fail "Frontend not reachable at ${FE_BASE} — start with: bun run dev"
else
  echo -e "  ${CYAN}i${RESET} Frontend not running — skipping live HTML checks (start: bun run dev)"
fi

# ── Summary ──────────────────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}Summary:${RESET} ${GREEN}${PASS} passed${RESET}, ${YELLOW}${PENDING} pending${RESET}, ${RED}${FAIL} failed${RESET}"

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
exit 0
