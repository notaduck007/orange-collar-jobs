#!/usr/bin/env bash
# Create root .env from .env.example and merge any legacy src/api/.env keys once.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

NESTED="src/api/.env"
if [[ -f "$NESTED" ]]; then
  echo "Merging missing keys from $NESTED into root .env..."
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "${line// }" ]] && continue
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    key="${line%%=*}"
    key="${key//[[:space:]]}"
    if [[ -z "$key" ]]; then continue; fi
    if ! grep -q "^${key}=" .env 2>/dev/null; then
      printf '%s\n' "$line" >> .env
      echo "  + $key"
    fi
  done < "$NESTED"
  echo ""
  echo "Done. Root .env is the single source of truth."
  echo "You can remove $NESTED after verifying root .env has all API variables."
fi

echo "Environment ready: $ROOT/.env"
