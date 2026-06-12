#!/usr/bin/env bash
# =============================================================================
# bump-api-version.sh
#
# Increments the semver version in docs/api/openapi.yaml.
# Optionally chains directly into publish-swagger.sh.
#
# Usage:
#   ./scripts/bump-api-version.sh patch          # 1.0.0 → 1.0.1
#   ./scripts/bump-api-version.sh minor          # 1.0.1 → 1.1.0
#   ./scripts/bump-api-version.sh major          # 1.1.0 → 2.0.0
#   ./scripts/bump-api-version.sh patch --push   # bump + push to SwaggerHub
#   ./scripts/bump-api-version.sh minor --push   # bump minor + push
#   ./scripts/bump-api-version.sh --dry-run patch  # print new version, no write
# =============================================================================

set -euo pipefail

# ── Color helpers ─────────────────────────────────────────────────────────────
if [[ -t 1 ]]; then
  RED='\033[0;31m' GREEN='\033[0;32m' YELLOW='\033[1;33m'
  CYAN='\033[0;36m' BOLD='\033[1m' RESET='\033[0m'
else
  RED='' GREEN='' YELLOW='' CYAN='' BOLD='' RESET=''
fi
info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
fatal()   { echo -e "${RED}[ERROR]${RESET} $*" >&2; exit 1; }
step()    { echo -e "\n${BOLD}▶ $*${RESET}"; }

# ── Defaults ──────────────────────────────────────────────────────────────────
BUMP_TYPE=""
DO_PUSH=false
DRY_RUN=false

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SPEC_FILE="${REPO_ROOT}/docs/api/openapi.yaml"

# ── Parse arguments ───────────────────────────────────────────────────────────
for arg in "$@"; do
  case "${arg}" in
    patch|minor|major) BUMP_TYPE="${arg}" ;;
    --push)            DO_PUSH=true ;;
    --dry-run)         DRY_RUN=true ;;
    --help|-h)
      echo "Usage: bump-api-version.sh <patch|minor|major> [--push] [--dry-run]"
      exit 0 ;;
    *)
      fatal "Unknown argument: ${arg}. Expected: patch | minor | major" ;;
  esac
done

[[ -n "${BUMP_TYPE}" ]] || fatal "Bump type is required: patch | minor | major"
[[ -f "${SPEC_FILE}" ]] || fatal "Spec file not found: ${SPEC_FILE}"

# ── Read current version ──────────────────────────────────────────────────────
step "Reading current version"

# Match the 'version:' key under the 'info:' block (first match in file)
CURRENT_VERSION="$(grep -m1 '^\s*version:' "${SPEC_FILE}" | sed 's/.*version:[[:space:]]*//' | tr -d "\"' ")"

[[ -n "${CURRENT_VERSION}" ]] || fatal "Could not parse version from ${SPEC_FILE}"

# Validate semver pattern
if ! echo "${CURRENT_VERSION}" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  fatal "Version '${CURRENT_VERSION}' is not a valid semver (expected X.Y.Z)"
fi

MAJOR="$(echo "${CURRENT_VERSION}" | cut -d. -f1)"
MINOR="$(echo "${CURRENT_VERSION}" | cut -d. -f2)"
PATCH="$(echo "${CURRENT_VERSION}" | cut -d. -f3)"

info "Current version: ${BOLD}${CURRENT_VERSION}${RESET}"

# ── Compute new version ───────────────────────────────────────────────────────
case "${BUMP_TYPE}" in
  patch)
    NEW_VERSION="${MAJOR}.${MINOR}.$((PATCH + 1))"
    ;;
  minor)
    NEW_VERSION="${MAJOR}.$((MINOR + 1)).0"
    ;;
  major)
    NEW_VERSION="$((MAJOR + 1)).0.0"
    ;;
esac

info "New version:     ${BOLD}${NEW_VERSION}${RESET}  (${BUMP_TYPE} bump)"

# ── Dry run ───────────────────────────────────────────────────────────────────
if [[ "${DRY_RUN}" == true ]]; then
  echo ""
  warn "Dry run — no files were modified."
  info "Would update ${SPEC_FILE}:"
  echo "    ${CURRENT_VERSION}  →  ${NEW_VERSION}"
  exit 0
fi

# ── Write new version into YAML ───────────────────────────────────────────────
step "Writing new version to ${SPEC_FILE}"

# Use a temp file for safe in-place editing (works on both macOS and Linux)
TMP_FILE="$(mktemp)"
# Replace first occurrence of '  version: X.Y.Z' using awk fixed-string match
# (avoids treating dots in version numbers as regex wildcards)
awk -v old="  version: ${CURRENT_VERSION}" -v new="  version: ${NEW_VERSION}" \
  'done != 1 && index($0, old) { $0 = new; done=1 } { print }' \
  "${SPEC_FILE}" > "${TMP_FILE}"
mv "${TMP_FILE}" "${SPEC_FILE}"

# Verify the write
WRITTEN_VERSION="$(grep -m1 '^\s*version:' "${SPEC_FILE}" | sed 's/.*version:[[:space:]]*//' | tr -d "\"' ")"
[[ "${WRITTEN_VERSION}" == "${NEW_VERSION}" ]] || \
  fatal "Version write failed. File shows '${WRITTEN_VERSION}', expected '${NEW_VERSION}'"

success "Version updated: ${CURRENT_VERSION} → ${NEW_VERSION}"
echo ""
echo "  File: ${SPEC_FILE}"

# ── Optionally push to SwaggerHub ─────────────────────────────────────────────
if [[ "${DO_PUSH}" == true ]]; then
  echo ""
  step "Handing off to publish-swagger.sh"
  exec "${SCRIPT_DIR}/publish-swagger.sh"
fi

# ── Suggest next step ─────────────────────────────────────────────────────────
echo ""
info "To push this version to SwaggerHub, run:"
echo "    ${CYAN}./scripts/publish-swagger.sh${RESET}"
echo "  or:"
echo "    ${CYAN}bun run api:publish${RESET}"
echo ""
