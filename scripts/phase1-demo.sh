#!/usr/bin/env bash
# Phase 1 quality gate demo — runs the same checks as docs/plan.md Phase 1 gate.
# Usage: ./scripts/phase1-demo.sh [--skip-docker] [--skip-integration]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SKIP_DOCKER=false
SKIP_INTEGRATION=false
for arg in "$@"; do
  case "$arg" in
    --skip-docker) SKIP_DOCKER=true ;;
    --skip-integration) SKIP_INTEGRATION=true ;;
  esac
done

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

step() { echo -e "\n${BOLD}${CYAN}==>${RESET} $1"; }
ok() { echo -e "${GREEN}✓${RESET} $1"; }
fail() { echo -e "${RED}✗${RESET} $1"; exit 1; }

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

step "5. API lint + type-check"
bun run api:lint
bun run api:type-check
ok "lint + type-check"

step "6. Unit tests + coverage (≥ 90%)"
bun run api:test:cov
ok "unit tests + coverage"

if [[ "$SKIP_INTEGRATION" == false ]]; then
  step "7. Integration tests (real DB + Redis + MinIO)"
  bun run api:test:integration
  ok "integration tests"
else
  step "7. Integration tests (skipped)"
fi

step "8. E2E smoke"
bun run api:test:e2e
ok "e2e tests"

step "9. API build"
bun run api:build
ok "nest build"

step "10. Health endpoint (API must be running for this — start with: bun run api:dev)"
if curl -sf http://localhost:3001/api/health >/dev/null 2>&1; then
  BODY="$(curl -s http://localhost:3001/api/health)"
  echo "  $BODY"
  ok "GET /api/health → 200"
else
  echo "  API not running on :3001 — start with: bun run api:dev"
  echo "  Skipping live health curl (tests above already cover wiring)."
fi

echo ""
echo -e "${GREEN}${BOLD}Phase 1 demo complete.${RESET}"
echo "See docs/demo/phase1-demo.md for narrative walkthrough."
