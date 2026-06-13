#!/usr/bin/env bash
# Create MinIO buckets required by the API (idempotent).
# Expects MinIO already listening on MINIO_PORT (default 9000).
set -euo pipefail

MINIO_USER="${MINIO_ROOT_USER:-wj_minio_user}"
MINIO_PASS="${MINIO_ROOT_PASSWORD:-wj_minio_dev_password}"
MINIO_PORT="${MINIO_PORT:-9000}"
MINIO_ENDPOINT="http://127.0.0.1:${MINIO_PORT}"

echo "Creating MinIO buckets at ${MINIO_ENDPOINT}..."
# minio/mc entrypoint is `mc` — override to sh so alias + mb run in one shell session.
docker run --rm --network host --entrypoint /bin/sh minio/mc:latest -c "
  mc alias set local ${MINIO_ENDPOINT} ${MINIO_USER} ${MINIO_PASS} &&
  mc mb --ignore-existing local/resumes &&
  mc mb --ignore-existing local/company-logos &&
  mc mb --ignore-existing local/ad-assets &&
  echo 'MinIO buckets ready'
"
