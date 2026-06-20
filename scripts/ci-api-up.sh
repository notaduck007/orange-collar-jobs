#!/usr/bin/env bash
# Start NestJS API for CI Postman / manual smoke (background process).
# Usage: bash scripts/ci-api-up.sh && bash scripts/ci-postman.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

API_DIR="src/api"
PID_FILE="/tmp/warehousejobs-api-ci.pid"
LOG_FILE="/tmp/warehousejobs-api-ci.log"
API_BASE="${POSTMAN_API_BASE:-http://localhost:3001}"

if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "API already running (pid $(cat "$PID_FILE"))"
  exit 0
fi

# Required for Nest envSchema (see src/api/src/core/config/env.schema.ts)
: "${NODE_ENV:=development}"
: "${PORT:=3001}"
: "${CORS_ORIGIN:=http://localhost:5173}"
: "${DATABASE_URL:?DATABASE_URL required}"
: "${REDIS_URL:=redis://localhost:6379}"
: "${JWT_SECRET:?JWT_SECRET required (min 32 chars)}"
: "${JWT_REFRESH_SECRET:?JWT_REFRESH_SECRET required (min 32 chars)}"
: "${STORAGE_ENDPOINT:=http://localhost:9000}"
: "${STORAGE_ACCESS_KEY:=wj_minio_user}"
: "${STORAGE_SECRET_KEY:=wj_minio_dev_password}"
: "${STORAGE_FORCE_PATH_STYLE:=true}"
: "${EMAIL_API_KEY:=test_email_key}"
: "${EMAIL_FROM:=noreply@test.com}"
: "${API_KEY_HASH:=ci_placeholder_batch_key_hash}"
: "${LOG_LEVEL:=info}"

if [[ ${#JWT_SECRET} -lt 32 ]]; then
  echo "JWT_SECRET must be at least 32 characters (got ${#JWT_SECRET})"
  exit 1
fi

if [[ ${#JWT_REFRESH_SECRET} -lt 32 ]]; then
  echo "JWT_REFRESH_SECRET must be at least 32 characters (got ${#JWT_REFRESH_SECRET})"
  exit 1
fi

cd "$API_DIR"
bun run db:generate
bun run build

# Export explicitly so nohup/node inherits full CI env (incl. JWT_*).
export NODE_ENV PORT CORS_ORIGIN DATABASE_URL REDIS_URL
export JWT_SECRET JWT_REFRESH_SECRET JWT_ACCESS_EXPIRES_IN JWT_REFRESH_EXPIRES_IN
export STORAGE_ENDPOINT STORAGE_ACCESS_KEY STORAGE_SECRET_KEY STORAGE_FORCE_PATH_STYLE
export EMAIL_API_KEY EMAIL_FROM EMAIL_FROM_NAME API_KEY_HASH LOG_LEVEL

rm -f "$LOG_FILE"
nohup bun run start >"$LOG_FILE" 2>&1 &
echo $! >"$PID_FILE"
echo "API starting (pid $(cat "$PID_FILE")), log: $LOG_FILE"

for i in $(seq 1 60); do
  if curl -sf "${API_BASE}/api/health" >/dev/null 2>&1; then
    echo "API ready (attempt $i)"
    exit 0
  fi
  sleep 2
done

echo "API failed to become ready — tail of log:"
tail -n 80 "$LOG_FILE" || true
exit 1
