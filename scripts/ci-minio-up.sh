#!/usr/bin/env bash
# Start MinIO for CI (GitHub Actions) and create required buckets.
# GHA service containers cannot pass `server /data` reliably — use this script instead.
set -euo pipefail

MINIO_USER="${MINIO_ROOT_USER:-wj_minio_user}"
MINIO_PASS="${MINIO_ROOT_PASSWORD:-wj_minio_dev_password}"
MINIO_PORT="${MINIO_PORT:-9000}"
CONTAINER_NAME="${MINIO_CI_CONTAINER:-minio-ci}"
MAX_ATTEMPTS="${MINIO_CI_MAX_ATTEMPTS:-45}"

if docker ps --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
  echo "MinIO container $CONTAINER_NAME already running"
else
  docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
  echo "Starting MinIO container $CONTAINER_NAME on port ${MINIO_PORT}..."
  docker run -d --name "$CONTAINER_NAME" \
    --publish "${MINIO_PORT}:9000" \
    --env MINIO_ROOT_USER="$MINIO_USER" \
    --env MINIO_ROOT_PASSWORD="$MINIO_PASS" \
    minio/minio:latest server /data --console-address ":9001"
fi

echo "Waiting for MinIO (mc ready)..."
for i in $(seq 1 "$MAX_ATTEMPTS"); do
  if docker run --rm --network host minio/mc:latest \
    /bin/sh -c "
      mc alias set local http://localhost:${MINIO_PORT} ${MINIO_USER} ${MINIO_PASS} &&
      mc ready local
    " 2>/dev/null; then
    echo "MinIO is ready"
    break
  fi
  if [[ "$i" -eq "$MAX_ATTEMPTS" ]]; then
    echo "::error::MinIO did not become ready within $((MAX_ATTEMPTS * 2))s"
    docker ps -a || true
    docker logs "$CONTAINER_NAME" 2>/dev/null || true
    exit 1
  fi
  echo "Attempt $i/${MAX_ATTEMPTS} - MinIO not ready yet..."
  sleep 2
done

echo "Creating MinIO buckets..."
docker run --rm --network host minio/mc:latest \
  /bin/sh -c "
    mc alias set local http://localhost:${MINIO_PORT} ${MINIO_USER} ${MINIO_PASS} &&
    mc mb --ignore-existing local/resumes &&
    mc mb --ignore-existing local/company-logos &&
    mc mb --ignore-existing local/ad-assets &&
    echo 'MinIO buckets ready'
  "
