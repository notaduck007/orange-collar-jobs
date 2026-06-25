#!/usr/bin/env bash
# Phase 4.5 quality gate demo — Notifications domain (inbox, OTP, webhooks, campaigns).
# Usage: ./scripts/phase4.5-demo.sh [--skip-docker] [--skip-integration] [--live]
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
FE_BASE="${FRONTEND_BASE_URL:-http://localhost:8080}"

step() { echo -e "\n${BOLD}${CYAN}==>${RESET} $1"; }
ok() { echo -e "${GREEN}✓${RESET} $1"; }
fail() { echo -e "${RED}✗${RESET} $1"; exit 1; }
http_code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }

step "1. Environment (root .env only)"
bash scripts/setup-env.sh
ok "Root .env present"

step "2. Install dependencies"
bun install --frozen-lockfile
ok "bun install"

if [[ "$SKIP_DOCKER" == false ]]; then
  step "3. Docker Compose data stores"
  docker compose up -d postgres redis minio
  for i in $(seq 1 30); do
    if docker compose exec -T postgres pg_isready -U wj_user -d warehousejobs >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
  ok "postgres + redis ready"
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
bun run api:postman:check
ok "API static gates (lint + types + openapi + contract guard + Postman in sync)"

step "6. Unit tests + coverage (≥ 90% global)"
bun run api:test:cov
ok "unit tests + coverage"

if [[ "$SKIP_INTEGRATION" == false ]]; then
  step "7. Integration tests (notifications + prior phases)"
  bun run api:test:integration
  ok "integration tests"
else
  step "7. Integration tests (skipped)"
fi

step "8. E2E (notifications + phase1-backwards-compat)"
bun run api:test:e2e
ok "e2e tests"

step "9. Phase 1 backwards-compat smoke (live API)"
if curl -sf "${API_BASE}/api/health" >/dev/null 2>&1; then
  ME_CODE="$(http_code "${API_BASE}/api/v1/me")"
  [[ "$ME_CODE" == "401" ]] || fail "Phase 1 /me without token expected 401, got ${ME_CODE}"
  NOTIF_CODE="$(http_code "${API_BASE}/api/v1/notifications")"
  [[ "$NOTIF_CODE" == "401" ]] || fail "notifications without token expected 401, got ${NOTIF_CODE}"
  ok "Phase 1 + notifications auth guards"
else
  echo "  API not running — live smoke skipped (covered by E2E)"
fi

step "10. API build"
bun run api:build
ok "nest build"

step "11. Frontend build + FE-4.5 inventory"
bun run build
ok "vite build"

file_contains() { grep -q "$2" "$1" 2>/dev/null; }
file_contains src/lib/api-client.ts 'listNotifications' && ok "api-client exposes notifications (FE-4.5)" || fail "api-client missing notifications"
file_contains src/routes/seeker.notifications.tsx 'notifications-inbox' && ok "seeker inbox route (FE-4.5)" || fail "seeker notifications route missing"
file_contains src/components/dev/notifications-diagnostics-panel.tsx 'notifications-diagnostics-panel' && ok "diagnostics panel (FE-4.5)" || fail "notifications diagnostics missing"

step "12. Live frontend smoke (optional)"
if [[ "$LIVE" == true ]]; then
  curl -sf "${FE_BASE}/" >/dev/null || fail "Frontend not running on ${FE_BASE}"
  curl -sf "${FE_BASE}/dev/diagnostics" | grep -q 'notifications-diagnostics-panel' || fail "Diagnostics page missing notifications panel"
  ok "live frontend smoke"
else
  echo "  Use --live to require frontend on ${FE_BASE}"
fi

echo ""
echo -e "${GREEN}${BOLD}Phase 4.5 demo complete.${RESET}"
echo "See docs/demo/phase4.5-demo.md for Postman webhooks, inbox browser steps, and campaign walkthrough."
