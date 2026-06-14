#!/usr/bin/env bash
# Run committed Postman collection against a live API (CI or local).
# Requires API listening on POSTMAN_API_BASE (default http://localhost:3001).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

API_BASE="${POSTMAN_API_BASE:-http://localhost:3001}"
COLLECTION="src/api/postman/warehousejobs.postman_collection.json"
ENV_FILE="src/api/postman/warehousejobs.postman_environment.json"
TEST_EMAIL="${POSTMAN_TEST_EMAIL:-postman-ci-${GITHUB_RUN_ID:-local}@warehousejobs.test}"
TEST_PASSWORD="${POSTMAN_TEST_PASSWORD:-Test1234!}"
PGHOST="${POSTMAN_PG_HOST:-localhost}"
PGUSER="${POSTMAN_PG_USER:-wj_user}"
PGPASSWORD="${POSTMAN_PG_PASSWORD:-wj_dev_password}"
PGDATABASE="${POSTMAN_PG_DATABASE:-warehousejobs_postman}"

export PGPASSWORD

step() { echo "==> $1"; }

wait_for_api() {
  step "Waiting for API at ${API_BASE}/api/health"
  for i in $(seq 1 60); do
    if curl -sf "${API_BASE}/api/health" >/dev/null 2>&1; then
      echo "API ready (attempt $i)"
      return 0
    fi
    sleep 2
  done
  echo "API did not become ready on ${API_BASE}"
  return 1
}

run_newman() {
  local folder="$1"
  shift
  npx --yes newman run "$COLLECTION" \
    -e "$ENV_FILE" \
    --folder "$folder" \
    --env-var "baseUrl=${API_BASE}" \
    --env-var "testEmail=${TEST_EMAIL}" \
    --env-var "testPassword=${TEST_PASSWORD}" \
    "$@"
}

psql_query() {
  psql -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" -t -A -c "$1" | tr -d '[:space:]'
}

wait_for_api

step "Newman: System (Phase 1 health)"
run_newman "System"

step "Newman: Auth — Core (GET /me without token → 401)"
run_newman "Auth — Core"

step "Auth smoke: register → verify → login → me → refresh → logout"
REGISTER_CODE="$(curl -s -o /dev/null -w "%{http_code}" -X POST "${API_BASE}/api/v1/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\",\"role\":\"seeker\",\"fullName\":\"Postman CI\"}")"
[[ "$REGISTER_CODE" == "201" ]] || { echo "register failed: ${REGISTER_CODE}"; exit 1; }

VERIFY_TOKEN="$(psql_query "SELECT ev.token FROM email_verifications ev JOIN users u ON u.id = ev.user_id WHERE u.email = '${TEST_EMAIL}' LIMIT 1;")"
[[ -n "$VERIFY_TOKEN" ]] || { echo "verification token not found in DB"; exit 1; }

curl -sf -X POST "${API_BASE}/api/v1/auth/verify-email" \
  -H 'Content-Type: application/json' \
  -d "{\"token\":\"${VERIFY_TOKEN}\"}" >/dev/null

LOGIN_BODY="$(curl -sf -X POST "${API_BASE}/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\"}")"

REFRESH_TOKEN="$(echo "$LOGIN_BODY" | sed -n 's/.*"refreshToken":"\([^"]*\)".*/\1/')"
ACCESS_TOKEN="$(echo "$LOGIN_BODY" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/')"
[[ -n "$ACCESS_TOKEN" ]] || { echo "login missing accessToken"; exit 1; }

curl -sf "${API_BASE}/api/v1/me" -H "Authorization: Bearer ${ACCESS_TOKEN}" >/dev/null

REFRESH_BODY="$(curl -sf -X POST "${API_BASE}/api/v1/auth/refresh" \
  -H 'Content-Type: application/json' \
  -d "{\"refreshToken\":\"${REFRESH_TOKEN}\"}")"
NEW_ACCESS="$(echo "$REFRESH_BODY" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/')"

curl -sf -o /dev/null -w "%{http_code}" -X POST "${API_BASE}/api/v1/auth/logout" \
  -H "Authorization: Bearer ${NEW_ACCESS}" | grep -qx 204

step "Forgot / reset password smoke"
curl -sf -X POST "${API_BASE}/api/v1/auth/forgot-password" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${TEST_EMAIL}\"}" >/dev/null

RESET_TOKEN="$(psql_query "SELECT pr.token FROM password_resets pr JOIN users u ON u.id = pr.user_id WHERE u.email = '${TEST_EMAIL}' ORDER BY pr.created_at DESC LIMIT 1;")"
[[ -n "$RESET_TOKEN" ]] || { echo "reset token not found"; exit 1; }

curl -sf -X POST "${API_BASE}/api/v1/auth/reset-password" \
  -H 'Content-Type: application/json' \
  -d "{\"token\":\"${RESET_TOKEN}\",\"password\":\"NewSecure2!\"}" >/dev/null

curl -sf -X POST "${API_BASE}/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"NewSecure2!\"}" >/dev/null

step "Newman: Jobs (Phase 3) — expect 404"
run_newman "Jobs (Phase 3)"

echo "Postman CI smoke complete."
