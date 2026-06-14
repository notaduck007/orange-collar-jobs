# Start NestJS API for CI Postman / manual smoke (background process).
# Usage: bash scripts/ci-api-up.sh && bash scripts/ci-postman.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

API_DIR="src/api"
PID_FILE="/tmp/warehousejobs-api-ci.pid"
LOG_FILE="/tmp/warehousejobs-api-ci.log"

if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "API already running (pid $(cat "$PID_FILE"))"
  exit 0
fi

: "${NODE_ENV:=development}"
: "${PORT:=3001}"
: "${CORS_ORIGIN:=http://localhost:5173}"
: "${DATABASE_URL:?DATABASE_URL required}"
: "${REDIS_URL:=redis://localhost:6379}"
: "${JWT_SECRET:?JWT_SECRET required}"
: "${STORAGE_ENDPOINT:=http://localhost:9000}"
: "${STORAGE_ACCESS_KEY:=wj_minio_user}"
: "${STORAGE_SECRET_KEY:=wj_minio_dev_password}"
: "${STORAGE_FORCE_PATH_STYLE:=true}"
: "${EMAIL_API_KEY:=test_email_key}"
: "${EMAIL_FROM:=noreply@test.com}"
: "${API_KEY_HASH:=ci_placeholder}"
: "${LOG_LEVEL:=info}"

cd "$API_DIR"
bun run build

nohup bun run start >"$LOG_FILE" 2>&1 &
echo $! >"$PID_FILE"
echo "API starting (pid $(cat "$PID_FILE")), log: $LOG_FILE"
