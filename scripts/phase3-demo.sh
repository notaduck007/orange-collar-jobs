#!/usr/bin/env bash
# Phase 3 quality gate demo — Jobs domain (CRUD + search + contract guard).
# Usage: ./scripts/phase3-demo.sh [--skip-docker] [--skip-integration] [--live]
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
DEMO_EMAIL="phase3-demo-$(date +%s)@warehousejobs.test"
DEMO_PASSWORD="SecureP@ss1"

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

step "4. Prisma migrations"
bun run api:migrate:dev
ok "migrations applied"

step "5. Lint + type-check + API contract drift guard"
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
ok "lint + types + openapi + contract guard (in sync + fail-closed on drift)"

step "6. Unit tests + coverage (≥ 90% global)"
bun run api:test:cov
ok "unit tests + coverage"

if [[ "$SKIP_INTEGRATION" == false ]]; then
  step "7. Integration tests (jobs + api-contract + auth)"
  bun run api:test:integration
  ok "integration tests"
else
  step "7. Integration tests (skipped)"
fi

step "8. E2E (jobs + auth + api-contract + Phase 1 compat)"
bun run api:test:e2e
ok "e2e tests"

step "9. Phase 2 backwards-compat smoke (live API)"
if curl -sf "${API_BASE}/api/health" >/dev/null 2>&1; then
  HEALTH="$(curl -s "${API_BASE}/api/health")"
  echo "  GET /api/health → $(echo "$HEALTH" | sed -n 's/.*"status":"\([^"]*\)".*/\1/p')"
  ME_CODE="$(http_code "${API_BASE}/api/v1/me")"
  echo "  GET /api/v1/me (no token) → ${ME_CODE}"
  [[ "$ME_CODE" == "401" ]] || fail "Phase 1 /me without token expected 401, got ${ME_CODE}"
  ok "Phase 1 endpoints still compatible"
else
  echo "  API not running — backwards-compat live smoke skipped (covered by E2E)"
fi

step "10. API build"
bun run api:build
ok "nest build"

step "11. Live jobs smoke (API on :3001)"
if curl -sf "${API_BASE}/api/health" >/dev/null 2>&1; then
  echo "  API reachable at ${API_BASE}"

  # Register + verify admin-capable user (seeker for POST 403 test later)
  REG_CODE="$(http_code -X POST "${API_BASE}/api/v1/auth/register" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"${DEMO_EMAIL}\",\"password\":\"${DEMO_PASSWORD}\",\"role\":\"seeker\",\"fullName\":\"Phase 3 Demo\"}")"
  [[ "$REG_CODE" == "201" ]] || fail "register expected 201, got ${REG_CODE}"

  VERIFY_TOKEN="$(docker compose exec -T postgres psql -U wj_user -d warehousejobs -t -A \
    -c "SELECT ev.token FROM email_verifications ev JOIN users u ON u.id = ev.user_id WHERE u.email = '${DEMO_EMAIL}' LIMIT 1;" 2>/dev/null | tr -d '[:space:]')"
  if [[ -n "$VERIFY_TOKEN" ]]; then
    http_code -X POST "${API_BASE}/api/v1/auth/verify-email" \
      -H 'Content-Type: application/json' \
      -d "{\"token\":\"${VERIFY_TOKEN}\"}" | grep -q 200 || fail "verify-email failed"
  fi

  LOGIN_BODY="$(curl -sf -X POST "${API_BASE}/api/v1/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"${DEMO_EMAIL}\",\"password\":\"${DEMO_PASSWORD}\"}")"
  ACCESS_TOKEN="$(echo "$LOGIN_BODY" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')"
  [[ -n "$ACCESS_TOKEN" ]] || fail "login missing accessToken"

  LIST_CODE="$(http_code "${API_BASE}/api/v1/jobs")"
  echo "  GET /api/v1/jobs → ${LIST_CODE}"
  [[ "$LIST_CODE" == "200" ]] || fail "jobs list expected 200"

  SEEKER_POST="$(http_code -X POST "${API_BASE}/api/v1/jobs" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H 'Content-Type: application/json' \
    -d '{"title":"Test","category":"Forklift","location":"Dallas, TX","city":"Dallas","state":"TX","employmentType":"full_time","shift":"first","description":"Long enough description for validation."}')"
  echo "  POST /api/v1/jobs as seeker → ${SEEKER_POST}"
  [[ "$SEEKER_POST" == "403" ]] || fail "seeker post expected 403, got ${SEEKER_POST}"

  ADMIN_EMAIL="phase3-admin-${DEMO_EMAIL}"
  bun --env-file=.env run scripts/gen-dev-token.ts --role admin --email "$ADMIN_EMAIL" >/dev/null 2>&1 || true
  docker compose exec -T postgres psql -U wj_user -d warehousejobs -c \
    "UPDATE users SET email_verified_at = NOW() WHERE email = '${ADMIN_EMAIL}';" >/dev/null 2>&1 || true
  ADMIN_TOKEN="$(bun --env-file=.env run scripts/gen-dev-token.ts --role admin --email "$ADMIN_EMAIL" 2>/dev/null | grep -E '^eyJ' | head -1)"
  [[ -n "$ADMIN_TOKEN" ]] || fail "could not obtain admin JWT (run bun run dev:token)"

  COMPANY_ID="$(docker compose exec -T postgres psql -U wj_user -d warehousejobs -t -A \
    -c "SELECT id FROM companies ORDER BY created_at DESC LIMIT 1;" 2>/dev/null | tr -d '[:space:]')"
  if [[ -z "$COMPANY_ID" ]]; then
    COMPANY_ID="$(docker compose exec -T postgres psql -U wj_user -d warehousejobs -t -A \
      -c "INSERT INTO companies (id, owner_id, name, slug, created_at, updated_at) SELECT gen_random_uuid(), u.id, 'Phase3 Demo Co', 'phase3-demo-' || substr(u.id::text, 1, 8), NOW(), NOW() FROM users u WHERE u.email = '${ADMIN_EMAIL}' LIMIT 1 RETURNING id;" 2>/dev/null | tr -d '[:space:]')"
  fi
  [[ -n "$COMPANY_ID" ]] || fail "need a company row for admin job post"

  JOB_BODY='{
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
    "companyId": "'"${COMPANY_ID}"'"
  }'

  CREATE_OUT="$(mktemp)"
  CREATE_CODE="$(curl -s -o "$CREATE_OUT" -w "%{http_code}" -X POST "${API_BASE}/api/v1/jobs" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    -H 'Content-Type: application/json' \
    -d "$JOB_BODY")"
  echo "  POST /api/v1/jobs as admin → ${CREATE_CODE}"
  [[ "$CREATE_CODE" == "201" ]] || fail "admin create expected 201, got ${CREATE_CODE}"

  JOB_ID="$(bun -e 'const j=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")); process.stdout.write(j.id)' "$CREATE_OUT")"
  JOB_SLUG="$(bun -e 'const j=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")); process.stdout.write(j.slug)' "$CREATE_OUT")"
  rm -f "$CREATE_OUT"
  [[ -n "$JOB_ID" && -n "$JOB_SLUG" ]] || fail "create response missing id/slug"

  DETAIL_CODE="$(http_code "${API_BASE}/api/v1/jobs/${JOB_SLUG}")"
  echo "  GET /api/v1/jobs/${JOB_SLUG} → ${DETAIL_CODE}"
  [[ "$DETAIL_CODE" == "200" ]] || fail "job detail expected 200"

  PATCH_CODE="$(http_code -X PATCH "${API_BASE}/api/v1/jobs/${JOB_ID}" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    -H 'Content-Type: application/json' \
    -d '{"featured":true}')"
  echo "  PATCH /api/v1/jobs/${JOB_ID} → ${PATCH_CODE}"
  [[ "$PATCH_CODE" == "200" ]] || fail "patch expected 200"

  DELETE_CODE="$(http_code -X DELETE "${API_BASE}/api/v1/jobs/${JOB_ID}" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}")"
  echo "  DELETE /api/v1/jobs/${JOB_ID} → ${DELETE_CODE}"
  [[ "$DELETE_CODE" == "204" ]] || fail "delete expected 204"

  CLOSED_STATUS="$(docker compose exec -T postgres psql -U wj_user -d warehousejobs -t -A \
    -c "SELECT status FROM jobs WHERE id = '${JOB_ID}';" 2>/dev/null | tr -d '[:space:]')"
  echo "  DB status after soft delete → ${CLOSED_STATUS}"
  [[ "$CLOSED_STATUS" == "closed" ]] || fail "expected status closed, got ${CLOSED_STATUS}"

  ok "live jobs smoke complete"
elif [[ "$LIVE" == true ]]; then
  fail "API not running on ${API_BASE} — start with: bun run api:dev"
else
  echo "  API not running — skipping live curl (covered by E2E). Use --live to require."
fi

echo ""
echo -e "${GREEN}${BOLD}Phase 3 demo complete.${RESET}"
echo "See docs/demo/phase3-demo.md for Postman, Swagger UI, and browser validation steps."
