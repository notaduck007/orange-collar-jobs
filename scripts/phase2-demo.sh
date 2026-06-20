#!/usr/bin/env bash
# Phase 2 quality gate demo — auth domain (JWT register/login/verify/reset).
# Usage: ./scripts/phase2.sh [--skip-docker] [--skip-integration] [--live]
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
DEMO_EMAIL="phase2-demo-$(date +%s)@warehousejobs.test"
DEMO_PASSWORD="SecureP@ss1"

step() { echo -e "\n${BOLD}${CYAN}==>${RESET} $1"; }
ok() { echo -e "${GREEN}✓${RESET} $1"; }
fail() { echo -e "${RED}✗${RESET} $1"; exit 1; }
http_code() {
  curl -s -o /dev/null -w "%{http_code}" "$@"
}

step "1. Environment (root .env only)"
bash scripts/setup-env.sh
if [[ -f src/api/.env ]]; then
  echo "  Warning: src/api/.env still exists — use root .env only (see docs/agent/standards/common/monorepo.md)"
fi
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
  ok "postgres + redis + minio + buckets ready"
else
  step "3. Docker (skipped — assume data stores already running)"
fi

step "4. Prisma migrations"
bun run api:migrate:dev
ok "migrations applied"

step "5. API lint + type-check + OpenAPI validate"
bun run api:lint
bun run api:type-check
bun run api:validate
ok "lint + type-check + openapi"

step "6. Unit tests + coverage (≥ 90% global)"
bun run api:test:cov
if [[ -f src/api/coverage/lcov.info ]]; then
  AUTH_COV="$(grep -A1 'auth.service.ts' src/api/coverage/lcov.info 2>/dev/null | tail -1 || true)"
  if [[ -n "$AUTH_COV" ]]; then
    echo "  auth.service.ts lcov: $AUTH_COV"
  fi
fi
ok "unit tests + coverage"

if [[ "$SKIP_INTEGRATION" == false ]]; then
  step "7. Integration tests (auth flow + health)"
  bun run api:test:integration
  ok "integration tests"
else
  step "7. Integration tests (skipped)"
fi

step "8. E2E (auth + Phase 1 backwards compat + health + /me)"
bun run api:test:e2e
ok "e2e tests"

step "9. Phase 1 backwards-compat smoke (live API)"
if curl -sf "${API_BASE}/api/health" >/dev/null 2>&1; then
  HEALTH="$(curl -s "${API_BASE}/api/health")"
  echo "  GET /api/health → $(echo "$HEALTH" | sed -n 's/.*"status":"\([^"]*\)".*/\1/p')"
  ME_CODE="$(http_code "${API_BASE}/api/v1/me")"
  echo "  GET /api/v1/me (no token) → ${ME_CODE}"
  [[ "$ME_CODE" == "401" ]] || fail "Phase 1 /me without token expected 401, got ${ME_CODE}"
  ok "Phase 1 endpoints still compatible"
else
  echo "  API not running — Phase 1 live smoke skipped (covered by E2E)"
fi

step "10. API build"
bun run api:build
ok "nest build"

step "11. Live auth smoke (API on :3001)"
if curl -sf "${API_BASE}/api/health" >/dev/null 2>&1; then
  echo "  API reachable at ${API_BASE}"

  REG_CODE="$(http_code -X POST "${API_BASE}/api/v1/auth/register" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"${DEMO_EMAIL}\",\"password\":\"${DEMO_PASSWORD}\",\"role\":\"seeker\",\"fullName\":\"Phase 2 Demo\"}")"
  echo "  POST /api/v1/auth/register → ${REG_CODE}"
  [[ "$REG_CODE" == "201" ]] || fail "register expected 201, got ${REG_CODE}"

  LOGIN_UNVERIFIED="$(http_code -X POST "${API_BASE}/api/v1/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"${DEMO_EMAIL}\",\"password\":\"${DEMO_PASSWORD}\"}")"
  echo "  POST /api/v1/auth/login (unverified) → ${LOGIN_UNVERIFIED}"
  [[ "$LOGIN_UNVERIFIED" == "401" ]] || fail "unverified login expected 401, got ${LOGIN_UNVERIFIED}"

  VERIFY_TOKEN="$(docker compose exec -T postgres psql -U wj_user -d warehousejobs -t -A \
    -c "SELECT ev.token FROM email_verifications ev JOIN users u ON u.id = ev.user_id WHERE u.email = '${DEMO_EMAIL}' LIMIT 1;" 2>/dev/null | tr -d '[:space:]')"

  if [[ -z "$VERIFY_TOKEN" ]]; then
    echo "  Could not read verification token from DB — check API logs for [DEV EMAIL] link"
  else
    VERIFY_CODE="$(http_code -X POST "${API_BASE}/api/v1/auth/verify-email" \
      -H 'Content-Type: application/json' \
      -d "{\"token\":\"${VERIFY_TOKEN}\"}")"
    echo "  POST /api/v1/auth/verify-email → ${VERIFY_CODE}"
    [[ "$VERIFY_CODE" == "200" ]] || fail "verify-email expected 200, got ${VERIFY_CODE}"
  fi

  LOGIN_BODY="$(curl -sf -X POST "${API_BASE}/api/v1/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"${DEMO_EMAIL}\",\"password\":\"${DEMO_PASSWORD}\"}")"
  ACCESS_TOKEN="$(echo "$LOGIN_BODY" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')"
  REFRESH_TOKEN="$(echo "$LOGIN_BODY" | sed -n 's/.*"refreshToken":"\([^"]*\)".*/\1/p')"
  [[ -n "$ACCESS_TOKEN" ]] || fail "login did not return accessToken"
  echo "  POST /api/v1/auth/login (verified) → 200"

  ME_CODE="$(http_code "${API_BASE}/api/v1/me" -H "Authorization: Bearer ${ACCESS_TOKEN}")"
  echo "  GET /api/v1/me → ${ME_CODE}"
  [[ "$ME_CODE" == "200" ]] || fail "/me expected 200, got ${ME_CODE}"

  REFRESH_CODE="$(http_code -X POST "${API_BASE}/api/v1/auth/refresh" \
    -H 'Content-Type: application/json' \
    -d "{\"refreshToken\":\"${REFRESH_TOKEN}\"}")"
  echo "  POST /api/v1/auth/refresh → ${REFRESH_CODE}"
  [[ "$REFRESH_CODE" == "200" ]] || fail "refresh expected 200, got ${REFRESH_CODE}"

  LOGOUT_CODE="$(http_code -X POST "${API_BASE}/api/v1/auth/logout" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}")"
  echo "  POST /api/v1/auth/logout → ${LOGOUT_CODE}"
  [[ "$LOGOUT_CODE" == "204" ]] || fail "logout expected 204, got ${LOGOUT_CODE}"

  FORGOT_CODE="$(http_code -X POST "${API_BASE}/api/v1/auth/forgot-password" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"${DEMO_EMAIL}\"}")"
  echo "  POST /api/v1/auth/forgot-password → ${FORGOT_CODE}"
  [[ "$FORGOT_CODE" == "200" ]] || fail "forgot-password expected 200, got ${FORGOT_CODE}"

  ok "live auth smoke (${DEMO_EMAIL})"
elif [[ "$LIVE" == true ]]; then
  fail "API not running on ${API_BASE} — start with: bun run api:dev"
else
  echo "  API not running on ${API_BASE} — start with: bun run api:dev"
  echo "  Skipping live auth curl (E2E tests above already cover endpoints)."
  echo "  Re-run with --live to require a running API for step 10."
fi

echo ""
echo -e "${GREEN}${BOLD}Phase 2 demo complete.${RESET}"
echo "See docs/demo/phase2-demo.md for narrative walkthrough and frontend auth flows."
