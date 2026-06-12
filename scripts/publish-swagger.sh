#!/usr/bin/env bash
# =============================================================================
# publish-swagger.sh
#
# Push docs/api/openapi.yaml to SwaggerHub.
#
# Usage:
#   ./scripts/publish-swagger.sh                    # publish current version
#   ./scripts/publish-swagger.sh --dry-run          # validate only, no upload
#   ./scripts/publish-swagger.sh --version 1.1.0    # override API version
#   SWAGGER_API_KEY=<key> ./scripts/publish-swagger.sh  # key from env
#
# Required env:
#   SWAGGER_API_KEY  — SwaggerHub personal API key
#                      (read from .env or shell environment)
#
# SwaggerHub API reference:
#   https://app.swaggerhub.com/apis/swagger-hub/registry-api/1.0.67
# =============================================================================

set -euo pipefail

# ── Color helpers ─────────────────────────────────────────────────────────────
if [[ -t 1 ]]; then          # only emit color codes when stdout is a terminal
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  CYAN='\033[0;36m'
  BOLD='\033[1m'
  RESET='\033[0m'
else
  RED='' GREEN='' YELLOW='' CYAN='' BOLD='' RESET=''
fi

info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
error()   { echo -e "${RED}[ERROR]${RESET} $*" >&2; }
fatal()   { error "$*"; exit 1; }
step()    { echo -e "\n${BOLD}▶ $*${RESET}"; }

# ── Defaults ──────────────────────────────────────────────────────────────────
OWNER="redbonzai"
API_NAME="warehousejobs-api"
SPEC_FILE="docs/api/openapi.yaml"
SWAGGERHUB_URL="https://api.swaggerhub.com/apis"
DRY_RUN=false
VERSION_OVERRIDE=""

# ── Parse arguments ───────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=true
      shift ;;
    --version)
      [[ -z "${2:-}" ]] && fatal "--version requires a value (e.g. --version 1.1.0)"
      VERSION_OVERRIDE="$2"
      shift 2 ;;
    --owner)
      [[ -z "${2:-}" ]] && fatal "--owner requires a value"
      OWNER="$2"
      shift 2 ;;
    --api)
      [[ -z "${2:-}" ]] && fatal "--api requires a value"
      API_NAME="$2"
      shift 2 ;;
    --spec)
      [[ -z "${2:-}" ]] && fatal "--spec requires a file path"
      SPEC_FILE="$2"
      shift 2 ;;
    --help|-h)
      sed -n '/^# Usage:/,/^# =/p' "$0" | sed 's/^# \?//'
      exit 0 ;;
    *)
      fatal "Unknown argument: $1 (run with --help for usage)" ;;
  esac
done

# ── Resolve repo root ─────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

# ── Load .env (if present) — never override existing shell variables ──────────
ENV_FILE="${REPO_ROOT}/.env"
if [[ -f "${ENV_FILE}" ]]; then
  # Export only lines that look like VAR=value, skip comments and blanks
  set -o allexport
  # shellcheck disable=SC1090
  source <(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "${ENV_FILE}" | sed 's/#.*//')
  set +o allexport
fi

# ── Validate prerequisites ────────────────────────────────────────────────────
step "Checking prerequisites"

command -v curl >/dev/null 2>&1 || fatal "curl is required but not installed."
success "curl found: $(curl --version | head -1)"

[[ -f "${SPEC_FILE}" ]] || fatal "OpenAPI spec not found: ${SPEC_FILE}"
success "Spec file found: ${SPEC_FILE} ($(wc -c < "${SPEC_FILE}" | tr -d ' ') bytes)"

[[ -n "${SWAGGER_API_KEY:-}" ]] || fatal "SWAGGER_API_KEY is not set.\n       Add it to .env or export it in your shell before running this script."
success "SWAGGER_API_KEY is set"

# ── Extract version from YAML if not overridden ───────────────────────────────
step "Resolving API version"

if [[ -n "${VERSION_OVERRIDE}" ]]; then
  VERSION="${VERSION_OVERRIDE}"
  info "Using version override: ${VERSION}"
else
  # Parse `version:` field from the info block — works without a YAML parser
  VERSION="$(grep -m1 '^\s*version:' "${SPEC_FILE}" | sed 's/.*version:[[:space:]]*//' | tr -d "\"' ")"
  [[ -n "${VERSION}" ]] || fatal "Could not extract version from ${SPEC_FILE}.\n       Add a --version flag or ensure 'info.version' is set in the YAML."
  info "Detected version from spec: ${VERSION}"
fi

# ── Build SwaggerHub URL ──────────────────────────────────────────────────────
# SwaggerHub Registry API:
#   POST /apis/{owner}/{api}?version={ver}&isPrivate=true&force=true
#   Body: raw YAML content
#   Auth: Authorization: {apiKey}   (no "Bearer" prefix)
#
# ?force=true  → overwrite the version if it already exists
# ?isPrivate   → keep the API private (matches SwaggerHub account setting)
TARGET_URL="${SWAGGERHUB_URL}/${OWNER}/${API_NAME}?version=${VERSION}&isPrivate=true&force=true"

echo ""
info "Owner  : ${BOLD}${OWNER}${RESET}"
info "API    : ${BOLD}${API_NAME}${RESET}"
info "Version: ${BOLD}${VERSION}${RESET}"
info "Target : ${BOLD}${TARGET_URL}${RESET}"

# ── Dry run — stop here ───────────────────────────────────────────────────────
if [[ "${DRY_RUN}" == true ]]; then
  echo ""
  warn "Dry run mode — skipping upload."
  info "The following curl command would be executed:"
  echo ""
  echo "  curl -X POST \\"
  echo "    -H 'Authorization: ${SWAGGER_API_KEY:0:8}...<redacted>' \\"
  echo "    -H 'Content-Type: application/yaml' \\"
  echo "    --data-binary @${SPEC_FILE} \\"
  echo "    \"${TARGET_URL}\""
  echo ""
  success "Dry run complete — no changes pushed."
  exit 0
fi

# ── Push to SwaggerHub ────────────────────────────────────────────────────────
step "Pushing to SwaggerHub"

HTTP_RESPONSE=$(
  curl -sS -X POST \
    -H "Authorization: ${SWAGGER_API_KEY}" \
    -H "Content-Type: application/yaml" \
    -H "Accept: application/json" \
    --data-binary @"${SPEC_FILE}" \
    --write-out "\n__HTTP_STATUS__%{http_code}" \
    "${TARGET_URL}"
)

# Split body and status code
HTTP_BODY="$(echo "${HTTP_RESPONSE}" | sed '$d')"
HTTP_STATUS="$(echo "${HTTP_RESPONSE}" | tail -1 | sed 's/__HTTP_STATUS__//')"

# ── Interpret response ────────────────────────────────────────────────────────
echo ""
info "HTTP status: ${BOLD}${HTTP_STATUS}${RESET}"

case "${HTTP_STATUS}" in
  200)
    success "Spec updated successfully on SwaggerHub."
    ;;
  201)
    success "Spec created successfully on SwaggerHub (new version)."
    ;;
  400)
    error "Bad Request — SwaggerHub rejected the spec."
    if [[ -n "${HTTP_BODY}" ]]; then
      echo ""
      echo "${HTTP_BODY}"
    fi
    fatal "Fix the YAML validation errors above and retry."
    ;;
  401)
    fatal "Unauthorized — check your SWAGGER_API_KEY."
    ;;
  403)
    fatal "Forbidden — the API key does not have write access to ${OWNER}/${API_NAME}."
    ;;
  404)
    error "Not Found — the API ${OWNER}/${API_NAME} does not exist on SwaggerHub."
    info  "If this is a new API, create it at: https://app.swaggerhub.com/apis/${OWNER}/${API_NAME}"
    info  "Then re-run this script to push the spec."
    if [[ -n "${HTTP_BODY}" ]]; then echo "${HTTP_BODY}"; fi
    exit 1
    ;;
  409)
    # Should not happen with force=true, but handle defensively
    warn "Version ${VERSION} already exists and could not be overwritten."
    info "Try deleting the version on SwaggerHub first, or increment 'info.version' in ${SPEC_FILE}."
    if [[ -n "${HTTP_BODY}" ]]; then echo "${HTTP_BODY}"; fi
    exit 1
    ;;
  *)
    error "Unexpected HTTP status: ${HTTP_STATUS}"
    if [[ -n "${HTTP_BODY}" ]]; then
      echo ""
      echo "${HTTP_BODY}"
    fi
    fatal "Push failed. See response above."
    ;;
esac

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════════╗${RESET}"
echo -e "${GREEN}${BOLD}║  Published: ${OWNER}/${API_NAME} @ v${VERSION}${RESET}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════════╝${RESET}"
echo ""
echo -e "  View: ${CYAN}https://app.swaggerhub.com/apis/${OWNER}/${API_NAME}/${VERSION}${RESET}"
echo ""
