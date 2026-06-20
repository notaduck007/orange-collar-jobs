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
# Avoid `!` in default password — bash history expansion can break CI curl bodies.
TEST_PASSWORD="${POSTMAN_TEST_PASSWORD:-SecureP@ss1}"
PGHOST="${POSTMAN_PG_HOST:-localhost}"
PGPORT="${POSTMAN_PG_PORT:-5432}"
PGUSER="${POSTMAN_PG_USER:-wj_user}"
PGPASSWORD="${POSTMAN_PG_PASSWORD:-wj_dev_password}"
PGDATABASE="${POSTMAN_PG_DATABASE:-warehousejobs_postman}"
TMP_DIR="${TMPDIR:-/tmp}/wj-postman-$$"
mkdir -p "$TMP_DIR"

export PGPASSWORD

step() { echo "==> $1"; }

json_field() {
  local file="$1" key="$2"
  node -e "
    const fs = require('fs');
    const o = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
    const v = o[process.argv[2]];
    if (v == null || v === '') process.exit(1);
    process.stdout.write(String(v));
  " "$file" "$key"
}

curl_json() {
  local out="$1" code="$2" url="$3" extra_args=("${@:4}")
  local http
  http="$(curl -sS -o "$out" -w "%{http_code}" "$url" "${extra_args[@]}")"
  printf -v "$code" '%s' "$http"
}

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
  psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -t -A -c "$1" | tr -d '[:space:]'
}

wait_for_api

step "Newman: System (Phase 1 health)"
run_newman "System"

step "Newman: Auth — Core (GET /me without token → 401)"
run_newman "Auth — Core"

step "Auth smoke: register → verify → login → me → refresh → logout"
REGISTER_BODY="$TMP_DIR/register.json"
REGISTER_CODE=""
curl_json "$REGISTER_BODY" REGISTER_CODE "${API_BASE}/api/v1/auth/register" \
  -X POST -H 'Content-Type: application/json' \
  -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\",\"role\":\"seeker\",\"fullName\":\"Postman CI\"}"
[[ "$REGISTER_CODE" == "201" ]] || {
  echo "register failed: HTTP ${REGISTER_CODE}"
  cat "$REGISTER_BODY"
  exit 1
}

VERIFY_TOKEN="$(psql_query "SELECT ev.token FROM email_verifications ev JOIN users u ON u.id = ev.user_id WHERE u.email = '${TEST_EMAIL}' LIMIT 1;")"
[[ -n "$VERIFY_TOKEN" ]] || { echo "verification token not found in DB"; exit 1; }

VERIFY_BODY="$TMP_DIR/verify.json"
VERIFY_CODE=""
curl_json "$VERIFY_BODY" VERIFY_CODE "${API_BASE}/api/v1/auth/verify-email" \
  -X POST -H 'Content-Type: application/json' \
  -d "{\"token\":\"${VERIFY_TOKEN}\"}"
[[ "$VERIFY_CODE" == "200" ]] || {
  echo "verify-email failed: HTTP ${VERIFY_CODE}"
  cat "$VERIFY_BODY"
  exit 1
}

LOGIN_BODY="$TMP_DIR/login.json"
LOGIN_CODE=""
curl_json "$LOGIN_BODY" LOGIN_CODE "${API_BASE}/api/v1/auth/login" \
  -X POST -H 'Content-Type: application/json' \
  -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\"}"
[[ "$LOGIN_CODE" == "200" ]] || {
  echo "login failed: HTTP ${LOGIN_CODE}"
  cat "$LOGIN_BODY"
  exit 1
}

ACCESS_TOKEN="$(json_field "$LOGIN_BODY" accessToken)" || {
  echo "login missing accessToken in response:"
  cat "$LOGIN_BODY"
  exit 1
}
REFRESH_TOKEN="$(json_field "$LOGIN_BODY" refreshToken)" || {
  echo "login missing refreshToken in response:"
  cat "$LOGIN_BODY"
  exit 1
}

curl -sf "${API_BASE}/api/v1/me" -H "Authorization: Bearer ${ACCESS_TOKEN}" >/dev/null

REFRESH_BODY="$TMP_DIR/refresh.json"
REFRESH_CODE=""
curl_json "$REFRESH_BODY" REFRESH_CODE "${API_BASE}/api/v1/auth/refresh" \
  -X POST -H 'Content-Type: application/json' \
  -d "{\"refreshToken\":\"${REFRESH_TOKEN}\"}"
[[ "$REFRESH_CODE" == "200" ]] || {
  echo "refresh failed: HTTP ${REFRESH_CODE}"
  cat "$REFRESH_BODY"
  exit 1
}
NEW_ACCESS="$(json_field "$REFRESH_BODY" accessToken)"

LOGOUT_CODE=""
curl_json "$TMP_DIR/logout.json" LOGOUT_CODE "${API_BASE}/api/v1/auth/logout" \
  -X POST -H "Authorization: Bearer ${NEW_ACCESS}"
[[ "$LOGOUT_CODE" == "204" ]] || {
  echo "logout failed: HTTP ${LOGOUT_CODE}"
  cat "$TMP_DIR/logout.json"
  exit 1
}

step "Forgot / reset password smoke"
curl -sf -X POST "${API_BASE}/api/v1/auth/forgot-password" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${TEST_EMAIL}\"}" >/dev/null

RESET_TOKEN="$(psql_query "SELECT pr.token FROM password_resets pr JOIN users u ON u.id = pr.user_id WHERE u.email = '${TEST_EMAIL}' ORDER BY pr.created_at DESC LIMIT 1;")"
[[ -n "$RESET_TOKEN" ]] || { echo "reset token not found"; exit 1; }

curl -sf -X POST "${API_BASE}/api/v1/auth/reset-password" \
  -H 'Content-Type: application/json' \
  -d "{\"token\":\"${RESET_TOKEN}\",\"password\":\"NewSecure2!\"}" >/dev/null

LOGIN2_BODY="$TMP_DIR/login2.json"
LOGIN2_CODE=""
curl_json "$LOGIN2_BODY" LOGIN2_CODE "${API_BASE}/api/v1/auth/login" \
  -X POST -H 'Content-Type: application/json' \
  -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"NewSecure2!\"}"
[[ "$LOGIN2_CODE" == "200" ]] || {
  echo "login after reset failed: HTTP ${LOGIN2_CODE}"
  cat "$LOGIN2_BODY"
  exit 1
}

step "Newman: Jobs (Phase 3)"
run_newman "Jobs (Phase 3)"

rm -rf "$TMP_DIR"
echo "Postman CI smoke complete."
