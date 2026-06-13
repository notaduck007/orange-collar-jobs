#!/usr/bin/env bash
# Create MinIO buckets required by the API (idempotent). Requires MinIO on localhost:9000.
#
# Does NOT start containers — avoids port conflicts when CI already runs minio-ci on :9000.
# Local dev: run `docker compose up -d minio` first, or use scripts/ci-minio-up.sh.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "${ROOT}/scripts/minio-create-buckets.sh"
