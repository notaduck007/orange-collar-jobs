#!/usr/bin/env bash
# Create MinIO buckets required by the API (idempotent). Requires MinIO on localhost:9000.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if docker compose ps minio --status running >/dev/null 2>&1; then
  echo "Ensuring MinIO buckets via docker compose minio-init..."
  docker compose run --rm minio-init
  exit 0
fi

echo "MinIO container not running — creating buckets via mc (host network)..."
docker run --rm --network host minio/mc:latest \
  /bin/sh -c "
    mc alias set local http://localhost:9000 wj_minio_user wj_minio_dev_password &&
    mc mb --ignore-existing local/resumes &&
    mc mb --ignore-existing local/company-logos &&
    mc mb --ignore-existing local/ad-assets &&
    echo 'MinIO buckets ready'
  "
